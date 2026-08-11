-- ============================================================================
-- Club OftalmoBlack — esquema da área de membros
--
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez só).
-- Ele cria as tabelas, liga o Row Level Security e define quem enxerga o quê.
--
-- A regra em uma frase: o mentorado só enxerga as linhas com o member_id dele
-- (mais os itens de member_id nulo, que valem para a turma inteira); o
-- administrador enxerga e escreve tudo.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── tabelas ────────────────────────────────────────────────────────────────

-- Quem administra. Fica separado de members porque o admin não é mentorado e
-- não deve aparecer na listagem da turma.
create table if not exists public.app_admins (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

create table if not exists public.members (
  id         uuid primary key default gen_random_uuid(),
  -- Preenchido sozinho pelo gatilho abaixo quando o usuário nasce no Auth.
  user_id    uuid unique references auth.users(id) on delete set null,
  nome       text not null,
  email      text not null unique,
  iniciais   text,
  turma      text,
  fase       text,
  tier       text not null default 'BLACK',
  instagram  text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.members(id) on delete cascade,
  titulo          text not null,
  descricao       text,
  categoria       text,
  cadencia        text,
  vence_em        date,
  progresso_atual integer not null default 0,
  progresso_total integer not null default 0,
  status          text not null default 'pending' check (status in ('pending', 'done')),
  criado_em       timestamptz not null default now()
);

-- member_id nulo = evento da turma inteira.
-- inicia_em é timestamp sem fuso de propósito: o horário cadastrado é o horário
-- que o mentorado lê na tela, sem conversão no meio do caminho.
create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid references public.members(id) on delete cascade,
  titulo     text not null,
  mentor     text,
  inicia_em  timestamp not null,
  formato    text not null default 'Ao vivo',
  link       text,
  criado_em  timestamptz not null default now()
);

-- member_id nulo = artefato disponível para a turma inteira.
create table if not exists public.artifacts (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid references public.members(id) on delete cascade,
  nome       text not null,
  subtitulo  text,
  icone      text not null default 'box',
  status     text not null default 'Em produção'
             check (status in ('Disponível', 'Em produção', 'Bloqueado')),
  meta       text,
  url        text,
  criado_em  timestamptz not null default now()
);

create index if not exists tasks_member_idx     on public.tasks (member_id);
create index if not exists events_member_idx    on public.events (member_id);
create index if not exists artifacts_member_idx on public.artifacts (member_id);

-- ── quem é quem ────────────────────────────────────────────────────────────
-- As duas funções são SECURITY DEFINER porque precisam ler as tabelas
-- ignorando o RLS. Se uma política de members consultasse members para saber
-- se o usuário é admin, o Postgres entraria em recursão infinita.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.members where user_id = auth.uid();
$$;

-- Quem está logado, em uma viagem só: papel, e-mail e o cadastro de mentorado
-- (nulo quando é o administrador, que não é mentorado de ninguém).
create or replace function public.me()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'user_id',  auth.uid(),
    'email',    (select email from auth.users where id = auth.uid()),
    'is_admin', public.is_admin(),
    'member',   (select to_json(m) from public.members m where m.user_id = auth.uid())
  );
$$;

-- Cadastrar o mentorado no painel e criar o login dele no Auth são dois atos
-- separados; este gatilho costura os dois pelo e-mail, em qualquer ordem.
create or replace function public.link_member_to_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.members
     set user_id = new.id
   where lower(email) = lower(new.email)
     and user_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_member_to_user();

-- ── row level security ─────────────────────────────────────────────────────

alter table public.app_admins enable row level security;
alter table public.members    enable row level security;
alter table public.tasks      enable row level security;
alter table public.events     enable row level security;
alter table public.artifacts  enable row level security;

drop policy if exists "admin le a propria linha"     on public.app_admins;
drop policy if exists "le o proprio cadastro"        on public.members;
drop policy if exists "admin escreve membros"        on public.members;
drop policy if exists "le as proprias tarefas"       on public.tasks;
drop policy if exists "admin escreve tarefas"        on public.tasks;
drop policy if exists "le a agenda da turma"         on public.events;
drop policy if exists "admin escreve eventos"        on public.events;
drop policy if exists "le os artefatos liberados"    on public.artifacts;
drop policy if exists "admin escreve artefatos"      on public.artifacts;

create policy "admin le a propria linha" on public.app_admins
  for select to authenticated
  using (user_id = auth.uid());

create policy "le o proprio cadastro" on public.members
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

create policy "admin escreve membros" on public.members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "le as proprias tarefas" on public.tasks
  for select to authenticated
  using (public.is_admin() or member_id = public.current_member_id());

create policy "admin escreve tarefas" on public.tasks
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "le a agenda da turma" on public.events
  for select to authenticated
  using (public.is_admin()
         or member_id is null
         or member_id = public.current_member_id());

create policy "admin escreve eventos" on public.events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "le os artefatos liberados" on public.artifacts
  for select to authenticated
  using (public.is_admin()
         or member_id is null
         or member_id = public.current_member_id());

create policy "admin escreve artefatos" on public.artifacts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── marcar tarefa como concluída ───────────────────────────────────────────
-- O mentorado não recebe UPDATE nas tarefas: se recebesse, poderia reescrever o
-- título e o prazo do que foi combinado com ele. Em vez disso, esta função
-- troca só o status — e só das tarefas dele.

create or replace function public.toggle_task(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
begin
  select * into t from public.tasks where id = p_task_id;

  if t.id is null then
    raise exception 'Tarefa não encontrada.';
  end if;

  if not (public.is_admin() or t.member_id = public.current_member_id()) then
    raise exception 'Sem permissão para alterar esta tarefa.';
  end if;

  update public.tasks
     set status = case when status = 'done' then 'pending' else 'done' end
   where id = p_task_id
  returning * into t;

  return t;
end;
$$;

-- ── permissões ─────────────────────────────────────────────────────────────
-- Visitante sem login não lê nada. O resto é decidido pelas políticas acima.

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

revoke all on function public.is_admin()             from public;
revoke all on function public.current_member_id()    from public;
revoke all on function public.toggle_task(uuid)      from public;
revoke all on function public.me()                  from public;
grant execute on function public.is_admin()          to authenticated;
grant execute on function public.current_member_id() to authenticated;
grant execute on function public.toggle_task(uuid)   to authenticated;
grant execute on function public.me()                to authenticated;
