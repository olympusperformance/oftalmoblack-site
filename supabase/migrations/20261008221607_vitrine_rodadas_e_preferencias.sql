-- A rodada de distribuição é independente do trimestre em apuração.
-- Preferências são respostas, nunca reservas ou concessões de benefícios.
create table public.cb_vitrine_rounds (
 id uuid primary key default gen_random_uuid(),
 period text not null unique check (period ~ '^20[0-9]{2}-T[1-4]$'),
 status text not null check (status in ('scheduled','distributing','closed')),
 opens_on date not null,
 offers jsonb not null default '[]'::jsonb check (jsonb_typeof(offers)='array'),
 updated_at timestamptz not null default now(),
 updated_by uuid not null default auth.uid()
);
create table public.cb_vitrine_preferences (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.members(id),
 period text not null references public.cb_vitrine_rounds(period),
 response_status text not null check (response_status in ('received','incomplete','postponed','declined','missing')),
 benefits text[] not null default '{}' check (cardinality(benefits)<=3 and benefits <@ array['catarata','grau_zero','passagem']::text[]),
 preferred_dates date[] not null default '{}' check (cardinality(preferred_dates)<=3),
 family_circle text,
 pending_items text[] not null default '{}',
 note text check (length(note)<=4000),
 source text not null,
 period_points numeric check (period_points>=0),
 conferred_grade integer not null default 0 check (conferred_grade between 0 and 10),
 quarter_vouchers integer not null default 0 check (quarter_vouchers>=0),
 updated_at timestamptz not null default now(),
 updated_by uuid not null default auth.uid(),
 unique(member_id,period)
);
create index cb_vitrine_preferences_period on public.cb_vitrine_preferences(period);
comment on column public.cb_vitrine_preferences.period_points is 'Pontuação do trimestre fechado, sem acumulado anual e sem pontos do trimestre vigente.';
comment on column public.cb_vitrine_preferences.quarter_vouchers is 'Direitos por indicação na rodada importada; não cria voucher nem soma pontos.';

alter table public.cb_vitrine_rounds enable row level security;
alter table public.cb_vitrine_preferences enable row level security;
revoke all on public.cb_vitrine_rounds,public.cb_vitrine_preferences from public,anon,authenticated;
grant select,insert,update on public.cb_vitrine_rounds,public.cb_vitrine_preferences to authenticated;
create policy member_read on public.cb_vitrine_rounds for select to authenticated
 using ((select public.is_admin()) or exists(select 1 from public.members where user_id=(select auth.uid()) and ativo));
create policy own_read on public.cb_vitrine_preferences for select to authenticated
 using ((select public.is_admin()) or member_id in (select id from public.members where user_id=(select auth.uid()) and ativo));
do $$ declare t text; begin
 foreach t in array array['cb_vitrine_rounds','cb_vitrine_preferences'] loop
  execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select public.is_admin()))',t);
  execute format('create policy admin_update on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',t);
  execute format('create trigger stamp before insert or update on public.%I for each row execute function cerebro_private.stamp()',t);
  execute format('create trigger audit after insert or update on public.%I for each row execute function cerebro_private.audit()',t);
 end loop;
end $$;
