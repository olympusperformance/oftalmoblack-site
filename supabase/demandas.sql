-- ============================================================================
-- Club OftalmoBlack — quadro de demandas (interno da administração)
--
-- Rode no SQL Editor depois do schema.sql.
--
-- Isto é operação interna: quem toca é a equipe, não o mentorado. Por isso as
-- políticas abaixo não têm nenhuma regra de leitura para mentorado — só o
-- administrador alcança estas tabelas, em leitura e em escrita.
--
-- O vocabulário (status e prioridade) veio da lista "Demandas & Pendências —
-- BLACK" do ClickUp, traduzido, para a equipe não ter que aprender dois nomes
-- para a mesma coisa.
-- ============================================================================

-- ── equipe ─────────────────────────────────────────────────────────────────
-- Quem executa as demandas. Não é mentorado (esse está em members) e não é
-- necessariamente usuário do sistema — o João Felipe pode ser responsável por
-- uma demanda sem nunca entrar no painel.

create table if not exists public.staff (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  apelido   text,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ── demandas ───────────────────────────────────────────────────────────────

create table if not exists public.demands (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  descricao    text,
  status       text not null default 'A fazer'
               check (status in ('A fazer', 'Planejando', 'Em andamento', 'Em risco',
                                 'Aguardando retorno', 'Em pausa', 'Concluída', 'Cancelada')),
  prioridade   text not null default 'Média'
               check (prioridade in ('Alta', 'Média', 'Baixa')),
  -- Vários responsáveis, como no ClickUp.
  responsaveis uuid[],
  -- Opcional: a demanda é sobre um mentorado ("campanha do Pedro", "site da
  -- Cíntia"). Demanda interna não aponta para ninguém.
  member_id    uuid references public.members(id) on delete set null,
  -- De onde veio: "Reunião 30/07", "Suporte", "Planejamento".
  origem       text,
  vence_em     date,
  concluida_em timestamptz,
  criado_em    timestamptz not null default now()
);

create index if not exists demands_status_idx on public.demands (status);
create index if not exists demands_member_idx on public.demands (member_id);
create index if not exists demands_resp_idx   on public.demands using gin (responsaveis);

-- Fechar uma demanda sem carimbar a data deixaria "concluída quando?" sem
-- resposta, e reabrir sem limpar o carimbo deixaria uma data mentirosa.
create or replace function public.marca_conclusao()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('Concluída', 'Cancelada')
     and (old.status is null or old.status not in ('Concluída', 'Cancelada')) then
    new.concluida_em := now();
  elsif new.status not in ('Concluída', 'Cancelada') then
    new.concluida_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists demands_conclusao on public.demands;
create trigger demands_conclusao
  before insert or update on public.demands
  for each row execute function public.marca_conclusao();

-- ── acesso: só administração ───────────────────────────────────────────────

alter table public.staff   enable row level security;
alter table public.demands enable row level security;

drop policy if exists "admin manda na equipe"   on public.staff;
drop policy if exists "admin manda nas demandas" on public.demands;

create policy "admin manda na equipe" on public.staff
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin manda nas demandas" on public.demands
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.staff, public.demands to authenticated;
revoke all on public.staff, public.demands from anon;

-- ── equipe inicial ─────────────────────────────────────────────────────────
-- Os nomes que aparecem como responsáveis no ClickUp hoje.

insert into public.staff (nome, apelido)
select * from (values
  ('Ítalo Monte',          'IM'),
  ('João Felipe',          'JF'),
  ('Michele Sá de Souza',  'MS'),
  ('Jhon Kalliel',         'JK'),
  ('Grupo OftalmoPremium', 'GP')
) as v(nome, apelido)
where not exists (select 1 from public.staff);
