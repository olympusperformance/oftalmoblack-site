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

-- ── checklist da demanda ───────────────────────────────────────────────────
-- Acrescentado depois: a demanda ("conectar o WhatsApp da clínica") quase
-- nunca é um passo só, e o time precisava de onde marcar o que já saiu sem
-- abrir uma demanda nova para cada pedaço.
--
-- Diferente do checklist do artefato (supabase/progresso.sql), aqui a etapa
-- não é modelo para ninguém: ela pertence a esta demanda e o "feito" mora na
-- própria linha. Não há um mesmo passo andando em ritmos diferentes para
-- pessoas diferentes, que é o que obriga o artefato a separar as duas coisas.

create table if not exists public.demand_steps (
  id        uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.demands(id) on delete cascade,
  titulo    text not null,
  ordem     integer not null default 0,
  feito     boolean not null default false,
  feito_em  timestamptz,
  criado_em timestamptz not null default now()
);

-- A subtarefa carrega as mesmas colunas da demanda. Dividir a demanda em
-- pedaços sem poder dizer quem toca cada pedaço e até quando só muda o problema
-- de lugar: o pedaço vira uma pendência sem dono dentro de uma linha com dono.
-- Colunas acrescentadas depois da tabela — daí o alter em vez do create.
alter table public.demand_steps
  add column if not exists status       text not null default 'A fazer',
  add column if not exists prioridade   text not null default 'Média',
  add column if not exists responsaveis uuid[],
  add column if not exists member_id    uuid references public.members(id) on delete set null,
  add column if not exists vence_em     date;

-- Nomeadas, para a migração poder rodar de novo sem duplicar a regra.
alter table public.demand_steps drop constraint if exists demand_steps_status_ck;
alter table public.demand_steps add constraint demand_steps_status_ck
  check (status in ('A fazer', 'Planejando', 'Em andamento', 'Em risco',
                    'Aguardando retorno', 'Em pausa', 'Concluída', 'Cancelada'));

alter table public.demand_steps drop constraint if exists demand_steps_prioridade_ck;
alter table public.demand_steps add constraint demand_steps_prioridade_ck
  check (prioridade in ('Alta', 'Média', 'Baixa'));

-- Quem já tinha checklist marcado antes destas colunas existirem: o status
-- precisa contar a mesma história que a marcação.
update public.demand_steps set status = 'Concluída'
 where feito and status = 'A fazer';

create index if not exists demand_steps_demanda_idx
  on public.demand_steps (demand_id, ordem);
create index if not exists demand_steps_member_idx
  on public.demand_steps (member_id);
create index if not exists demand_steps_resp_idx
  on public.demand_steps using gin (responsaveis);

-- Uma fonte só para "está pronto?": o status. A marcação e o carimbo saem dele,
-- senão a caixinha da linha e a coluna Situação podem discordar na mesma tela.
-- Marcar sem carimbar a data deixaria "pronto quando?" sem resposta, e voltar
-- atrás sem limpar deixaria uma data mentindo.
create or replace function public.marca_etapa_demanda()
returns trigger
language plpgsql
as $$
begin
  new.feito := new.status in ('Concluída', 'Cancelada');
  if new.feito then
    -- coalesce preserva o carimbo de quem já estava pronto: reeditar o título
    -- de uma subtarefa fechada não muda a data em que ela fechou.
    new.feito_em := coalesce(new.feito_em, now());
  else
    new.feito_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists demand_steps_carimbo on public.demand_steps;
create trigger demand_steps_carimbo
  before insert or update on public.demand_steps
  for each row execute function public.marca_etapa_demanda();

alter table public.demand_steps enable row level security;

drop policy if exists "admin manda nas etapas da demanda" on public.demand_steps;

create policy "admin manda nas etapas da demanda" on public.demand_steps
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.demand_steps to authenticated;
revoke all on public.demand_steps from anon;
