-- Cadastro de interesse B2B. Isolado de perfil-clinica, membros e Sistema Black.
create table public.black_club_cadastros (
 id uuid primary key,
 sheet_row bigint generated always as identity (start with 2) unique,
 created_at timestamptz not null default now(),
 nome text not null check (length(nome) between 3 and 160),
 whatsapp text not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
 pagina text not null check (pagina = '/club/'),
 utm jsonb not null default '{}'::jsonb check (jsonb_typeof(utm) = 'object'),
 payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
 request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
 synced_at timestamptz,
 sync_attempts integer not null default 0,
 sync_error text,
 next_sync_at timestamptz not null default now(),
 sync_lock_until timestamptz
);
alter table public.black_club_cadastros enable row level security;
revoke all on public.black_club_cadastros from public, anon, authenticated;
grant select, insert, update, delete on public.black_club_cadastros to service_role;
revoke all on sequence public.black_club_cadastros_sheet_row_seq from public, anon, authenticated;
grant usage, select on sequence public.black_club_cadastros_sheet_row_seq to service_role;
create index black_club_pending on public.black_club_cadastros(next_sync_at) where synced_at is null;
create index black_club_rate on public.black_club_cadastros(request_hash,created_at);

create function public.black_club_receber(p_payload jsonb,p_hash text,p_ip_hash text)
returns text language plpgsql security invoker set search_path = '' as $$
declare existing_hash text;
begin
 -- O mesmo UUID é serializado mesmo se a conexão do visitante mudar de rede.
 perform pg_advisory_xact_lock(hashtextextended('club-id:'||(p_payload->>'id'),0));
 select payload_hash into existing_hash from public.black_club_cadastros where id=(p_payload->>'id')::uuid;
 if found then
   if existing_hash=p_hash then return 'existing'; else return 'conflict'; end if;
 end if;
 -- Cota comporta participantes usando o mesmo Wi-Fi de um evento.
 perform pg_advisory_xact_lock(hashtextextended('club-ip:'||p_ip_hash,0));
 if (select count(*) from public.black_club_cadastros where request_hash=p_ip_hash and created_at>now()-interval '1 hour')>=500 then return 'rate_limit'; end if;
 insert into public.black_club_cadastros(id,nome,whatsapp,pagina,utm,payload_hash,request_hash)
 values ((p_payload->>'id')::uuid,p_payload->>'nome',p_payload->>'whatsapp',p_payload->>'pagina',p_payload->'utm',p_hash,p_ip_hash);
 return 'created';
end;
$$;
revoke all on function public.black_club_receber(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.black_club_receber(jsonb,text,text) to service_role;

create function public.black_club_sync_claim()
returns setof public.black_club_cadastros language sql security invoker set search_path = '' as $$
 update public.black_club_cadastros set sync_lock_until=now()+interval '5 minutes',sync_attempts=sync_attempts+1
 where id in (select id from public.black_club_cadastros where synced_at is null and next_sync_at<=now() and (sync_lock_until is null or sync_lock_until<now()) order by created_at limit 5 for update skip locked)
 returning *;
$$;
revoke all on function public.black_club_sync_claim() from public, anon, authenticated;
grant execute on function public.black_club_sync_claim() to service_role;
