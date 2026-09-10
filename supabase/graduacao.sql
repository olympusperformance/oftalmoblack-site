-- Projeto OftalmoBlack Web. Dados de prévia, separados das métricas reais.
begin;
create table if not exists public.member_graduations (
  member_id uuid primary key references public.members(id) on delete cascade,
  source_date date not null,
  is_demo boolean not null default true,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.member_graduations enable row level security;
drop policy if exists "graduacao: leitura autorizada" on public.member_graduations;
create policy "graduacao: leitura autorizada" on public.member_graduations
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.members m
       where m.id=member_id and m.user_id=auth.uid() and m.ativo
    )
  );
revoke all on public.member_graduations from public, anon, authenticated;
grant select on public.member_graduations to authenticated;
grant all on public.member_graduations to service_role;
commit;
