-- ============================================================================
-- Limpeza: fase 4 da taxonomia de 21/09/2026
--
-- Spec: docs/superpowers/specs/2026-09-21-taxonomia-artefatos-demandas-design.md
-- Roda DEPOIS do deploy da UI da fase 4: a UI anterior lia tasks no boot do
-- admin (sem tolerância a tabela ausente) e pilar no cabeçalho da área.
-- Idempotente: rodar duas vezes deixa o banco igual. Snapshot trancado antes
-- do drop.
--
-- O que muda:
--   1. tasks + toggle_task saem. A jornada diz que o médico não opera o gestor
--      interno; ação dele é etapa trava do artefato, cobrada por demanda da
--      CS. A tabela tem 0 linhas desde antes da fase 1; snapshot mesmo assim.
--   2. artifact_groups.pilar sai. A UI parou de ler na fase 2; os valores
--      estão em _bkp_20260921_artifact_groups.
--   3. demands_herda_artefato fica tolerante: só re-deriva a frente quando a
--      etapa muda; etapa que não existe mais vira null. Assim o FK
--      "on delete set null" de artifact_id/step_id não briga com o trigger
--      quando um artefato com demanda ligada é apagado.
--   4. Guard: área da equipe (interna) só recebe frente interna, e frente
--      interna só vive em área da equipe.
--
-- demands.projeto_legado FICA nesta fase (um ciclo depois, com aval do Felipe).
-- Nenhuma etapa de artefato nem progresso é tocado.
-- ============================================================================

begin;

-- ── 1. tarefas do mentorado ─────────────────────────────────────────────────

create table if not exists public._bkp_20260922_tasks as select * from public.tasks;
alter table public._bkp_20260922_tasks enable row level security;
revoke all on public._bkp_20260922_tasks from anon, authenticated;

-- A função devolve o tipo da tabela: sai antes dela.
drop function if exists public.toggle_task(uuid);
drop table if exists public.tasks;

-- ── 2. pilar ────────────────────────────────────────────────────────────────

alter table public.artifact_groups drop column if exists pilar;

-- ── 3. trigger tolerante ────────────────────────────────────────────────────

create or replace function public.demanda_herda_artefato()
returns trigger
language plpgsql
as $$
declare
  v_art uuid;
begin
  if new.step_id is null then
    return new;
  end if;
  -- Etapa não mudou: nada a re-derivar. É o caso do FK zerando artifact_id
  -- enquanto o cascade das etapas ainda não passou.
  if tg_op = 'UPDATE' and new.step_id is not distinct from old.step_id then
    return new;
  end if;
  select artifact_id into v_art from public.artifact_steps where id = new.step_id;
  if v_art is null then
    new.step_id := null;
    return new;
  end if;
  if new.artifact_id is not null and new.artifact_id <> v_art then
    raise exception 'A etapa pertence a outra frente.';
  end if;
  new.artifact_id := v_art;
  return new;
end;
$$;

-- ── 4. guard área × frente ──────────────────────────────────────────────────

create or replace function public.frente_casa_com_area()
returns trigger
language plpgsql
as $$
declare
  v_interna boolean;
begin
  if new.group_id is null then
    return new;
  end if;
  select interna into v_interna from public.artifact_groups where id = new.group_id;
  if v_interna and new.tipo <> 'interna' then
    raise exception 'Área da equipe só recebe frente interna.';
  end if;
  if not v_interna and new.tipo = 'interna' then
    raise exception 'Frente interna só vive em área da equipe.';
  end if;
  return new;
end;
$$;

drop trigger if exists artifacts_casa_com_area on public.artifacts;
create trigger artifacts_casa_com_area
  before insert or update of group_id, tipo on public.artifacts
  for each row execute function public.frente_casa_com_area();

notify pgrst, 'reload schema';
commit;

-- ============================================================================
-- PROVA (mesma sessão, depois do commit)
-- ============================================================================
-- select to_regclass('public.tasks') as tasks, to_regprocedure('public.toggle_task(uuid)') as toggle;
-- esperado: null, null
-- select count(*) as pilar from information_schema.columns
--  where table_name = 'artifact_groups' and column_name = 'pilar';
-- esperado: 0
-- select relname, relrowsecurity from pg_class where relname = '_bkp_20260922_tasks';
-- esperado: true
-- select tgname from pg_trigger where tgname in ('demands_herda_artefato', 'artifacts_casa_com_area');
-- esperado: 2 linhas
-- select count(*) as sp, count(*) filter (where feito) as feitas from public.step_progress;
-- esperado: 633 / 618 (21/09)
