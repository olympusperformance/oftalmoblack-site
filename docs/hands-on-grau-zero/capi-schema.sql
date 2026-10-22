-- Dedicated B2B outbox. No candidate answers or raw contact data.
create table public.hogz_capi_outbox (
  event_id text primary key,
  request_id uuid not null,
  event_name text not null check (event_name in ('PageView','ViewContent','Lead')),
  payload_hash text not null,
  mode text not null check (mode in ('production','test','qa')),
  sheet_confirmed boolean not null default false,
  event_payload jsonb not null,
  test_event_code text,
  status text not null default 'pending' check (status in ('pending','processing','accepted','blocked','expired','qa')),
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  accepted_at timestamptz,
  last_http integer,
  receipt jsonb,
  check (event_name <> 'Lead' or sheet_confirmed),
  check ((mode='test') = (test_event_code is not null))
);
alter table public.hogz_capi_outbox enable row level security;
revoke all on public.hogz_capi_outbox from public,anon,authenticated;
grant select,insert,update,delete on public.hogz_capi_outbox to service_role;
create index hogz_capi_due on public.hogz_capi_outbox(next_attempt_at) where status in ('pending','processing');

create table public.hogz_capi_rate_limits (
  bucket text primary key,
  hits integer not null default 1,
  expires_at timestamptz not null
);
alter table public.hogz_capi_rate_limits enable row level security;
revoke all on public.hogz_capi_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on public.hogz_capi_rate_limits to service_role;

create function public.hogz_capi_rate(p_bucket text, p_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  insert into public.hogz_capi_rate_limits(bucket,expires_at) values(p_bucket,now()+interval '10 minutes')
  on conflict(bucket) do update set hits=hogz_capi_rate_limits.hits+1
  returning hits into n;
  return n <= p_limit;
end $$;
revoke all on function public.hogz_capi_rate(text,integer) from public,anon,authenticated;
grant execute on function public.hogz_capi_rate(text,integer) to service_role;

create function public.hogz_capi_claim(p_limit integer default 10)
returns setof public.hogz_capi_outbox language plpgsql security invoker set search_path = '' as $$
begin
  update public.hogz_capi_outbox set status='expired',event_payload=event_payload-'user_data'
  where status in ('pending','processing') and (created_at < now()-interval '47 hours' or attempts>=10);
  delete from public.hogz_capi_rate_limits where expires_at<now();
  delete from public.hogz_capi_outbox where created_at<now()-interval '90 days' and status in ('accepted','qa','expired');
  return query
  with due as (
    select event_id from public.hogz_capi_outbox
    where (status='pending' or (status='processing' and lease_until<now())) and next_attempt_at<=now()
    order by created_at for update skip locked limit least(greatest(p_limit,1),20)
  )
  update public.hogz_capi_outbox o set status='processing',lease_until=now()+interval '90 seconds',attempts=o.attempts+1
  from due where o.event_id=due.event_id returning o.*;
end $$;
revoke all on function public.hogz_capi_claim(integer) from public,anon,authenticated;
grant execute on function public.hogz_capi_claim(integer) to service_role;

-- Private, secret-authenticated cron call. Secret value is created/transferred by the private deployment helper.
create function public.hogz_capi_tick()
returns bigint language plpgsql security definer set search_path = '' as $$
declare task bigint; auth_key text;
begin
  update public.hogz_capi_outbox set event_payload=event_payload-'user_data' where created_at<now()-interval '47 hours' and event_payload ? 'user_data';
  delete from public.hogz_capi_rate_limits where expires_at<now();
  delete from public.hogz_capi_outbox where created_at<now()-interval '90 days' and status in ('accepted','qa','expired','blocked');
  if not exists(select 1 from public.hogz_capi_outbox where status in ('pending','processing') and next_attempt_at<=now()) then return null; end if;
  select decrypted_secret into auth_key from vault.decrypted_secrets where name='hogz_capi_dispatch_key';
  if auth_key is null then raise exception 'HOGZ dispatcher not configured'; end if;
  select net.http_post(
    url:='https://zpyxnkuvircukjlfexrv.supabase.co/functions/v1/hands-on-capi',
    headers:=jsonb_build_object('Content-Type','application/json','x-hogz-dispatch',auth_key),
    body:='{"op":"dispatch"}'::jsonb,timeout_milliseconds:=30000
  ) into task;
  return task;
end $$;
revoke all on function public.hogz_capi_tick() from public,anon,authenticated,service_role;
-- Cron owns this internal function; no REST caller may invoke it.

select cron.schedule('hogz-capi-retry','*/5 * * * *','select public.hogz_capi_tick();');
