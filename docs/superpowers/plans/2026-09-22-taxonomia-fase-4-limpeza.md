# Taxonomia dos Artefatos — Fase 4 (limpeza e backlog) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar do produto o que a taxonomia tornou morto (aba Tarefas, `tasks`, `toggle_task`, `pilar`), endurecer o banco (trigger tolerante, guard área × frente) e fechar o backlog barato dos reviews (frente exclusiva, `semCriterio`, hint, detalhe após confirm, `feito_em`, recorrência de rotina).

**Architecture:** Um SQL idempotente (`supabase/limpeza.sql`) dropa `tasks`/`toggle_task`/`pilar` com snapshot trancado e recria dois triggers; a UI perde a aba Tarefas (admin e /membros/), a visão geral passa a resumir demandas atrasadas, e o quadro ganha a recorrência de rotina ("Criar a próxima ocorrência?"). `demands.projeto_legado` **fica** (spec §7 fase 4: um ciclo depois, com confirmação do Felipe).

**Tech Stack:** HTML estático + JS sem build (`public/assets/*.js`), Supabase (Postgres, RLS), testes `node --test` por marcadores.

**Spec:** `docs/superpowers/specs/2026-09-21-taxonomia-artefatos-demandas-design.md` §6.5, §7 fase 4, §8. Reviews das fases 2 e 3 (backlog) registrados na memória do projeto e nos PRs #5/#6.

## Global Constraints

- **Estado do banco:** `tasks` existe com 0 linhas; `toggle_task(uuid)` existe; `artifact_groups.pilar` existe (valores preservados em `_bkp_20260921_artifact_groups`); `demands.projeto_legado` existe e **não é dropado nesta fase**. Trigger `demands_herda_artefato` existe (versão da fase 1).
- **Tabela nova em `public` nasce trancada** (RLS + `revoke all ... from anon, authenticated`) na mesma transação.
- **Nenhum `artifact_steps.id` muda; `step_progress` intocado.** O único `drop table` é `public.tasks`.
- **Jornada:** "o médico não opera o gestor interno"; ação do mentorado = etapa `trava` + demanda da CS. Por isso Tarefas sai inteira, sem substituto na área do mentorado.
- **Recorrência de rotina:** ao concluir demanda cuja etapa é `rotina`, perguntar "Criar a próxima ocorrência?" (não criar sozinho); próxima = cópia (título, descrição, prioridade, responsáveis, mentorado, frente, etapa) com `status = 'A fazer'`, `origem = 'Rotina · <etapa>'`, `vence_em = max(vence_em atual, hoje) + cadencia_dias` (7 se a etapa não tiver cadência). Para etapa `rotina` **não** se pergunta "marcar a etapa" (marcar rotina = ligar/desligar, não concluir).
- **Frente exclusiva** (artefato com `member_id`) só aparece no menu/formulário quando a demanda é daquele mentorado.
- Testes: `node --test tests/graduacao.test.mjs tests/progress-notes.test.cjs tests/cerebro-preview.test.mjs tests/areas-admin.test.cjs tests/areas-membros.test.cjs tests/areas-sql.test.cjs tests/frentes-sql.test.cjs tests/frentes-demandas.test.cjs tests/limpeza-sql.test.cjs` (baseline 32).
- Commits com `git -c user.name="Felipe Melo" -c user.email="felipentys@gmail.com"` e trailer exato `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Branch `olympusperformance/taxonomia-fase-4-limpeza` a partir de `main` (`21812fc`).
- Ordem do deploy: SQL (com dry-run/rollback) e merge em seguida. Entre um e outro a UI velha tentaria ler `tasks` (aba Tarefas vazia com erro tolerado? **não**: `Club.data.tasks.list` não é `tolerante` → o `Promise.all` do admin rejeita e o painel cai). **Portanto nesta fase a ordem é invertida: merge/deploy primeiro, SQL depois.** A UI nova não lê `tasks` nem `pilar`.

---

### Task 1: `supabase/limpeza.sql` + guarda textual

**Files:** Create `supabase/limpeza.sql`, `tests/limpeza-sql.test.cjs`. Modify `README.md`.

- [ ] Teste (RED): arquivo existe; contém `drop function if exists public.toggle_task(uuid)`, `drop table if exists public.tasks`, `alter table public.artifact_groups drop column if exists pilar`; todo `drop table` cita `tasks`; não cita `projeto_legado` em `drop`; snapshot `_bkp_20260922_tasks` criado, com RLS e revoke; `\ncommit;` uma vez; sem `\b`; não toca `artifact_steps`/`step_progress`.
- [ ] Script:

```sql
-- ============================================================================
-- Limpeza: fase 4 da taxonomia de 21/09/2026
-- Roda DEPOIS do deploy da UI da fase 4 (a UI velha lia tasks e pilar).
-- Idempotente. Snapshot trancado antes de cada drop.
--   1. tasks + toggle_task: a jornada diz que o médico não opera o gestor
--      interno; ação dele é etapa trava + demanda da CS. Tabela com 0 linhas.
--   2. artifact_groups.pilar: a UI parou de ler na fase 2; valores em
--      _bkp_20260921_artifact_groups.
--   3. demands_herda_artefato tolerante: só re-deriva a frente quando a etapa
--      muda; etapa inexistente vira null (deixa o FK on delete set null em paz).
--   4. Guard: área da equipe só recebe frente interna, e vice-versa.
-- demands.projeto_legado FICA (um ciclo depois, com aval do Felipe).
-- ============================================================================
begin;

create table if not exists public._bkp_20260922_tasks as select * from public.tasks;
alter table public._bkp_20260922_tasks enable row level security;
revoke all on public._bkp_20260922_tasks from anon, authenticated;

drop function if exists public.toggle_task(uuid);
drop table if exists public.tasks;

alter table public.artifact_groups drop column if exists pilar;

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

-- PROVA
-- select to_regclass('public.tasks') as tasks, to_regprocedure('public.toggle_task(uuid)') as toggle;         -- null, null
-- select count(*) from information_schema.columns where table_name='artifact_groups' and column_name='pilar'; -- 0
-- select relname, relrowsecurity from pg_class where relname = '_bkp_20260922_tasks';                          -- true
-- select tgname from pg_trigger where tgname in ('demands_herda_artefato','artifacts_casa_com_area');          -- 2
-- select count(*) from public.step_progress;                                                                    -- 633
```
- [ ] README: linha da árvore ganha `, limpeza (limpeza.sql)`; comando de testes ganha `tests/limpeza-sql.test.cjs`.
- [ ] Commit: `Limpeza: SQL da fase 4 (tasks, toggle_task, pilar; triggers tolerante e guard área × frente)`.

### Task 2: Tarefas sai (admin, área do mentorado, dados) e a visão geral resume demandas

**Files:** `public/assets/admin.js`, `public/admin/index.html`, `public/assets/club-data.js`, `public/assets/membros.js`, `public/membros/index.html`.

- [ ] `club-data.js`: remove `COLUNAS.tasks`, o bloco `tasks: { list, save, remove, toggle }` e a linha do cabeçalho `Club.data.tasks.list({memberId})`.
- [ ] `admin.js`: `st` sem `tasks: []`; NAV sem `{ key:'tasks' … }`; `carregar` sem `Club.data.tasks.list()` e destructuring reindexado (members r0, events r1, artifacts r2, materials r3, demands r4, staff r5, steps r6, progress r7, demandSteps r8, botExemplos r9, botRespostas r10, igResumo r11, igSerie r12, groups r13, progressNotes r14, qrLinks r15, qrScans r16); `renderNav` rodapé conta demandas abertas; `renderOverview` com cartão `DEMANDAS EM ABERTO` (+ atrasadas) e `#atrasadas` = `tabelaDemandasAtrasadas(rows)` (título abre o detalhe via `data-detalhe-demanda`, contexto = área · frente ou mentorado, responsáveis, prazo); bloco `/* ── tarefas ─` … até `/* ── agenda ─` removido; `TIPOS.task` e `MODAIS.task` removidos; aviso de remover membro sem "tarefas"; ramo `#filtroStatus` do clique e listener `#filtroMembro` removidos; `render()` sem `renderTasks()`; comentários (linha 4 e o parágrafo "Tarefa não entra aqui") atualizados.
- [ ] `admin/index.html`: seção da visão geral vira "Demandas atrasadas"; view `data-view="tasks"` removida.
- [ ] `membros.js`: `st` sem `tasks`, `status`, `categoria`; NAV sem Tarefas; `carregar` sem tasks (events r0, artifacts r1, materials r2, steps r3, progress r4, groups r5); bloco tarefas removido; `render()` sem `renderTasks()`; ramos `#filtroStatus` e `.task` do clique removidos.
- [ ] `membros/index.html`: seção "Tarefas" da capa e view `tasks` removidas; a seção Artefatos da capa continua `col-6` (ocupa a linha inteira no grid de 6).
- [ ] Testes: `node --check` nos 3 JS; suíte completa; grep de `tasks|Tarefa|renderTasks|modalTarefa|toggle_task` em `public/assets/*.js public/**/index.html` devolve só "subtarefa".
- [ ] Commit: `Tarefas sai: ação do mentorado é etapa trava + demanda da CS; visão geral resume demandas atrasadas`.

### Task 3: Backlog do quadro + recorrência de rotina

**Files:** `public/assets/admin.js`, `tests/frentes-demandas.test.cjs`, `tests/areas-sql.test.cjs`.

- [ ] Teste (RED) `proximaOcorrencia(d, e, hojeISO)`: prazo passado → hoje + cadência; prazo futuro → prazo + cadência; sem cadência → 7; copia título/prioridade/responsáveis/mentorado/frente/etapa, `status 'A fazer'`, `origem 'Rotina · <etapa>'`, não copia `id`. Teste `itensMenuFrente(atual, memberId)` esconde artefato exclusivo de outro mentorado e mostra o do próprio.
- [ ] `hojeISO()` helper (data local `YYYY-MM-DD`), usado por `prefillDaEtapa` e `proximaOcorrencia`.
- [ ] `itensMenuFrente(atual, memberId)` filtra `!a.member_id || a.member_id === memberId`; chamadas em `menuDaCelula` (`r.member_id`) e `modalDemanda` (`d.member_id`).
- [ ] `renderArtifacts`: `semCriterio` ignora `tipo === 'interna'`.
- [ ] `modalDemanda`: `campoPick('Etapa do checklist', 'step_id', 'pkEtapa', d.step_id || '')` sem hint (o host já explica).
- [ ] `mudarStatus`: para etapa `rotina` → modal "Criar a próxima ocorrência?" (`Club.data.demands.save(prox)` + `recarregarDemandas`); senão fluxo atual de "Marcar a etapa também?", que ao confirmar reabre o detalhe se `st.detalheModal` estava aberto.
- [ ] `linhaEtapa`: contador **e** `feito_em` (não um ou outro).
- [ ] `tests/areas-sql.test.cjs`: as seis tabelas dentro do mesmo `revoke`.
- [ ] Commit: `Demandas: recorrência de rotina, frente exclusiva só do próprio mentorado, detalhe volta após marcar etapa`.

### Task 4: Review final, deploy, banco

- [ ] Review final da branch (fable). Fix wave se precisar.
- [ ] PR → merge em `main` → esperar deploy (`curl … admin.js | grep -c tabelaDemandasAtrasadas`).
- [ ] **Depois** do deploy: dry-run de `limpeza.sql` com rollback (`select to_regclass('public.tasks')` → null antes do rollback), rodar de verdade, PROVA.
- [ ] Memória do projeto; relatório.

## Self-review
- Spec §6.5/§7 fase 4 coberto (Tarefas, `tasks`, `toggle_task`, `pilar`; `projeto_legado` explicitamente adiado; recorrência incluída). Backlog dos reviews: 6 itens fechados aqui; `verDemandasDaEtapa` persistir filtros fica como está (comportamento aceitável, registrado).
- Ordem deploy → SQL justificada (UI velha rejeitaria o `Promise.all`).
