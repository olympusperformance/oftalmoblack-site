-- ============================================================================
-- Retrato dos artefatos ANTES de supabase/frentes.sql
--
-- Rodar inteiro no SQL Editor, FORA de transação, com o admin fechado. Cria três
-- cópias datadas (artefatos, etapas, progresso) e as tranca: tabela nova em
-- public nasce exposta ao PostgREST. O backup fica separado da migração de
-- propósito: se frentes.sql falhar e fizer rollback, este retrato sobrevive.
-- Apagar as _bkp_ 30 dias depois de a Progressão nova estar no ar.
-- ============================================================================

create table if not exists public._bkp_20260906_artifacts      as select * from public.artifacts;
create table if not exists public._bkp_20260906_artifact_steps as select * from public.artifact_steps;
create table if not exists public._bkp_20260906_step_progress  as select * from public.step_progress;

alter table public._bkp_20260906_artifacts      enable row level security;
alter table public._bkp_20260906_artifact_steps enable row level security;
alter table public._bkp_20260906_step_progress  enable row level security;
revoke all on public._bkp_20260906_artifacts, public._bkp_20260906_artifact_steps,
              public._bkp_20260906_step_progress from anon, authenticated;

-- Números de referência (06/09/2026: 287 feitos, 43 etapas, 7 artefatos).
select (select count(*) from public._bkp_20260906_step_progress where feito) as feito_bkp,
       (select count(*) from public._bkp_20260906_artifact_steps)            as etapas_bkp,
       (select count(*) from public._bkp_20260906_artifacts)                 as artefatos_bkp;

-- Títulos atuais por artefato: conferir com o bloco CATALOGO de frentes.sql
-- antes de rodar (grafia, acento, espaço). Renome em posição usa a ordem, não o
-- título, mas a contagem de etapas por artefato tem que bater.
select a.nome, s.ordem, s.titulo, s.id,
       (select count(*) from public.step_progress p where p.step_id = s.id and p.feito) as marcas
from public.artifact_steps s join public.artifacts a on a.id = s.artifact_id
order by a.nome, s.ordem, s.criado_em;

-- Marcações por mentorado, para a prova do depois.
select member_id, count(*) as feitas
from public.step_progress where feito
group by 1 order by 1;
