# Taxonomia dos Artefatos — Fases 1 e 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar o catálogo de artefatos em áreas que espelham a jornada do mentorado (banco + admin + área do mentorado), sem tocar em nenhuma marcação de progresso e sem ainda mexer na aba Demandas.

**Architecture:** Fase 1 é um script SQL idempotente novo (`supabase/areas.sql`) que adiciona colunas (`artifact_groups.interna`, `artifacts.tipo`, `demands.artifact_id`, `demands.step_id`), renomeia/redistribui os grupos em cinco áreas do mentorado, cria três artefatos novos com checklist e fecha o RLS para frente interna. Fase 2 troca "grupo" por "área" na UI, remove o pilar, ensina `artefatosDe` e `/membros/` a ignorar `tipo = 'interna'` e agrupa os cartões do mentorado por área. Áreas de equipe e frentes internas **não** são criadas nestas fases (só na fase 3, junto com Demandas).

**Tech Stack:** HTML estático + JS sem build (`public/assets/*.js`, IIFEs sobre `window.Club`), Supabase (Postgres + RLS + PostgREST), testes com `node --test` extraindo trechos do código por marcadores (padrão de `tests/progress-notes.test.cjs`).

**Spec:** `docs/superpowers/specs/2026-09-21-taxonomia-artefatos-demandas-design.md` (§2 taxonomia, §3 modelo, §5 checklists, §6.1/6.2/6.4 UI, §7 fases 1 e 2, §7.5 verificação).

## Global Constraints

- **Nenhum `artifact_steps.id` muda.** Proibido apagar ou recriar etapa de artefato existente. Só rename de artefato, troca de `group_id`, criação de área/artefato/etapa nova.
- **SQL no banco live só com autorização explícita do Felipe**, com snapshot `_bkp_20260921_*` antes, script idempotente, admin fechado durante a execução.
- **Áreas de equipe (`interna = true`) e frentes internas (`tipo = 'interna'`) não são semeadas nestas fases.** A UI precisa suportá-las (fase 2), mas os dados entram na fase 3.
- **Pilar sai da UI na fase 2, mas a coluna `artifact_groups.pilar` só é dropada na fase 4.** Nenhum código pode depender dela depois da fase 2.
- **`demands.projeto` continua intocado** nestas fases (rename para `projeto_legado` é fase 3).
- Nomes exatos das áreas do mentorado e ordem: `Onboarding` (1) · `Tecnologia e dados` (2) · `Presença e conteúdo` (3) · `Geração de demanda` (4) · `Comercial da clínica` (5).
- Nomes exatos dos artefatos novos: `Onboarding`, `AEO`, `Treinamento comercial`. Rename: `Trackeamento` → `Tracker Black`.
- `artifacts.status` só aceita `Disponível` · `Em produção` · `Bloqueado`. Artefatos novos nascem `Em produção`.
- Ícones válidos (`Club.ART_ICONES`): `grid`, `play-circle`, `layout`, `zap`, `file-text`, `video`, `box`, `award`, `settings`, `link`.
- Siglas de `staff.apelido` em uso: FM (Felipe), IM (Ítalo), JF (João Felipe), KK (Kellen, CS), LZ (Lenize), PL (Pedro Larry), TA (Thomas).
- Commits com autor `Felipe Melo <felipentys@gmail.com>` (o worktree não tem identidade global; use `git -c user.name=... -c user.email=...`) e rodapé `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Testes: `node --test tests/graduacao.test.mjs tests/progress-notes.test.cjs tests/cerebro-preview.test.mjs tests/areas-admin.test.cjs tests/areas-membros.test.cjs` (listar arquivos; `node --test tests/` falha no Node 24). Baseline hoje: 13 passam.

---

## Mapa de arquivos

| Arquivo | Responsabilidade nestas fases |
|---|---|
| `supabase/areas.sql` (novo) | Fase 1 inteira: snapshot, DDL, áreas, moves, artefatos novos, RLS, bloco PROVA comentado no fim |
| `public/assets/club-data.js` | Whitelist `COLUNAS` (`tipo`, `interna`, sem `pilar`); `groups.save` normaliza `interna` |
| `public/assets/club-ui.js` | Remove `C.PILARES` |
| `public/assets/admin.js` | Aba Artefatos (`cabecalhoGrupo`, `renderArtifacts`, `linhaCatalogo`, `modalGrupo`, `modalArtefato`) e Progressão (`artefatosDe`, `faixaGrupo`) |
| `public/admin/index.html` | Textos "grupo" → "área" na aba Artefatos |
| `public/assets/membros.js` | Carrega áreas, filtra `tipo`, agrupa cartões por área (`agruparPorArea`) |
| `public/membros/index.html` | `#artListFull` deixa de ser `.artgrid` (as grades ficam dentro de cada seção) |
| `public/assets/club.css` | Espaço entre seções `.art-area` |
| `tests/areas-admin.test.cjs` (novo) | `cabecalhoGrupo` sem pilar e com rótulo de equipe; `artefatosDe` ignora interna; `COLUNAS`; nenhum `PILARES` no código |
| `tests/areas-membros.test.cjs` (novo) | `agruparPorArea` ordena por área e exclui interna |
| `README.md` | Uma linha sobre `supabase/areas.sql` e o comando de teste |

---

### Task 1: Script SQL da fase 1 (`supabase/areas.sql`)

**Files:**
- Create: `supabase/areas.sql`
- Modify: `README.md` (seção "Estrutura", lista de `supabase/`)

**Interfaces:**
- Produces: colunas `artifact_groups.interna boolean not null default false`, `artifacts.tipo text not null default 'artefato' check in ('artefato','interna')`, `demands.artifact_id uuid null`, `demands.step_id uuid null`; trigger `demands_herda_artefato`; áreas e artefatos com os nomes das Global Constraints. As Tasks 3–6 dependem desses nomes de coluna.

- [ ] **Step 1: Escrever o script**

Crie `supabase/areas.sql` com este conteúdo (segue o estilo de `supabase/frentes.sql`: cabeçalho explicando, `begin`/`commit`, PROVA depois):

```sql
-- ============================================================================
-- Áreas da jornada: fase 1 da taxonomia de 21/09/2026
--
-- Spec: docs/superpowers/specs/2026-09-21-taxonomia-artefatos-demandas-design.md
-- Roda DEPOIS de frentes.sql e demandas.sql, inteiro, no SQL Editor, com o
-- admin fechado. Idempotente: rodar duas vezes deixa o banco igual.
--
-- O que muda:
--   1. artifact_groups ganha `interna` (área da equipe, invisível ao mentorado).
--      `pilar` fica na tabela até a fase 4; a UI deixa de ler na fase 2.
--   2. artifacts ganha `tipo` ('artefato' | 'interna'). Frente interna só
--      agrupa demandas; nunca tem etapa nem aparece para mentorado.
--   3. demands ganha artifact_id e step_id (nullable). Trigger: etapa
--      preenchida força a frente da etapa.
--   4. Quatro grupos viram cinco áreas do mentorado; sete artefatos trocam de
--      área; Trackeamento vira Tracker Black; nascem Onboarding, AEO e
--      Treinamento comercial com checklist em rascunho (status Em produção).
--   5. RLS: mentorado só lê artefato de tipo 'artefato' e área não interna.
--
-- Regra de ouro: NENHUM artifact_steps.id muda. Nada aqui apaga ou recria
-- etapa de artefato existente; step_progress não é tocado.
--
-- Áreas de equipe e frentes internas NÃO entram aqui (fase 3, com Demandas).
-- ============================================================================

begin;

-- ── 0. snapshot ─────────────────────────────────────────────────────────────

create table if not exists public._bkp_20260921_artifact_groups as select * from public.artifact_groups;
create table if not exists public._bkp_20260921_artifacts       as select * from public.artifacts;
create table if not exists public._bkp_20260921_artifact_steps  as select * from public.artifact_steps;
create table if not exists public._bkp_20260921_step_progress   as select * from public.step_progress;
create table if not exists public._bkp_20260921_demands         as select * from public.demands;
create table if not exists public._bkp_20260921_demand_steps    as select * from public.demand_steps;

-- ── 1. colunas novas ────────────────────────────────────────────────────────

alter table public.artifact_groups
  add column if not exists interna boolean not null default false;

alter table public.artifacts
  add column if not exists tipo text not null default 'artefato';
alter table public.artifacts drop constraint if exists artifacts_tipo_ck;
alter table public.artifacts add constraint artifacts_tipo_ck
  check (tipo in ('artefato', 'interna'));

alter table public.demands
  add column if not exists artifact_id uuid references public.artifacts(id) on delete set null,
  add column if not exists step_id     uuid references public.artifact_steps(id) on delete set null;
create index if not exists demands_artifact_idx on public.demands (artifact_id);
create index if not exists demands_step_idx     on public.demands (step_id);

-- Etapa escolhida decide a frente: gravar step_id de um artefato e artifact_id
-- de outro deixaria a demanda apontando para dois lugares.
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
  select artifact_id into v_art from public.artifact_steps where id = new.step_id;
  if v_art is null then
    raise exception 'Etapa % não existe.', new.step_id;
  end if;
  if new.artifact_id is not null and new.artifact_id <> v_art then
    raise exception 'A etapa pertence a outra frente.';
  end if;
  new.artifact_id := v_art;
  return new;
end;
$$;

drop trigger if exists demands_herda_artefato on public.demands;
create trigger demands_herda_artefato
  before insert or update of step_id, artifact_id on public.demands
  for each row execute function public.demanda_herda_artefato();

-- ── 2. áreas do mentorado ───────────────────────────────────────────────────
-- Rename em posição (mesmo id, artefatos seguem juntos). "Conteúdo" esvazia
-- no passo 3 e é apagado no fim deste bloco.

update public.artifact_groups set nome = 'Tecnologia e dados',  ordem = 2 where nome = 'Sistema Black';
update public.artifact_groups set nome = 'Presença e conteúdo', ordem = 3 where nome = 'SEO / Site';
update public.artifact_groups set nome = 'Geração de demanda',  ordem = 4 where nome = 'Tráfego';

insert into public.artifact_groups (nome, ordem) values
  ('Onboarding',           1),
  ('Comercial da clínica', 5)
on conflict (nome) do nothing;

update public.artifact_groups set interna = false
 where nome in ('Onboarding', 'Tecnologia e dados', 'Presença e conteúdo',
                'Geração de demanda', 'Comercial da clínica');

-- ── 3. artefatos: área, ordem, rename ───────────────────────────────────────
-- 'Trackeamento' e 'Tracker Black' entram os dois para o script rodar de novo.

update public.artifacts a
   set group_id = g.id, ordem = x.ordem
  from (values
    ('Sistema Black',         'Tecnologia e dados',  1),
    ('Trackeamento',          'Tecnologia e dados',  2),
    ('Tracker Black',         'Tecnologia e dados',  2),
    ('Site Institucional',    'Presença e conteúdo', 1),
    ('GBP',                   'Presença e conteúdo', 2),
    ('Linha Editorial',       'Presença e conteúdo', 4),
    ('Fábrica de Conteúdo',   'Presença e conteúdo', 5),
    ('Meta Ads',              'Geração de demanda',  1),
    ('Google Ads',            'Geração de demanda',  2),
    ('Funil VSL',             'Geração de demanda',  3),
    ('Quiz',                  'Geração de demanda',  4),
    ('Automação Instagram',   'Geração de demanda',  5),
    ('Agente de comentários', 'Geração de demanda',  6),
    ('SDR IA',                'Comercial da clínica', 1)
  ) as x(nome, area, ordem)
  join public.artifact_groups g on g.nome = x.area
 where a.nome = x.nome and a.member_id is null;

update public.artifacts
   set nome = 'Tracker Black'
 where nome = 'Trackeamento' and member_id is null;

update public.artifacts a
   set responsaveis = (select array_agg(s.id order by s.apelido)
                         from public.staff s where s.apelido in ('TA', 'FM'))
 where a.nome = 'Tracker Black' and a.member_id is null;

delete from public.artifact_groups g
 where g.nome = 'Conteúdo'
   and not exists (select 1 from public.artifacts a where a.group_id = g.id);

-- Responsáveis por área (sigla de staff.apelido; sigla inexistente é ignorada).
update public.artifact_groups g set responsaveis = r.ids
  from (
    select x.area, array_agg(s.id order by s.apelido) as ids
      from (values
        ('Onboarding', 'FM'), ('Onboarding', 'KK'),
        ('Tecnologia e dados', 'IM'), ('Tecnologia e dados', 'PL'),
        ('Tecnologia e dados', 'TA'), ('Tecnologia e dados', 'FM'),
        ('Presença e conteúdo', 'JF'), ('Presença e conteúdo', 'TA'), ('Presença e conteúdo', 'FM'),
        ('Geração de demanda', 'TA'), ('Geração de demanda', 'FM'), ('Geração de demanda', 'IM'),
        ('Comercial da clínica', 'FM'), ('Comercial da clínica', 'LZ')
      ) as x(area, sigla)
      join public.staff s on s.apelido = x.sigla
     group by x.area
  ) r
 where r.area = g.nome;

-- ── 4. artefatos novos (checklist em rascunho, spec §5) ─────────────────────

insert into public.artifacts
  (nome, subtitulo, icone, status, meta, member_id, group_id, ordem, tipo, responsaveis)
select x.nome, x.subtitulo, x.icone, 'Em produção', 'Checklist em rascunho', null, g.id, x.ordem, 'artefato',
       (select array_agg(s.id order by s.apelido) from public.staff s where s.apelido = any(x.siglas))
  from (values
    ('Onboarding',            'Do fechamento ao plano aceito na Growth',            'award',     'Onboarding',           1, array['FM', 'KK']),
    ('AEO',                   'Presença nas respostas de IA (ChatGPT, Gemini, Claude)', 'file-text', 'Presença e conteúdo', 3, array['FM']),
    ('Treinamento comercial', 'Diagnóstico do atendimento e treino com a Lenize',    'award',     'Comercial da clínica', 2, array['FM', 'LZ'])
  ) as x(nome, subtitulo, icone, area, ordem, siglas)
  join public.artifact_groups g on g.nome = x.area
 where not exists (select 1 from public.artifacts a where a.nome = x.nome and a.member_id is null);

create temp table catalogo (art text, ordem int, titulo text, tipo text, cad int) on commit drop;
insert into catalogo values
-- Onboarding (jornada 2)
('Onboarding', 0,  'Fechamento avisado pelo Dr. Alex: entrada no Club', 'aceite', null),
('Onboarding', 1,  'Primeiro contato pelo WhatsApp feito e dados da venda recuperados', 'entrega', null),
('Onboarding', 2,  'Dados repassados à Carol; contrato e link de pagamento enviados', 'entrega', null),
('Onboarding', 3,  'Contrato assinado e primeiro pagamento confirmado', 'trava', null),
('Onboarding', 4,  'Formulário complementar devolvido', 'trava', null),
('Onboarding', 5,  'Grupo operacional criado e mentorado no grupo A ou B', 'entrega', null),
('Onboarding', 6,  'Acessos liberados (Área de Membros, Greenn, MLS) e primeiro acesso conferido', 'entrega', null),
('Onboarding', 7,  'Pesquisa da clínica e pauta da 1ª reunião prontas', 'entrega', null),
('Onboarding', 8,  '1ª reunião de onboarding realizada com o Dr. Alex; 5 indicações pedidas', 'entrega', null),
('Onboarding', 9,  'Plano inicial apresentado na Growth e aceite registrado', 'entrega', null),
('Onboarding', 10, 'Ações encaminhadas no quadro com responsável, prazo e entrega', 'entrega', null),
('Onboarding', 11, 'Integração validada pela CS (5 itens de 2.6)', 'entrega', null),
('Onboarding', 12, '2ª reunião agendada ao final do onboarding', 'opcional', null),
-- AEO (jornada 4.4)
('AEO', 0, 'Aceite da frente AEO', 'aceite', null),
('AEO', 1, 'Referência inicial registrada: presença nas respostas de IA, ativos existentes e lacunas', 'entrega', null),
('AEO', 2, 'Plano: melhorias, objetivos, resultado esperado e dependências', 'entrega', null),
('AEO', 3, 'Validações médicas do conteúdo entregues', 'trava', null),
('AEO', 4, 'Ações de AEO executadas nos ativos (site, artigos, perfis)', 'entrega', null),
('AEO', 5, 'Entregas conferidas e acompanhamento organizado', 'entrega', null),
('AEO', 6, 'Evolução avaliada na análise semanal', 'rotina', 7),
-- Treinamento comercial (jornada 5.1)
('Treinamento comercial', 0, 'Aceite do treinamento comercial', 'aceite', null),
('Treinamento comercial', 1, 'Estrutura comercial informada (SDR, closer, secretária, médico) e acesso a atendimentos e registros', 'trava', null),
('Treinamento comercial', 2, 'Diagnóstico: gargalos, evidências separadas de hipóteses', 'entrega', null),
('Treinamento comercial', 3, 'Plano adaptado à capacidade da clínica (Felipe e Lenize)', 'entrega', null),
('Treinamento comercial', 4, 'Treinamento realizado pela Lenize com o material do método', 'entrega', null),
('Treinamento comercial', 5, 'Combinados, responsáveis e aplicação esperada registrados', 'entrega', null),
('Treinamento comercial', 6, 'Aplicação e resultados acompanhados na análise semanal', 'rotina', 7),
('Treinamento comercial', 7, 'Reforço individual com Lenize sob demanda', 'opcional', null);

-- Só insere em artefato que ainda não tem etapa nenhuma: rodar de novo não
-- duplica, e artefato que alguém já editou no admin não é sobrescrito.
insert into public.artifact_steps (artifact_id, titulo, ordem, tipo, cadencia_dias)
select a.id, c.titulo, c.ordem, c.tipo, c.cad
  from catalogo c
  join public.artifacts a on a.nome = c.art and a.member_id is null
 where not exists (select 1 from public.artifact_steps s where s.artifact_id = a.id);

-- ── 5. RLS: mentorado não enxerga frente interna nem área da equipe ─────────

drop policy if exists "le os artefatos liberados" on public.artifacts;
create policy "le os artefatos liberados" on public.artifacts
  for select to authenticated
  using (public.is_admin()
         or (tipo = 'artefato'
             and (member_id is null or member_id = public.current_member_id())));

-- Hoje só o admin lê artifact_groups. A área do mentorado passa a agrupar os
-- cartões por área, então ele precisa ler as áreas que não são da equipe.
drop policy if exists "mentorado le as areas do mentorado" on public.artifact_groups;
create policy "mentorado le as areas do mentorado" on public.artifact_groups
  for select to authenticated
  using (public.is_admin() or not interna);

-- Política não dispara política: a regra de visibilidade do artefato é
-- repetida aqui (ver progresso.sql).
drop policy if exists "le as etapas dos artefatos liberados" on public.artifact_steps;
create policy "le as etapas dos artefatos liberados" on public.artifact_steps
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.artifacts a
       where a.id = artifact_steps.artifact_id
         and a.tipo = 'artefato'
         and (a.member_id is null or a.member_id = public.current_member_id())
    )
  );

notify pgrst, 'reload schema';
commit;

-- ============================================================================
-- PROVA (mesma sessão, depois do commit). Esperado em 21/09/2026: 633 / 618.
-- ============================================================================

-- 1. progresso intacto
-- select count(*) as linhas, count(*) filter (where feito) as feitas from public.step_progress;

-- 2. mesmos step_ids por artefato que o snapshot (esperado: zero linhas)
-- select a.id, array_agg(s.id order by s.ordem)
--   from public.artifacts a join public.artifact_steps s on s.artifact_id = a.id group by a.id
-- except
-- select a.id, array_agg(s.id order by s.ordem)
--   from public._bkp_20260921_artifacts a join public._bkp_20260921_artifact_steps s on s.artifact_id = a.id group by a.id;

-- 3. cinco áreas, nenhuma interna, 16 artefatos, nenhum sem área, nenhum tipo interna
-- select g.ordem, g.nome, g.interna, count(a.id) as artefatos
--   from public.artifact_groups g left join public.artifacts a on a.group_id = g.id
--  group by 1, 2, 3 order by 1;
-- select count(*) filter (where group_id is null) as sem_area,
--        count(*) filter (where tipo = 'interna') as internas,
--        count(*) as total
--   from public.artifacts where member_id is null;
-- esperado: Onboarding 1 · Tecnologia e dados 2 · Presença e conteúdo 5 ·
--           Geração de demanda 6 · Comercial da clínica 2 → 16; 0 / 0 / 16

-- 4. artefatos novos com checklist (13 / 7 / 8)
-- select a.nome, count(s.id) from public.artifacts a join public.artifact_steps s on s.artifact_id = a.id
--  where a.nome in ('Onboarding', 'AEO', 'Treinamento comercial') group by 1 order by 1;

-- 5. "Conteúdo" e "Trackeamento" não existem mais
-- select nome from public.artifact_groups where nome in ('Conteúdo', 'SEO / Site', 'Tráfego', 'Sistema Black');
-- select nome from public.artifacts where nome = 'Trackeamento';
```

- [ ] **Step 2: Conferir sintaxe sem tocar no banco**

Não há Postgres local. Confira o arquivo por leitura: cada `values (...)` do passo 3 tem três colunas; o passo 4 tem seis; nenhum `delete` em `artifact_steps`; `commit` é a última instrução antes do bloco comentado.

Run: `grep -c "delete from public.artifact_steps" supabase/areas.sql`
Expected: `0`

- [ ] **Step 3: Documentar no README**

Em `README.md`, na árvore da seção "Estrutura", a linha `supabase/              # SQL do banco: tabelas, RLS, acervo, demandas, progresso` passa a ser:

```
supabase/              # SQL do banco: tabelas, RLS, acervo, demandas, progresso, áreas (areas.sql)
```

E acrescente no fim do arquivo:

```markdown
## Áreas dos artefatos (21/09/2026)

`supabase/areas.sql` reorganiza o catálogo em áreas da jornada do mentorado e
prepara `demands.artifact_id`/`step_id`. Roda depois de `frentes.sql` e
`demandas.sql`, com o admin fechado; o bloco PROVA no fim do arquivo diz o que
conferir. Spec e plano em `docs/superpowers/`.

Testes de regressão: `node --test tests/graduacao.test.mjs tests/progress-notes.test.cjs tests/cerebro-preview.test.mjs tests/areas-admin.test.cjs tests/areas-membros.test.cjs`
```

- [ ] **Step 4: Commit**

```bash
git add supabase/areas.sql README.md
git -c user.name="Felipe Melo" -c user.email="felipentys@gmail.com" commit -m "Áreas: SQL da fase 1 (colunas, cinco áreas, artefatos novos, RLS)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Rodar a fase 1 no banco (gate humano)

**Files:** nenhum no repo. Banco Supabase `zpyxnkuvircukjlfexrv`.

**Interfaces:**
- Consumes: `supabase/areas.sql` da Task 1.
- Produces: banco com as colunas e áreas que as Tasks 3–7 pressupõem. **As Tasks 3–7 podem ser escritas antes, mas o deploy da fase 2 só depois desta.**

- [ ] **Step 1: Pedir autorização explícita do Felipe**

Mostre o resumo: snapshot de 6 tabelas, 4 colunas novas, 1 trigger, 3 renames de grupo, 2 áreas novas, 14 updates de `group_id`, 1 rename de artefato, 3 artefatos novos com 28 etapas, 3 políticas RLS. Zero deletes fora do grupo vazio "Conteúdo". **Não prossiga sem um "pode rodar" literal.**

- [ ] **Step 2: Dry-run com rollback**

Pela Management API (skill `demandas-admin`, token em `~/.secrets/supabase-olympus.token`, corpo em arquivo no scratchpad), monte um JSON cujo `query` é o script inteiro **com a linha `commit;` trocada por**:

```sql
select count(*) as linhas, count(*) filter (where feito) as feitas from public.step_progress;
```

seguida de `rollback;`. A API devolve o resultado da última consulta antes do rollback.

Expected: `[{"linhas":633,"feitas":618}]` e HTTP 201. Qualquer erro 400 → corrigir o script (Task 1) antes de seguir.

Repita o dry-run trocando a consulta final pelo `except` da PROVA 2. Expected: `[]`.

- [ ] **Step 3: Rodar de verdade**

Mesmo pedido, agora com o script original (com `commit;`). Expected: HTTP 201.

- [ ] **Step 4: Rodar as cinco consultas da PROVA, uma por pedido**

Expected: (1) `633 / 618`; (2) `[]`; (3) cinco áreas com `interna = false` e 1·2·5·6·2 artefatos, `sem_area 0 / internas 0 / total 16`; (4) Onboarding 13, AEO 7, Treinamento comercial 8; (5) duas listas vazias.

- [ ] **Step 5: Conferir a UI atual ainda no ar**

Abra `oftalmoblack.com.br/admin` → Artefatos: cinco grupos com os nomes novos, pilar antigo ainda aparecendo no subtítulo (some na fase 2). Progressão de um mentorado (João Vitor): mesmos percentuais de antes (Meta Ads 17/17, SDR IA 15/15, Sistema Black 12/13, Quiz 12/14, Funil VSL 6/16, Tracker Black 4/15, GBP 3/17).

- [ ] **Step 6: Registrar na memória do projeto**

Atualizar `C:\Users\felip\.claude\projects\C--Users-felip-orca-oftalmoblack-site\memory\taxonomia-artefatos-demandas-2026-09-21.md` com a data em que a fase 1 rodou e o resultado das provas.

---

### Task 3: `club-data.js` — colunas novas e `interna`

**Files:**
- Modify: `public/assets/club-data.js:24-58` (`COLUNAS`), `:263-274` (`groups.save`)
- Test: `tests/areas-admin.test.cjs` (novo; os testes das Tasks 4 e 5 entram no mesmo arquivo)

**Interfaces:**
- Produces: `Club.data.groups.save(g)` aceita `g.interna` (boolean) e o grava; `Club.data.artifacts.save(a)` aceita `a.tipo`. `COLUNAS.artifact_groups` sem `pilar`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/areas-admin.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function source(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function extract(file, start, end) {
  const src = source(file);
  const a = src.indexOf(start), b = src.indexOf(end, a);
  assert(a >= 0 && b > a, 'marcador não encontrado em ' + file + ': ' + start);
  return src.slice(a, b);
}

test('COLUNAS aceita tipo do artefato e interna da área, e esquece o pilar', () => {
  const code = extract('public/assets/club-data.js', '  var COLUNAS = {', '  /* Campo de data');
  const ctx = vm.createContext({});
  vm.runInContext(code + '\nthis.COLUNAS = COLUNAS;', ctx);
  assert.ok(ctx.COLUNAS.artifacts.includes('tipo'));
  assert.ok(ctx.COLUNAS.artifact_groups.includes('interna'));
  assert.ok(!ctx.COLUNAS.artifact_groups.includes('pilar'));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/areas-admin.test.cjs`
Expected: FAIL em `artifacts.includes('tipo')`.

- [ ] **Step 3: Editar `COLUNAS`**

Em `public/assets/club-data.js`, troque:

```js
    artifacts: ['member_id', 'nome', 'subtitulo', 'icone', 'status', 'meta', 'url',
                'group_id', 'ordem', 'responsaveis'],
    artifact_groups: ['nome', 'pilar', 'ordem', 'responsaveis'],
```

por:

```js
    /* tipo e interna chegam com supabase/areas.sql (fase 1 da taxonomia).
       pilar saiu da UI; a coluna só cai do banco na fase 4. */
    artifacts: ['member_id', 'nome', 'subtitulo', 'icone', 'status', 'meta', 'url',
                'group_id', 'ordem', 'responsaveis', 'tipo'],
    artifact_groups: ['nome', 'ordem', 'responsaveis', 'interna'],
```

- [ ] **Step 4: Normalizar `interna` em `groups.save` e atualizar o comentário**

Troque o bloco:

```js
    /* Grupo acima do artefato (SEO / Site, Conteúdo, Tráfego, Sistema Black).
       Tabela artifact_groups, criada por supabase/frentes.sql. Enquanto não
       existe, a aba Artefatos fica plana e avisa. */
    groups: {
      list: function () {
        C.faltaGrupos = null;
        return tolerante(sb().from('artifact_groups').select('*'), AVISO_GRUPOS, 'faltaGrupos')
          .then(function (r) { return r.sort(byOrdemNome); });
      },
      save: function (g) {
        var reg = Object.assign({}, g);
        if ('ordem' in reg) reg.ordem = parseInt(reg.ordem, 10) || 0;
        return grava('artifact_groups', reg);
      },
```

por:

```js
    /* Área acima do artefato (Onboarding, Tecnologia e dados, Presença e
       conteúdo, Geração de demanda, Comercial da clínica). Tabela
       artifact_groups, criada por supabase/frentes.sql e estendida por
       supabase/areas.sql. `interna` marca área da equipe, que só agrupa
       demandas e nunca chega ao mentorado. Enquanto a tabela não existe, a
       aba Artefatos fica plana e avisa. */
    groups: {
      list: function () {
        C.faltaGrupos = null;
        return tolerante(sb().from('artifact_groups').select('*'), AVISO_GRUPOS, 'faltaGrupos')
          .then(function (r) { return r.sort(byOrdemNome); });
      },
      save: function (g) {
        var reg = Object.assign({}, g);
        if ('ordem' in reg) reg.ordem = parseInt(reg.ordem, 10) || 0;
        reg.interna = !!reg.interna;
        return grava('artifact_groups', reg);
      },
```

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test tests/areas-admin.test.cjs`
Expected: PASS (1 teste).

- [ ] **Step 6: Commit**

```bash
git add public/assets/club-data.js tests/areas-admin.test.cjs
git -c user.name="Felipe Melo" -c user.email="felipentys@gmail.com" commit -m "Áreas: club-data grava tipo do artefato e interna da área, sem pilar" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Aba Artefatos — área no lugar de grupo, sem pilar, com `tipo`

**Files:**
- Modify: `public/assets/club-ui.js:78-84` (remove `C.PILARES`)
- Modify: `public/assets/admin.js:1903-1940` (`linhaCatalogo`), `:1967-1976` (`cabecalhoGrupo`), `:1978-2003` (`renderArtifacts`), `:2025-2052` (`modalGrupo`), `:2054-2125` (`modalArtefato`)
- Modify: `public/admin/index.html:213-220`
- Test: `tests/areas-admin.test.cjs`

**Interfaces:**
- Consumes: `COLUNAS` da Task 3.
- Produces: `cabecalhoGrupo(g, n)` lê `g.interna`; `modalArtefato` grava `d.tipo`; nenhum código lê `pilar` nem `Club.PILARES`.

- [ ] **Step 1: Acrescentar os testes que falham**

No fim de `tests/areas-admin.test.cjs`:

```js
function contextoCatalogo() {
  return vm.createContext({
    esc: s => String(s == null ? '' : s),
    siglas: ids => (ids || []).join(','),
    acoes: (tipo, id) => '<acts ' + tipo + ':' + id + '/>'
  });
}

test('cabeçalho da área não mostra pilar e marca área da equipe', () => {
  const code = extract('public/assets/admin.js', '  function cabecalhoGrupo(', '  function renderArtifacts(');
  const ctx = contextoCatalogo();
  vm.runInContext(code + '\nthis.cabecalhoGrupo = cabecalhoGrupo;', ctx);
  const mentorado = ctx.cabecalhoGrupo({ id:'g1', nome:'Geração de demanda', pilar:'P07 Máquina Black de Tráfego', responsaveis:['TA'], interna:false }, 6);
  assert.ok(mentorado.includes('Geração de demanda'));
  assert.ok(mentorado.includes('6 artefatos'));
  assert.ok(!mentorado.includes('P07'), 'pilar não pode aparecer');
  assert.ok(!mentorado.includes('equipe'));
  const equipe = ctx.cabecalhoGrupo({ id:'g2', nome:'Operação Olympus', responsaveis:[], interna:true }, 1);
  assert.ok(equipe.includes('equipe'));
  assert.ok(equipe.includes('1 frente'));
  assert.ok(equipe.includes('class="tr grp pai interna"'));
  const sem = ctx.cabecalhoGrupo(null, 2);
  assert.ok(sem.includes('Sem área'));
  assert.ok(!sem.includes('grupo'));
});

test('nenhum código lê pilar ou PILARES', () => {
  for (const file of ['public/assets/admin.js', 'public/assets/club-ui.js', 'public/assets/club-data.js', 'public/assets/membros.js']) {
    const src = source(file);
    assert.ok(!/PILARES/.test(src), file + ' ainda cita PILARES');
    assert.ok(!/\.pilar\b/.test(src), file + ' ainda lê .pilar');
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/areas-admin.test.cjs`
Expected: 2 novos testes FAIL (`P07` presente; `PILARES` presente).

- [ ] **Step 3: Remover `C.PILARES` de `club-ui.js`**

Apague estas linhas de `public/assets/club-ui.js`:

```js
  /* Pilares do método, atributo do grupo de artefatos. */
  C.PILARES = ['P01 Diagnóstico Black', 'P02 Presbiopia Mental', 'P03 Valor Único',
               'P04 Black Branding', 'P05 Sistema Black', 'P06 Referência Black',
               'P07 Máquina Black de Tráfego', 'P08 Ativação Black', 'P09 Chamada Consultiva',
               'P10 Vendas (In The Bag)', 'P11 Protocolo de Encantamento',
               'P12 Treino de Competição', 'P13 Recorrência Black', 'P14 Cérebro Black',
               'P15 Escala com Previsibilidade'];
```

- [ ] **Step 4: Reescrever `cabecalhoGrupo`**

Em `public/assets/admin.js`, troque a função inteira por:

```js
  /* Cabeçalho de uma área na aba Artefatos. Área da equipe (interna) só
     agrupa demandas: o rótulo "equipe" e a classe .interna dizem isso. */
  function cabecalhoGrupo(g, n) {
    var interna = !!(g && g.interna);
    var qtd = n + (interna ? ' frente' : ' artefato') + (n === 1 ? '' : 's');
    var sub = g
      ? [interna ? 'equipe' : null, siglas(g.responsaveis), qtd].filter(Boolean).join(' · ')
      : qtd + ' sem área';
    return '<div class="tr grp pai' + (interna ? ' interna' : '') + '">' +
      '<span class="grp-n">' + esc(g ? g.nome : 'Sem área') +
        ' <span class="tx-s" style="font-weight:400">' + esc(sub) + '</span></span>' +
      (g ? '<span>' + acoes('group', g.id) + '</span>' : '<span></span>') +
    '</div>';
  }
```

- [ ] **Step 5: Textos de `renderArtifacts`**

Na mesma função, troque:

```js
    $('filtroArtGrupo').innerHTML = '<option value="">Todos os grupos</option>' +
```
por
```js
    $('filtroArtGrupo').innerHTML = '<option value="">Todas as áreas</option>' +
```
e
```js
      }).join('') + '<option value="sem"' + (st.artGrupo === 'sem' ? ' selected' : '') + '>Sem grupo</option>';
```
por
```js
      }).join('') + '<option value="sem"' + (st.artGrupo === 'sem' ? ' selected' : '') + '>Sem área</option>';
```
e
```js
    $('artResumo').textContent = st.artifacts.length + ' artefatos · ' + st.groups.length + ' grupos' +
```
por
```js
    $('artResumo').textContent = st.artifacts.length + ' frentes · ' + st.groups.length + ' áreas' +
```
e o comentário `/* "Sem grupo" some quando está vazia: seria uma seção sem assunto. */` por `/* "Sem área" some quando está vazia: seria uma seção sem assunto. */`.

- [ ] **Step 6: `linhaCatalogo` reconhece frente interna**

Troque o corpo de `linhaCatalogo` por:

```js
  function linhaCatalogo(a) {
    var s = Club.ART_ST[a.status] || Club.ART_ST['Bloqueado'];
    var etapas = etapasDe(a.id);
    var interna = a.tipo === 'interna';
    return '<div class="tr' + (interna ? ' interna' : '') + '">' +
      '<div class="td"><span class="art-i" style="width:28px;height:28px;border-radius:8px;' +
        'font-size:14px;margin:0;flex-shrink:0">' + ico(a.icone || 'box') + '</span>' +
        '<div class="tx"><div class="tx tx-t" title="' + esc(a.nome) + '">' + esc(a.nome) + '</div>' +
        '<div class="tx tx-s">' + esc([a.subtitulo, a.member_id ? 'só ' + escopo(a.member_id) : null,
          siglas(a.responsaveis) ? 'dono ' + siglas(a.responsaveis) : null].filter(Boolean).join(' · ')) +
        '</div></div></div>' +
      '<div class="td"><div class="tx">' + (interna
        ? '<span class="tx-s">frente interna · só agrupa demandas</span>' : criterioDe(etapas)) + '</div></div>' +
      td('<span class="tx-s">' + esc(interna ? 'Interna' : tipoArtefato(etapas)) + '</span>') +
      '<div class="td"><div class="tx">' + (interna ? '<span class="tx-s">—</span>' : adocaoDe(a)) + '</div></div>' +
      td(status(s.color, a.status)) +
      '<div class="td end">' + acoes('artifact', a.id) + '</div>' +
    '</div>';
  }
```

- [ ] **Step 7: `modalGrupo` sem pilar, com `interna`**

Troque a função inteira por:

```js
  function modalGrupo(g) {
    g = g || { nome:'', ordem: st.groups.length + 1, responsaveis:[], interna:false };
    Club.modal.open({
      title: g.id ? 'Editar área' : 'Nova área',
      sub: g.id ? g.nome : 'Uma área da jornada do mentorado, ou uma área da equipe que só agrupa demandas.',
      body:
        Club.field('Nome', 'nome', { value:g.nome, required:true, placeholder:'Geração de demanda' }) +
        Club.field('Ordem', 'ordem', { value:g.ordem, type:'number' }) +
        Club.checkbox('Área da equipe (interna): não aparece para o mentorado nem na Progressão',
          'interna', !!g.interna) +
        (opcoesEquipe().length
          ? Club.select('Responsáveis', 'responsaveis', opcoesEquipe(), (g.responsaveis || [])[0],
              { multiple:true, hint:'Quem responde pela área. Segure Ctrl (ou Cmd) para mais de um.' })
          : ''),
      onSubmit: function (d) {
        if (!d.nome) { Club.toast('A área precisa de um nome.', 'alert'); return; }
        d.id = g.id;
        d.responsaveis = d.responsaveis || [];
        d.interna = !!d.interna;
        Club.data.groups.save(d).then(function () {
          Club.modal.close();
          recarregar(g.id ? 'Área atualizada.' : 'Área criada.');
        }).catch(aviso);
      }
    });
    marcarMultiplos('responsaveis', g.responsaveis);
  }
```

- [ ] **Step 8: `modalArtefato` com `tipo` e "Área"**

Na assinatura do default, acrescente `tipo:'artefato'`:

```js
    a = a || { nome:'', subtitulo:'', icone:'box', status:'Em produção', meta:'',
               url:'', member_id:null, group_id: st.artGrupo && st.artGrupo !== 'sem' ? st.artGrupo : null,
               ordem:0, responsaveis:[], tipo:'artefato' };
```

No `body`, troque:

```js
              Club.select('Grupo', 'group_id', [{ value:'', label:'Sem grupo' }].concat(
                st.groups.map(function (g) { return { value:g.id, label:g.nome }; })), a.group_id || '') +
              Club.field('Ordem no grupo', 'ordem', { value:a.ordem || 0, type:'number' }) +
```
por
```js
              Club.select('Área', 'group_id', [{ value:'', label:'Sem área' }].concat(
                st.groups.map(function (g) { return { value:g.id, label:g.nome + (g.interna ? ' (equipe)' : '') }; })), a.group_id || '') +
              Club.field('Ordem na área', 'ordem', { value:a.ordem || 0, type:'number' }) +
```
e o hint `'Quem move este artefato. Sem dono, vale o do grupo.'` por `'Quem move esta frente. Sem dono, vale o da área.'`.

Logo depois do `</div>'` que fecha o `fld-row` de Situação/Ícone, acrescente:

```js
        Club.select('Tipo', 'tipo', [
            { value:'artefato', label:'Artefato do mentorado (checklist e progresso)' },
            { value:'interna',  label:'Frente interna (só agrupa demandas)' }
          ], a.tipo || 'artefato',
          { hint:'Frente interna nunca aparece para o mentorado nem na Progressão. Use só em área da equipe.' }) +
```

No `onSubmit`, troque:

```js
        d.id = a.id;
        d.member_id = d.member_id || null;
        if (comGrupos) { d.group_id = d.group_id || null; d.responsaveis = d.responsaveis || []; }

        var titulos = String(d.etapas || '').split('\n')
          .map(function (l) { return l.trim(); })
          .filter(Boolean);
```
por
```js
        d.id = a.id;
        d.tipo = d.tipo === 'interna' ? 'interna' : 'artefato';
        /* Frente interna é da equipe: não é de mentorado nenhum e não tem checklist. */
        d.member_id = d.tipo === 'interna' ? null : (d.member_id || null);
        if (comGrupos) { d.group_id = d.group_id || null; d.responsaveis = d.responsaveis || []; }

        var titulos = d.tipo === 'interna' ? [] : String(d.etapas || '').split('\n')
          .map(function (l) { return l.trim(); })
          .filter(Boolean);
```
e
```js
        var trava = guardaPosicao(etapasAtuais, titulos);
        if (trava) { Club.toast(trava, 'alert'); return; }

        Club.data.artifacts.save(d).then(function (salvo) {
          /* O artefato novo só ganha id ao ser gravado, e a etapa precisa dele
             para saber de quem é — daí o checklist ir na sequência, não junto. */
          return Club.data.steps.sync(salvo.id, titulos, etapasAtuais);
        }).then(function () {
```
por
```js
        var trava = d.tipo === 'interna' ? null : guardaPosicao(etapasAtuais, titulos);
        if (trava) { Club.toast(trava, 'alert'); return; }
        if (d.tipo === 'interna' && etapasAtuais.length) {
          Club.toast('Frente interna não tem checklist. Apague as etapas antes de trocar o tipo.', 'alert');
          return;
        }

        Club.data.artifacts.save(d).then(function (salvo) {
          /* O artefato novo só ganha id ao ser gravado, e a etapa precisa dele
             para saber de quem é — daí o checklist ir na sequência, não junto.
             Frente interna não tem checklist: nada a sincronizar. */
          if (d.tipo === 'interna') return null;
          return Club.data.steps.sync(salvo.id, titulos, etapasAtuais);
        }).then(function () {
```

- [ ] **Step 9: Textos do `admin/index.html`**

Em `public/admin/index.html`, troque:

```html
      <div class="hello"><h1>Artefatos</h1><p>O catálogo do Club: o que existe, em que grupo, quem é o dono e o que precisa acontecer pro 100%.</p></div>
```
por
```html
      <div class="hello"><h1>Artefatos</h1><p>O catálogo do Club: o que existe, em que área da jornada, quem é o dono e o que precisa acontecer pro 100%.</p></div>
```
e
```html
        <button class="btn" data-new="group">
          <svg class="ic"><use href="#i-plus"/></svg>Novo grupo</button>
```
por
```html
        <button class="btn" data-new="group">
          <svg class="ic"><use href="#i-plus"/></svg>Nova área</button>
```

- [ ] **Step 10: Rodar e ver passar**

Run: `node --test tests/areas-admin.test.cjs`
Expected: 3 PASS. Se "nenhum código lê pilar" ainda falhar, é `faixaGrupo` na Progressão (Task 5): aceite esse único FAIL agora e siga.

- [ ] **Step 11: Commit**

```bash
git add public/assets/club-ui.js public/assets/admin.js public/admin/index.html tests/areas-admin.test.cjs
git -c user.name="Felipe Melo" -c user.email="felipentys@gmail.com" commit -m "Artefatos: área no lugar de grupo, tipo da frente, pilar fora do formulário" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Progressão — ignora frente interna e não mostra pilar

**Files:**
- Modify: `public/assets/admin.js:259-263` (`artefatosDe`), `:651-666` (`faixaGrupo`)
- Test: `tests/areas-admin.test.cjs`

**Interfaces:**
- Produces: `artefatosDe(memberId)` nunca devolve `tipo === 'interna'`. Tudo que a Progressão conta (`contaMembro`, `linhaMentorado`, `adocaoDe`) passa por ela.

- [ ] **Step 1: Acrescentar o teste que falha**

No fim de `tests/areas-admin.test.cjs`:

```js
test('artefatosDe devolve os da turma e os dele, nunca frente interna', () => {
  const code = extract('public/assets/admin.js', '  function artefatosDe(', '  /* ── tabela');
  const ctx = vm.createContext({ st: { artifacts: [
    { id:'turma',   nome:'GBP',            member_id:null, tipo:'artefato' },
    { id:'dele',    nome:'Encontro',       member_id:'m1', tipo:'artefato' },
    { id:'outro',   nome:'Só do m2',       member_id:'m2', tipo:'artefato' },
    { id:'interna', nome:'Olympus OS',     member_id:null, tipo:'interna' },
    { id:'legado',  nome:'Sem tipo ainda', member_id:null }
  ] } });
  vm.runInContext(code + '\nthis.artefatosDe = artefatosDe;', ctx);
  assert.deepEqual(ctx.artefatosDe('m1').map(a => a.id), ['turma', 'dele', 'legado']);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/areas-admin.test.cjs`
Expected: FAIL (a lista inclui `interna`).

- [ ] **Step 3: Filtrar `tipo` em `artefatosDe`**

Troque:

```js
  function artefatosDe(memberId) {
    return st.artifacts.filter(function (a) {
      return !a.member_id || a.member_id === memberId;
    });
  }
```
por
```js
  /* Frente interna (tipo 'interna') é da equipe: só agrupa demandas. Não
     entra na Progressão nem nas contas, mesmo estando em st.artifacts. */
  function artefatosDe(memberId) {
    return st.artifacts.filter(function (a) {
      return a.tipo !== 'interna' && (!a.member_id || a.member_id === memberId);
    });
  }
```

- [ ] **Step 4: `faixaGrupo` sem pilar**

Troque:

```js
    return '<div class="tr grp sub">' +
      '<span class="grp-n">' + esc(g ? g.nome : 'Sem grupo') +
        (g && g.pilar ? ' <span class="tx-s">· ' + esc(String(g.pilar).split(' ')[0]) + '</span>' : '') + '</span>' +
```
por
```js
    return '<div class="tr grp sub">' +
      '<span class="grp-n">' + esc(g ? g.nome : 'Sem área') + '</span>' +
```

E o comentário acima de `linhaMentorado` que diz `/* Faixa por grupo dentro do mentorado: ...` passa a `/* Faixa por área dentro do mentorado: com uma dezena de artefatos por pessoa, a lista não se lê sem agrupar. É cabeçalho, não nível: sem toggle, sem chave nova em abrirTudo. */`.

- [ ] **Step 5: Rodar tudo e ver passar**

Run: `node --test tests/graduacao.test.mjs tests/progress-notes.test.cjs tests/cerebro-preview.test.mjs tests/areas-admin.test.cjs`
Expected: 17 PASS, 0 FAIL (13 antigos + 4 novos).

- [ ] **Step 6: Commit**

```bash
git add public/assets/admin.js tests/areas-admin.test.cjs
git -c user.name="Felipe Melo" -c user.email="felipentys@gmail.com" commit -m "Progressão: frente interna fora das contas, faixa da área sem pilar" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Área do mentorado — cartões por área, sem frente interna

**Files:**
- Modify: `public/assets/membros.js:16-18` (`st`), `:55-67` (`carregar`), `:353-366` (`renderArtifacts`, com a nova `agruparPorArea` logo antes)
- Modify: `public/membros/index.html:119-122`
- Modify: `public/assets/club.css` (após a linha `.artgrid{...}`, ~299)
- Test: `tests/areas-membros.test.cjs` (novo)

**Interfaces:**
- Consumes: policy "mentorado le as areas do mentorado" (Task 1/2) para `Club.data.groups.list()` devolver linhas ao mentorado.
- Produces: `agruparPorArea(artefatos, grupos)` → `[{ grupo, itens }]`, sem `tipo === 'interna'`, ordenado por `grupo.ordem`, artefatos sem área por último em `{ grupo:null }`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/areas-membros.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function extract(file, start, end) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const a = src.indexOf(start), b = src.indexOf(end, a);
  assert(a >= 0 && b > a, 'marcador não encontrado: ' + start);
  return src.slice(a, b);
}

const grupos = [
  { id:'g4', nome:'Geração de demanda',  ordem:4, interna:false },
  { id:'g1', nome:'Onboarding',          ordem:1, interna:false },
  { id:'g3', nome:'Presença e conteúdo', ordem:3, interna:false }
];
const artefatos = [
  { id:'quiz',    nome:'Quiz',        group_id:'g4', ordem:4, tipo:'artefato' },
  { id:'meta',    nome:'Meta Ads',    group_id:'g4', ordem:1, tipo:'artefato' },
  { id:'gbp',     nome:'GBP',         group_id:'g3', ordem:2, tipo:'artefato' },
  { id:'os',      nome:'Olympus OS',  group_id:'g4', ordem:9, tipo:'interna' },
  { id:'solto',   nome:'Sem área',    group_id:null, ordem:0, tipo:'artefato' },
  { id:'legado',  nome:'Sem tipo',    group_id:'g1', ordem:1 }
];

test('agruparPorArea ordena por área, artefato por ordem, solto por último, interna fora', () => {
  const code = extract('public/assets/membros.js', '  function agruparPorArea(', '  function renderArtifacts(');
  const ctx = vm.createContext({});
  vm.runInContext(code + '\nthis.agruparPorArea = agruparPorArea;', ctx);
  const secoes = ctx.agruparPorArea(artefatos, grupos);
  assert.deepEqual(secoes.map(s => s.grupo ? s.grupo.nome : null),
    ['Onboarding', 'Presença e conteúdo', 'Geração de demanda', null]);
  assert.deepEqual(secoes[2].itens.map(a => a.id), ['meta', 'quiz']);
  assert.deepEqual(secoes[3].itens.map(a => a.id), ['solto']);
  assert.ok(!secoes.some(s => s.itens.some(a => a.id === 'os')), 'frente interna vazou');
});

test('área sem artefato visível não vira seção vazia', () => {
  const code = extract('public/assets/membros.js', '  function agruparPorArea(', '  function renderArtifacts(');
  const ctx = vm.createContext({});
  vm.runInContext(code + '\nthis.agruparPorArea = agruparPorArea;', ctx);
  const secoes = ctx.agruparPorArea([artefatos[0]], grupos);
  assert.equal(secoes.length, 1);
  assert.equal(secoes[0].grupo.nome, 'Geração de demanda');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/areas-membros.test.cjs`
Expected: FAIL com "marcador não encontrado" (função não existe).

- [ ] **Step 3: Estado e carga**

Em `public/assets/membros.js`, troque:

```js
  var st = { membro:null, tasks:[], events:[], artifacts:[], materials:[],
             steps:[], progress:[],
             status:'pending', categoria:'', matCategoria:'' };
```
por
```js
  var st = { membro:null, tasks:[], events:[], artifacts:[], materials:[],
             steps:[], progress:[], groups:[],
             status:'pending', categoria:'', matCategoria:'' };
```

E em `carregar`, troque:

```js
      return Promise.all([
        Club.data.tasks.list({ memberId: m.id }),
        Club.data.events.list({ memberId: m.id }),
        Club.data.artifacts.list({ memberId: m.id }),
        Club.data.materials.list({ memberId: m.id }),
        Club.data.steps.list(),
        Club.data.progress.list({ memberId: m.id })
      ]);
    }).then(function (r) {
      st.tasks = r[0]; st.events = r[1]; st.artifacts = r[2]; st.materials = r[3];
      st.steps = r[4]; st.progress = r[5];
    });
```
por
```js
      return Promise.all([
        Club.data.tasks.list({ memberId: m.id }),
        Club.data.events.list({ memberId: m.id }),
        Club.data.artifacts.list({ memberId: m.id }),
        Club.data.materials.list({ memberId: m.id }),
        Club.data.steps.list(),
        Club.data.progress.list({ memberId: m.id }),
        /* Áreas da jornada, para agrupar os cartões. O RLS só entrega as que
           não são da equipe (supabase/areas.sql). */
        Club.data.groups.list()
      ]);
    }).then(function (r) {
      st.tasks = r[0]; st.events = r[1]; st.artifacts = r[2]; st.materials = r[3];
      st.steps = r[4]; st.progress = r[5]; st.groups = r[6] || [];
    });
```

- [ ] **Step 4: `agruparPorArea` e novo `renderArtifacts`**

Troque a função `renderArtifacts` inteira (de `  function renderArtifacts() {` até o `  }` antes de `  /* ── agenda`) por:

```js
  /* ── artefatos por área ───────────────────────────────────────────────── */
  /* Uma seção por área, na ordem das áreas; artefato sem área vai por último.
     Frente interna (tipo 'interna') nunca chega aqui: o RLS a segura, e o
     filtro repete a regra por garantia. Área sem artefato visível não vira
     seção vazia. */
  function agruparPorArea(artefatos, grupos) {
    var porNome = function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); };
    var visiveis = artefatos.filter(function (a) { return a.tipo !== 'interna'; });
    var secoes = grupos.slice()
      .sort(function (a, b) { return ((a.ordem || 0) - (b.ordem || 0)) || porNome(a, b); })
      .map(function (g) {
        return { grupo:g, itens: visiveis
          .filter(function (a) { return a.group_id === g.id; })
          .sort(function (a, b) { return ((a.ordem || 0) - (b.ordem || 0)) || porNome(a, b); }) };
      });
    var soltos = visiveis.filter(function (a) {
      return !grupos.some(function (g) { return g.id === a.group_id; });
    }).sort(porNome);
    if (soltos.length) secoes.push({ grupo:null, itens:soltos });
    return secoes.filter(function (s) { return s.itens.length; });
  }

  function renderArtifacts() {
    var vazio = Club.empty('box', 'Nenhum artefato liberado ainda.');
    /* Disponibilidade independe de progresso: um artefato liberado aparece
       mesmo sem aceite ou etapas marcadas para este mentorado. Frente interna
       é da equipe e nunca aparece. */
    var meus = st.artifacts.filter(function (a) {
      return a.tipo !== 'interna' &&
        (a.status === 'Disponível' || !etapasDe(a.id).length || parDe(a).estado !== 'definir');
    });
    var secoes = agruparPorArea(meus, st.groups);
    var ordenados = secoes.reduce(function (acc, s) { return acc.concat(s.itens); }, []);

    /* Na capa cabe uma grade só, na ordem das áreas; na aba cheia, uma seção
       por área com o checklist inteiro. */
    $('artList').innerHTML = ordenados.length
      ? ordenados.map(function (a) { return cartaoArtefato(a, false); }).join('') : vazio;
    $('artListFull').innerHTML = secoes.length
      ? secoes.map(function (s) {
          return '<section class="art-area">' +
            '<div class="sec"><div class="sec-g">' +
              '<div class="sec-eb"><span class="sec-dash"></span><span>ÁREA</span></div>' +
              '<h2 class="sec-t">' + esc(s.grupo ? s.grupo.nome : 'Outros') + '</h2>' +
            '</div></div>' +
            '<div class="artgrid">' +
              s.itens.map(function (a) { return cartaoArtefato(a, true); }).join('') +
            '</div>' +
          '</section>';
        }).join('')
      : vazio;
    return ordenados.filter(function (a) { return a.status === 'Disponível'; }).length;
  }
```

- [ ] **Step 5: HTML e CSS**

Em `public/membros/index.html`, troque:

```html
      <div class="artgrid" id="artListFull"></div>
```
por
```html
      <div id="artListFull"></div>
```

Em `public/assets/club.css`, logo após a linha que começa com `.artgrid{`, acrescente:

```css
.art-area+.art-area{margin-top:32px}
```

- [ ] **Step 6: Rodar tudo e ver passar**

Run: `node --test tests/graduacao.test.mjs tests/progress-notes.test.cjs tests/cerebro-preview.test.mjs tests/areas-admin.test.cjs tests/areas-membros.test.cjs`
Expected: 19 PASS, 0 FAIL.

- [ ] **Step 7: Commit**

```bash
git add public/assets/membros.js public/membros/index.html public/assets/club.css tests/areas-membros.test.cjs
git -c user.name="Felipe Melo" -c user.email="felipentys@gmail.com" commit -m "Membros: cartões agrupados por área da jornada, frente interna fora" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Conferência visual sem login e deploy da fase 2

**Files:** nenhum novo. Usa `public/` servido localmente.

**Interfaces:**
- Consumes: Task 2 rodada no banco (as telas leem `tipo` e `interna`; sem a fase 1 no banco, `groups.save` com `interna` falharia com coluna inexistente).

- [ ] **Step 1: Servir local e abrir o admin com stubs**

Padrão já usado neste repo (ver memória `demandas-admin-estado-2026-09`): `cd public && python -m http.server 8000`, e no Playwright interceptar `club-auth.js`, `club-data.js` e `club-supabase.js` com stubs que devolvem um `st` mínimo. Alternativa mais simples e suficiente aqui: **login real no admin em produção depois do deploy** (Step 3), porque os testes de unidade já cobrem a lógica.

- [ ] **Step 2: Deploy**

```bash
git log --oneline main..HEAD
```
Expected: os commits das Tasks 1, 3, 4, 5, 6 (e o spec/plano). Abra PR do branch `olympusperformance/taxonomia-artefatos-demandas` para `main`, ou faça merge direto se o Felipe autorizar. Push em `main` dispara o auto-deploy do EasyPanel.

- [ ] **Step 3: Verificar no ar como admin**

Em `oftalmoblack.com.br/admin`:
- Artefatos: cinco áreas na ordem Onboarding · Tecnologia e dados · Presença e conteúdo · Geração de demanda · Comercial da clínica; subtítulo sem "P0…"; botão "Nova área"; ao editar uma área, sem select de pilar e com o checkbox de interna.
- Novo artefato: campo "Área", campo "Tipo" com as duas opções.
- Progressão do João Vitor: faixas com nome da área, sem sufixo de pilar; percentuais iguais aos da Task 2 Step 5.

- [ ] **Step 4: Verificar no ar como mentorado**

Com `?membro=<id do João Vitor>` no admin (ícone do olho) ou com um login de mentorado:
- Aba Artefatos: seções "ÁREA" com título da área; cartões de Meta Ads, Quiz, Funil VSL sob "Geração de demanda"; Tracker Black e Sistema Black sob "Tecnologia e dados".
- Nenhum cartão chamado Onboarding, AEO ou Treinamento comercial (estão `Em produção` e sem marcação → filtrados), a menos que o Felipe tenha marcado aceite.
- Console do navegador sem erro.

- [ ] **Step 5: Registrar**

Atualizar a memória do projeto: fase 2 no ar em <data>, próximo passo = plano da fase 3.

---

## Pendências para o plano da fase 3 (não fazer agora)

- **Membro do Alex:** `frentes.sql` §10 previa criar `members` "Clínica Dr. Alex Sá" (tier `CLINICA`), mas isso **nunca rodou** no banco live: só existe "Alex Sá" (tier `BLACK`, ativo), e `members.tier` só tem `BLACK`. O spec usa "Alex Sá". Ao escrever a fase 3, confirmar com o Felipe se as demandas da clínica ficam em "Alex Sá" ou se cria o membro da clínica.
- Áreas de equipe (`interna = true`): Fechamento (6), Club e eventos (7), Operação Olympus (8). Frentes internas: Comercial Olympus, Club OftalmoBlack, Imersão Grau Zero, Olympus OS, Coordenação. Encontro Grau Zero = artefato com `member_id` = Alex Sá.
- `rename column projeto to projeto_legado` no mesmo deploy da UI nova de Demandas; `COLUNAS.demands` troca `projeto` por `artifact_id`, `step_id`.
- "Abrir demanda" na etapa da Progressão (`linhaEtapa`) e "marcar etapa?" ao concluir demanda com `step_id`.
- Backfill: lista de revisão (spec §4) antes de qualquer update.

## Self-review

- **Spec coverage (fases 1 e 2):** §3 modelo → Task 1 (colunas, trigger, RLS). §2 taxonomia → Task 1 passos 2–4. §5 checklists → Task 1 passo 4. §6.1 Artefatos → Task 4. §6.2 Progressão (sem o "abrir demanda", que é fase 3) → Task 5. §6.4 membros (filtro e agrupamento; lista de tarefas fica para a fase 4) → Task 6. §7 fase 1 → Tasks 1–2; fase 2 → Tasks 3–7. §7.5 verificação → Task 2 passos 2–4.
- **Placeholders:** nenhum "TBD"; todo passo de código traz o código.
- **Consistência de nomes:** `interna` (coluna e campo de formulário), `tipo` com valores `artefato`/`interna`, `agruparPorArea(artefatos, grupos)`, `cabecalhoGrupo(g, n)`, `artefatosDe(memberId)` iguais em spec, SQL, JS e testes. Marcadores de extração dos testes (`  function cabecalhoGrupo(` → `  function renderArtifacts(`; `  function artefatosDe(` → `  /* ── tabela`; `  function agruparPorArea(` → `  function renderArtifacts(`; `  var COLUNAS = {` → `  /* Campo de data`) conferidos contra o código atual e contra o código proposto.
