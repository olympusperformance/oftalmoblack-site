# Taxonomia dos Artefatos — Fase 3 (Demandas ligadas à frente) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A demanda passa a apontar para a frente (artefato ou frente interna) e, opcionalmente, para a etapa do checklist; o texto livre `projeto` vira `projeto_legado`; áreas de equipe, frentes internas e o Encontro Grau Zero do Alex entram no catálogo; a Progressão abre demanda a partir da etapa e concluir a demanda oferece marcar a etapa.

**Architecture:** Um script SQL idempotente (`supabase/frentes-internas.sql`) semeia 3 áreas internas + 5 frentes internas + Encontro Grau Zero, renomeia `demands.projeto` → `projeto_legado` e faz o backfill determinístico (por `projeto_legado`) e heurístico (por título, só quando uma palavra-chave decide; o resto fica sem frente). No admin, o modelo "projeto" (texto, `Pai / Frente`) é substituído pelo modelo "frente" (`artifact_id`, `step_id`): agrupamento área → frente, filtro por área/frente, célula e menu de frente, formulário com Frente + Etapa, detalhe com Frente/Etapa/legado, cartão "Sem frente", botão "abrir demanda" na etapa da Progressão e pergunta "marcar etapa?" ao concluir.

**Tech Stack:** HTML estático + JS sem build (`public/assets/admin.js`, IIFE sobre `window.Club`), Supabase (Postgres, RLS, PostgREST), testes `node --test` extraindo trechos por marcadores (`tests/*.test.cjs`).

**Spec:** `docs/superpowers/specs/2026-09-21-taxonomia-artefatos-demandas-design.md` (§2 áreas de equipe e Encontro, §3 modelo e trigger, §4 backfill, §6.2 "abrir demanda", §6.3 Demandas, §7 fase 3). Plano anterior: `docs/superpowers/plans/2026-09-21-taxonomia-fases-1-2.md` (fases 1–2 já no ar).

## Global Constraints

- **Estado do banco hoje:** `demands.artifact_id`, `demands.step_id` e o trigger `demands_herda_artefato` existem (fase 1). `demands.projeto` ainda existe com texto livre. Áreas: Onboarding(1) · Tecnologia e dados(2) · Presença e conteúdo(3) · Geração de demanda(4) · Comercial da clínica(5), todas `interna = false`. 16 artefatos, todos `tipo = 'artefato'`, `member_id null`. Snapshots `_bkp_20260921_*` trancados (RLS + revoke).
- **Nomes exatos** das áreas internas e ordem: `Fechamento` (6) · `Club e eventos` (7) · `Operação Olympus` (8), `interna = true`. Frentes internas (`tipo = 'interna'`, `member_id null`, sem etapas): `Comercial Olympus` → Fechamento; `Club OftalmoBlack` e `Imersão Grau Zero` → Club e eventos; `Olympus OS` e `Coordenação` → Operação Olympus. `Encontro Grau Zero` → `tipo = 'artefato'`, `member_id = (select id from members where nome = 'Alex Sá')`, área Geração de demanda, ordem 7, `status = 'Em produção'`, `icone = 'zap'`.
- **Decisões do Felipe (22/09):** Alex Sá é tratado como mentorado (a clínica dele). Demandas "Clínica Dr. Alex / X" recebem `member_id = Alex Sá`. Demandas cujo `projeto` mapeia para um artefato migram direto para o artefato; caso ambíguo (título sem palavra-chave) fica `artifact_id null` e cai no cartão "Sem frente". **Não há lista de revisão prévia**; a triagem é pela UI.
- **Nenhum `artifact_steps.id` muda; nenhuma etapa é apagada.** `step_progress` intocado. Snapshot novo `_bkp_20260922_demands` (só demands, trancado na criação) antes do rename/backfill.
- **Tabela nova em `public` nasce exposta ao PostgREST**: todo `create table` neste plano vem seguido de `enable row level security` + `revoke all ... from anon, authenticated` (lição da fase 1).
- **Ordem do deploy:** rodar o SQL e, em seguida, fazer merge em `main` (auto-deploy EasyPanel). Entre um e outro a UI velha mostra "Sem projeto" em tudo por alguns minutos; a UI nova não lê `projeto`, lê `artifact_id` e, só para exibição, `projeto_legado`.
- **Vocabulário na UI:** "Frente" (artefato do mentorado ou frente interna), "Área" (o agrupador), "Etapa" (item do checklist do artefato). Nunca mais "projeto" em texto visível, exceto o rótulo "Projeto (legado)" no detalhe.
- `COLUNAS.demands` deixa de listar `projeto` e passa a listar `artifact_id` e `step_id`; `NULAVEIS` ganha os dois. Trocar a frente de uma demanda sempre zera `step_id` (a etapa é da frente antiga).
- **Terceiro nível "mentorado" do agrupamento (spec §6.3) não entra nesta fase**: a coluna Mentorado já mostra; dentro da frente as linhas vêm ordenadas por mentorado e prazo. Registrado como deviação consciente.
- **"Sem frente" é permitido.** Demanda de mentorado sem frente continua agrupada pelo mentorado (como hoje); demanda sem mentorado e sem frente vai para o grupo "Sem frente", no fim.
- **Responsável pré-preenchido ao abrir demanda pela etapa:** etapa `trava` → CS (`staff.apelido = 'KK'`); demais → `artifacts.responsaveis`, ou `artifact_groups.responsaveis` se o artefato não tiver dono.
- Testes: `node --test tests/graduacao.test.mjs tests/progress-notes.test.cjs tests/cerebro-preview.test.mjs tests/areas-admin.test.cjs tests/areas-membros.test.cjs tests/areas-sql.test.cjs tests/frentes-demandas.test.cjs tests/frentes-sql.test.cjs` (listar arquivos; baseline hoje 21 pass).
- Commits com `git -c user.name="Felipe Melo" -c user.email="felipentys@gmail.com"` e trailer **exatamente** `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` (não substituir pelo nome do próprio modelo).
- Branch de trabalho: `olympusperformance/taxonomia-fase-3-demandas` a partir de `main` (`a6d5063`), no worktree `C:\Users\felip\orca\workspaces\oftalmoblack-site\murex`.

---

## Mapa de arquivos

| Arquivo | Responsabilidade nesta fase |
|---|---|
| `supabase/frentes-internas.sql` (novo) | Snapshot de `demands`, áreas internas, frentes internas, Encontro do Alex, rename `projeto` → `projeto_legado`, backfill, PROVA |
| `public/assets/club-data.js` | `COLUNAS.demands` e `NULAVEIS` |
| `public/assets/admin.js` | Modelo "frente" (helpers, agrupamento, filtro, célula, menu, FOCOS), formulário, detalhe, Progressão ("abrir demanda", contador), concluir → marcar etapa |
| `public/admin/index.html` | Toolbar de Demandas: filtro de frente e segmento "Por frente" |
| `tests/frentes-demandas.test.cjs` (novo) | `contextoDe`, `casaFrente`, `gruposPorFrente`, `FOCOS.semfrente`, `prefillDaEtapa` |
| `tests/frentes-sql.test.cjs` (novo) | Guarda textual do SQL (sem delete de etapa, snapshot trancado, rename presente, `commit;` único) |
| `README.md` | Linha do SQL novo e comando de testes |

---

### Task 1: Script SQL da fase 3 (`supabase/frentes-internas.sql`) + teste de guarda

**Files:**
- Create: `supabase/frentes-internas.sql`
- Create: `tests/frentes-sql.test.cjs`
- Modify: `README.md` (linha da árvore `supabase/` e seção "Áreas dos artefatos")

**Interfaces:**
- Produces: coluna `demands.projeto_legado` (ex-`projeto`); áreas 6–8 `interna = true`; 5 frentes `tipo = 'interna'`; artefato `Encontro Grau Zero` do Alex; `demands.artifact_id`/`member_id` preenchidos pelo backfill. As Tasks 2–6 pressupõem esses nomes.

- [ ] **Step 1: Escrever o teste de guarda que falha**

Crie `tests/frentes-sql.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'supabase', 'frentes-internas.sql');

test('frentes-internas.sql existe e não mexe em etapa de artefato', () => {
  assert.ok(fs.existsSync(file), 'supabase/frentes-internas.sql não existe');
  const sql = fs.readFileSync(file, 'utf8');
  assert.ok(!/delete\s+from\s+public\.artifact_steps/i.test(sql), 'não pode apagar etapa');
  assert.ok(!/delete\s+from\s+public\.step_progress/i.test(sql), 'não pode apagar progresso');
  assert.ok(!/drop\s+table/i.test(sql), 'não pode dropar tabela');
  assert.ok(!/truncate/i.test(sql), 'não pode truncar');
  assert.equal((sql.match(/\ncommit;/g) || []).length, 1, 'um commit só');
});

test('snapshot de demands nasce trancado', () => {
  const sql = fs.readFileSync(file, 'utf8');
  assert.ok(/create table if not exists public\._bkp_20260922_demands\s+as select \* from public\.demands/.test(sql));
  assert.ok(/alter table public\._bkp_20260922_demands\s+enable row level security/.test(sql));
  assert.ok(/revoke all on public\._bkp_20260922_demands\s+from anon, authenticated;/.test(sql));
});

test('rename de projeto é condicional e o backfill só preenche artifact_id vazio', () => {
  const sql = fs.readFileSync(file, 'utf8');
  assert.ok(/rename column projeto to projeto_legado/.test(sql));
  assert.ok(/column_name = 'projeto'\)/.test(sql), 'rename precisa checar se a coluna ainda se chama projeto');
  const updates = sql.match(/update public\.demands[\s\S]*?;/g) || [];
  assert.ok(updates.length >= 2, 'esperado ao menos dois updates em demands (internas e mentorado)');
  updates.forEach((u, i) => assert.ok(/artifact_id is null/.test(u), 'update #' + (i + 1) + ' precisa de "artifact_id is null"'));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/frentes-sql.test.cjs`
Expected: FAIL — "supabase/frentes-internas.sql não existe".

- [ ] **Step 3: Escrever o script**

Crie `supabase/frentes-internas.sql`:

```sql
-- ============================================================================
-- Frentes internas, Encontro do Alex e demanda ligada à frente: fase 3 da
-- taxonomia de 21/09/2026
--
-- Spec: docs/superpowers/specs/2026-09-21-taxonomia-artefatos-demandas-design.md
-- Roda DEPOIS de areas.sql, inteiro, com o admin fechado; o deploy da UI nova
-- (PR da fase 3) sai logo em seguida. Idempotente: rodar duas vezes deixa o
-- banco igual. Rodar meses depois NÃO refaz o backfill (só preenche
-- artifact_id vazio) e não renova o snapshot.
--
-- O que muda:
--   1. Snapshot de demands (_bkp_20260922_demands), trancado na criação.
--   2. Áreas da equipe (interna = true): Fechamento, Club e eventos, Operação
--      Olympus. Frentes internas (tipo = 'interna'): Comercial Olympus, Club
--      OftalmoBlack, Imersão Grau Zero, Olympus OS, Coordenação.
--   3. Encontro Grau Zero: artefato exclusivo do Alex Sá (funil da clínica
--      dele), em Geração de demanda.
--   4. demands.projeto vira projeto_legado (só leitura na UI; drop na fase 4).
--   5. Backfill: internas pelo projeto_legado (determinístico); de mentorado
--      por palavra do título (só quando uma palavra decide). Alex Sá é
--      mentorado: as demandas "Clínica Dr. Alex / …" ganham member_id dele.
--
-- Regra de ouro: NENHUM artifact_steps.id muda; nada apaga etapa nem progresso.
-- ============================================================================

begin;

-- ── 0. snapshot (trancado: tabela nova em public nasce exposta) ─────────────

create table if not exists public._bkp_20260922_demands as select * from public.demands;
alter table public._bkp_20260922_demands enable row level security;
revoke all on public._bkp_20260922_demands from anon, authenticated;

-- ── 1. áreas da equipe ──────────────────────────────────────────────────────

insert into public.artifact_groups (nome, ordem, interna) values
  ('Fechamento',        6, true),
  ('Club e eventos',    7, true),
  ('Operação Olympus',  8, true)
on conflict (nome) do update set interna = true, ordem = excluded.ordem;

update public.artifact_groups g set responsaveis = r.ids
  from (
    select x.area, array_agg(s.id order by s.apelido) as ids
      from (values
        ('Fechamento', 'FM'),
        ('Club e eventos', 'FM'), ('Club e eventos', 'KK'), ('Club e eventos', 'JF'),
        ('Operação Olympus', 'FM'), ('Operação Olympus', 'IM')
      ) as x(area, sigla)
      join public.staff s on s.apelido = x.sigla
     group by x.area
  ) r
 where r.area = g.nome and g.responsaveis is null;

-- ── 2. frentes internas (sem etapa, sem mentorado; só agrupam demandas) ─────

insert into public.artifacts (nome, subtitulo, icone, status, meta, member_id, group_id, ordem, tipo, responsaveis)
select x.nome, x.subtitulo, 'grid', 'Em produção', '', null, g.id, x.ordem, 'interna',
       (select array_agg(s.id order by s.apelido) from public.staff s where s.apelido = any(x.siglas))
  from (values
    ('Comercial Olympus', 'Venda B2B do Club (Jean, Dr. Alex)',            'Fechamento',       1, array['FM']),
    ('Club OftalmoBlack', 'Operação do Club: agenda, MLS, gravações',       'Club e eventos',   1, array['KK', 'FM']),
    ('Imersão Grau Zero', 'Evento presencial da Olympus, 3x ao ano',        'Club e eventos',   2, array['JF', 'FM']),
    ('Olympus OS',        'Admin, área de membros e ferramentas internas',  'Operação Olympus', 1, array['FM']),
    ('Coordenação',       'Coordenação da equipe Olympus',                  'Operação Olympus', 2, array['FM'])
  ) as x(nome, subtitulo, area, ordem, siglas)
  join public.artifact_groups g on g.nome = x.area
 where not exists (select 1 from public.artifacts a where a.nome = x.nome and a.member_id is null);

-- ── 3. Encontro Grau Zero: funil da clínica do Dr. Alex ─────────────────────

insert into public.artifacts (nome, subtitulo, icone, status, meta, member_id, group_id, ordem, tipo, responsaveis)
select 'Encontro Grau Zero', 'Evento e funil da clínica do Dr. Alex', 'zap', 'Em produção', '',
       m.id, g.id, 7, 'artefato',
       (select array_agg(s.id order by s.apelido) from public.staff s where s.apelido in ('FM', 'TA'))
  from public.members m, public.artifact_groups g
 where m.nome = 'Alex Sá' and g.nome = 'Geração de demanda'
   and not exists (select 1 from public.artifacts a where a.nome = 'Encontro Grau Zero');

-- ── 4. projeto vira projeto_legado ──────────────────────────────────────────

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'demands' and column_name = 'projeto') then
    alter table public.demands rename column projeto to projeto_legado;
  end if;
end $$;

drop index if exists public.demands_projeto_idx;

-- ── 5. backfill das internas: determinístico pelo projeto_legado ────────────
-- Só preenche artifact_id vazio: rodar de novo não desfaz triagem feita na UI.
-- Alex Sá é mentorado (a clínica dele): "Clínica Dr. Alex / …" ganha member_id.

create temp table mapa (projeto text, frente text, alex boolean) on commit drop;
insert into mapa values
  ('Clínica Dr. Alex / SDR IA Marina',  'SDR IA',                true),
  ('Clínica Dr. Alex / Comercial',      'Treinamento comercial', true),
  ('Clínica Dr. Alex / Atendimento',    'Treinamento comercial', true),
  ('Clínica Dr. Alex / Conteúdo',       'Linha Editorial',       true),
  ('Olympus / Sistema Black',           'Sistema Black',         false),
  ('Olympus / SDR IA (produto)',        'SDR IA',                false),
  ('Olympus / GBP e SEO',               'GBP',                   false),
  ('Olympus / Sites mentorados',        'Site Institucional',    false),
  ('Olympus / Tráfego Mestres',         'Meta Ads',              false),
  ('Olympus / Comercial',               'Comercial Olympus',     false),
  ('Olympus / Club OftalmoBlack',       'Club OftalmoBlack',     false),
  ('Olympus / Imersão Grau Zero',       'Imersão Grau Zero',     false),
  ('Olympus / Encontro Grau Zero',      'Encontro Grau Zero',    true),
  ('Olympus / Olympus OS',              'Olympus OS',            false),
  ('Olympus / Coordenação',             'Coordenação',           false);

update public.demands d
   set artifact_id = a.id,
       member_id   = case when m.alex then (select id from public.members where nome = 'Alex Sá') else d.member_id end
  from mapa m
  join public.artifacts a on a.nome = m.frente
 where d.projeto_legado = m.projeto
   and d.artifact_id is null
   and (a.member_id is null or a.nome = 'Encontro Grau Zero');

-- Tráfego B2C do Alex: Tracker Black quando o título fala de rastreamento; senão Meta Ads.
update public.demands d
   set artifact_id = a.id,
       member_id   = (select id from public.members where nome = 'Alex Sá')
  from public.artifacts a
 where d.projeto_legado = 'Clínica Dr. Alex / Tráfego B2C'
   and d.artifact_id is null
   and a.member_id is null
   and a.nome = case when d.titulo ~* '(carimbo|vigia|track|click_token|alexsa_trk|\mtrk\M|capi|rastre)'
                     then 'Tracker Black' else 'Meta Ads' end;

-- Conteúdo mentorados: Doxa é Fábrica; o resto, Linha Editorial.
update public.demands d
   set artifact_id = a.id
  from public.artifacts a
 where d.projeto_legado = 'Olympus / Conteúdo mentorados'
   and d.artifact_id is null
   and a.member_id is null
   and a.nome = case when d.titulo ~* 'doxa' then 'Fábrica de Conteúdo' else 'Linha Editorial' end;

-- ── 6. backfill das demandas de mentorado: só quando uma palavra decide ─────
-- Ordem dos casos importa (SDR antes de CRM; quiz antes de campanha). Sem
-- palavra → fica null e cai no cartão "Sem frente" para triagem na UI.

update public.demands d
   set artifact_id = a.id
  from public.artifacts a
 where d.member_id is not null
   and d.artifact_id is null
   and a.member_id is null
   and a.nome = case
     when d.titulo ~* '(sdr|luiza|luzia|marina|atende sozinho|fora do hor)'                 then 'SDR IA'
     when d.titulo ~* '(doxa|f[áa]brica)'                                                    then 'Fábrica de Conteúdo'
     when d.titulo ~* '(direct|coment[áa]rio|manychat|bot de direct)'                       then 'Automação Instagram'
     when d.titulo ~* '(gbp|ficha|google meu neg|perfil da empresa)'                         then 'GBP'
     when d.titulo ~* '(google ads|\mgoogle\M)'                                              then 'Google Ads'
     when d.titulo ~* '(vsl)'                                                                then 'Funil VSL'
     when d.titulo ~* '(quiz|link da bio|\mbio\M)'                                           then 'Quiz'
     when d.titulo ~* '(tracking|traqueamento|trackeamento|rastre|capi|utm|carimbo|vigia)'   then 'Tracker Black'
     when d.titulo ~* '(sistema black|crm|meagenda|minha agenda|importa|exporta|migra)'      then 'Sistema Black'
     when d.titulo ~* '(site|dom[íi]nio|hospedagem|artigo)'                                  then 'Site Institucional'
     when d.titulo ~* '(linha editorial|roteiro|script|conte[úu]do)'                         then 'Linha Editorial'
     when d.titulo ~* '(meta ads|campanha|ctwa|otimiza|criativo|tr[áa]fego|an[úu]ncio|conta de an)' then 'Meta Ads'
     when d.titulo ~* '(onboarding|growth|imers[ãa]o|convidado)'                             then 'Onboarding'
     else null end;

notify pgrst, 'reload schema';
commit;

-- ============================================================================
-- PROVA (mesma sessão, depois do commit)
-- ============================================================================

-- 1. nada de demanda sumiu; snapshot igual em contagem
-- select (select count(*) from public.demands) as agora,
--        (select count(*) from public._bkp_20260922_demands) as antes;

-- 2. progresso intacto (633 / 618 em 21/09)
-- select count(*), count(*) filter (where feito) from public.step_progress;

-- 3. 8 áreas (3 internas), 22 frentes (5 internas + Encontro do Alex)
-- select g.ordem, g.nome, g.interna, count(a.id) as frentes,
--        count(a.id) filter (where a.tipo = 'interna') as internas
--   from public.artifact_groups g left join public.artifacts a on a.group_id = g.id
--  group by 1, 2, 3 order by 1;
-- select count(*) as total, count(*) filter (where tipo = 'interna') as internas,
--        count(*) filter (where member_id is not null) as exclusivos
--   from public.artifacts;
-- esperado: 22 / 5 / 1

-- 4. backfill: por projeto_legado, quantas ficaram com frente e quantas sem
-- select coalesce(projeto_legado, '(mentorado sem projeto)') as origem,
--        count(*) as n, count(artifact_id) as com_frente,
--        count(*) filter (where member_id = (select id from public.members where nome = 'Alex Sá')) as do_alex
--   from public.demands group by 1 order by 2 desc;
-- esperado: toda linha com projeto_legado tem com_frente = n; as 45 da Clínica
-- têm do_alex = n; a linha "(mentorado sem projeto)" tem com_frente < n
-- (o resto é triagem na UI).

-- 5. frente e mentorado coerentes: nenhuma demanda com artefato exclusivo de
--    outro mentorado
-- select count(*) from public.demands d join public.artifacts a on a.id = d.artifact_id
--  where a.member_id is not null and a.member_id <> d.member_id;
-- esperado: 0

-- 6. snapshot trancado, coluna renomeada
-- select relname, relrowsecurity from pg_class where relname = '_bkp_20260922_demands';
-- select column_name from information_schema.columns
--  where table_name = 'demands' and column_name in ('projeto', 'projeto_legado');
-- esperado: rls true; só projeto_legado
```

- [ ] **Step 4: Rodar o teste de guarda e ver passar**

Run: `node --test tests/frentes-sql.test.cjs`
Expected: 3 PASS.

- [ ] **Step 5: README**

Na árvore da seção "Estrutura", a linha `supabase/              # SQL do banco: tabelas, RLS, acervo, demandas, progresso, áreas (areas.sql)` vira:

```
supabase/              # SQL do banco: tabelas, RLS, acervo, demandas, progresso, áreas (areas.sql), frentes internas (frentes-internas.sql)
```

Na seção "Áreas dos artefatos (21/09/2026)", acrescente antes da linha "Testes de regressão":

```markdown
`supabase/frentes-internas.sql` (fase 3, 22/09/2026) semeia as áreas da equipe e as
frentes internas, cria o Encontro Grau Zero do Alex, renomeia `demands.projeto`
para `projeto_legado` e liga as demandas às frentes. Roda com o admin fechado e
o deploy da UI nova sai logo depois.
```

E troque a linha "Testes de regressão" por:

```markdown
Testes de regressão: `node --test tests/graduacao.test.mjs tests/progress-notes.test.cjs tests/cerebro-preview.test.mjs tests/areas-admin.test.cjs tests/areas-membros.test.cjs tests/areas-sql.test.cjs tests/frentes-demandas.test.cjs tests/frentes-sql.test.cjs`
```

- [ ] **Step 6: Commit**

```bash
git add supabase/frentes-internas.sql tests/frentes-sql.test.cjs README.md
git -c user.name="Felipe Melo" -c user.email="felipentys@gmail.com" commit -m "Frentes: SQL da fase 3 (áreas da equipe, frentes internas, Encontro do Alex, projeto_legado, backfill)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `club-data.js` — demanda grava `artifact_id` e `step_id`, esquece `projeto`

**Files:**
- Modify: `public/assets/club-data.js` (`COLUNAS.demands` ~linha 37, `NULAVEIS` ~linha 57)
- Test: `tests/frentes-demandas.test.cjs` (novo; as Tasks 3–6 acrescentam testes nele)

**Interfaces:**
- Produces: `Club.data.demands.save({ artifact_id, step_id })` grava as duas colunas; `''` vira `null`.

- [ ] **Step 1: Teste que falha**

Crie `tests/frentes-demandas.test.cjs`:

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

test('COLUNAS.demands grava artifact_id e step_id, não projeto; os dois são nuláveis', () => {
  const code = extract('public/assets/club-data.js', '  var COLUNAS = {', '  /* Tabelas que só a administração');
  const ctx = vm.createContext({});
  vm.runInContext(code + '\nthis.COLUNAS = COLUNAS; this.NULAVEIS = NULAVEIS;', ctx);
  assert.ok(ctx.COLUNAS.demands.includes('artifact_id'));
  assert.ok(ctx.COLUNAS.demands.includes('step_id'));
  assert.ok(!ctx.COLUNAS.demands.includes('projeto'));
  assert.ok(!ctx.COLUNAS.demands.includes('projeto_legado'), 'legado é só leitura');
  assert.ok(ctx.NULAVEIS.includes('artifact_id'));
  assert.ok(ctx.NULAVEIS.includes('step_id'));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/frentes-demandas.test.cjs`
Expected: FAIL em `includes('artifact_id')`.

- [ ] **Step 3: Editar**

Em `public/assets/club-data.js`, troque:

```js
    demands:   ['titulo', 'descricao', 'status', 'prioridade', 'responsaveis',
                'member_id', 'origem', 'vence_em', 'projeto'],
```
por
```js
    /* artifact_id e step_id chegam com supabase/areas.sql; projeto virou
       projeto_legado em frentes-internas.sql e a UI só lê, nunca grava. */
    demands:   ['titulo', 'descricao', 'status', 'prioridade', 'responsaveis',
                'member_id', 'origem', 'vence_em', 'artifact_id', 'step_id'],
```
e
```js
  var NULAVEIS = ['vence_em', 'inicia_em', 'member_id', 'publicado_em', 'group_id',
                  'cadencia_dias', 'inicio', 'fim'];
```
por
```js
  var NULAVEIS = ['vence_em', 'inicia_em', 'member_id', 'publicado_em', 'group_id',
                  'cadencia_dias', 'inicio', 'fim', 'artifact_id', 'step_id'];
```

- [ ] **Step 4: Rodar e ver passar; commit**

Run: `node --test tests/frentes-demandas.test.cjs` → PASS.

```bash
git add public/assets/club-data.js tests/frentes-demandas.test.cjs
git -c user.name="Felipe Melo" -c user.email="felipentys@gmail.com" commit -m "Demandas: club-data grava frente e etapa, não projeto" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `admin.js` — modelo "frente" no quadro (helpers, agrupamento, filtro, célula, menu, cartão "Sem frente")

**Files:**
- Modify: `public/assets/admin.js` — bloco de helpers de projeto (~2185–2300), `FOCOS` (~2291), `aplicarFoco` (~2305), `demandasVisiveis` (~2372), `renderDemandas` (~2386–2545), `gruposPorProjeto`/`linhaGrupo`/`linhaDemanda`/`celulaProjeto` (~2585–2700), `linhaSubtarefa` (~2765), `menuDaCelula` (~2820–2860), `descobrirEu` (~176), `st` (~26), `salvarPrefsDem`/`chaveDem` se citarem `demProjeto`
- Modify: `public/admin/index.html` (toolbar de Demandas, ~linhas 117–125)
- Test: `tests/frentes-demandas.test.cjs`

**Interfaces:**
- Produces (usados pelas Tasks 4–6): `frenteDe(d)` → artefato ou `null`; `contextoDe(d)` → `{ key, nome, tipo: 'frente'|'mentorado'|'vazio', area }`; `rotuloFrente(a)` → `'Área · Frente'` (+ ` (Nome do mentorado)` se exclusivo); `frentesOrdenadas()`; `opcoesFrente()` → `[{ value, label }]` com `value` = `'a:<group_id>'` (área inteira) ou `<artifact_id>`; `casaFrente(d, alvo)`; `gruposPorFrente(rows)`; `celulaFrente(d)`; `st.demFrente`; `FOCOS.semfrente`; menu `par[1] === 'frente'` e `par[1] === 'etapa'`.
- Remove: `TAG`, `lerProjeto`, `tituloSemTag`, `comTag`, `patchProjeto`, `projetoDe`, `projetosExistentes`, `SEP_PROJETO`, `partesProjeto`, `opcoesProjeto`, `casaProjeto`, `celulaProjeto`, `st.temProjeto`, `st.demProjeto`. Toda chamada a `tituloSemTag(x)` vira `x`.

- [ ] **Step 1: Testes que falham**

No fim de `tests/frentes-demandas.test.cjs`:

```js
function contextoQuadro() {
  const membros = { m1:'João Vitor', m2:'Cintia' };
  const st = {
    members: [{ id:'m1', nome:'João Vitor' }, { id:'m2', nome:'Cintia' }],
    groups: [
      { id:'g4', nome:'Geração de demanda', ordem:4, interna:false },
      { id:'g2', nome:'Tecnologia e dados', ordem:2, interna:false },
      { id:'g8', nome:'Operação Olympus',   ordem:8, interna:true }
    ],
    artifacts: [
      { id:'meta',  nome:'Meta Ads',      group_id:'g4', ordem:1, tipo:'artefato', member_id:null },
      { id:'quiz',  nome:'Quiz',          group_id:'g4', ordem:4, tipo:'artefato', member_id:null },
      { id:'sb',    nome:'Sistema Black', group_id:'g2', ordem:1, tipo:'artefato', member_id:null },
      { id:'os',    nome:'Olympus OS',    group_id:'g8', ordem:1, tipo:'interna',  member_id:null },
      { id:'enc',   nome:'Encontro',      group_id:'g4', ordem:7, tipo:'artefato', member_id:'m1' }
    ],
    demands: [], recemFechadas: {}, demFrente: ''
  };
  const ctx = vm.createContext({
    st,
    membro: id => membros[id] || null,
    grupoDe: a => st.groups.filter(g => g.id === a.group_id)[0] || null,
    esc: s => String(s == null ? '' : s),
    Club: { DEM_ABERTOS: ['A fazer', 'Planejando', 'Em andamento', 'Em risco', 'Aguardando retorno', 'Em pausa'],
            diffDays: d => d ? 0 : null },
    PESO_PRIO: { Alta:0, 'Média':1, Baixa:2 }
  });
  return ctx;
}

const MARCA_INI = '  /* ── frente: o eixo de leitura do quadro';
const MARCA_FIM = '  function estaFechada(d)';

test('contextoDe: frente com área, mentorado sem frente, e vazio', () => {
  const ctx = contextoQuadro();
  vm.runInContext(extract('public/assets/admin.js', MARCA_INI, MARCA_FIM) +
    '\nthis.contextoDe = contextoDe; this.rotuloFrente = rotuloFrente;', ctx);
  const f = ctx.contextoDe({ id:'d1', artifact_id:'quiz', member_id:'m2' });
  assert.equal(f.tipo, 'frente'); assert.equal(f.nome, 'Quiz'); assert.equal(f.area.nome, 'Geração de demanda');
  const m = ctx.contextoDe({ id:'d2', artifact_id:null, member_id:'m1' });
  assert.equal(m.tipo, 'mentorado'); assert.equal(m.nome, 'João Vitor');
  const z = ctx.contextoDe({ id:'d3', artifact_id:null, member_id:null, projeto_legado:'Olympus / X' });
  assert.equal(z.tipo, 'vazio'); assert.equal(z.nome, 'Sem frente');
  const orfa = ctx.contextoDe({ id:'d4', artifact_id:'apagada', member_id:null });
  assert.equal(orfa.tipo, 'vazio', 'frente apagada conta como sem frente');
  assert.equal(ctx.rotuloFrente(ctx.st.artifacts[4]), 'Geração de demanda · Encontro (João Vitor)');
});

test('opcoesFrente vem por área, com a área inteira antes das frentes dela, internas por último', () => {
  const ctx = contextoQuadro();
  vm.runInContext(extract('public/assets/admin.js', MARCA_INI, MARCA_FIM) +
    '\nthis.opcoesFrente = opcoesFrente; this.casaFrente = casaFrente;', ctx);
  const ops = ctx.opcoesFrente();
  assert.deepEqual(ops.map(o => o.value), ['a:g2', 'sb', 'a:g4', 'meta', 'quiz', 'enc', 'a:g8', 'os']);
  assert.ok(ops[0].label.includes('(tudo)'));
  assert.ok(ctx.casaFrente({ artifact_id:'quiz' }, 'a:g4'));
  assert.ok(!ctx.casaFrente({ artifact_id:'sb' }, 'a:g4'));
  assert.ok(ctx.casaFrente({ artifact_id:'sb' }, 'sb'));
  assert.ok(!ctx.casaFrente({ artifact_id:null }, 'sb'));
});

test('gruposPorFrente: área → frente, mentorado sem frente no topo, Sem frente por último', () => {
  const ctx = contextoQuadro();
  const code = extract('public/assets/admin.js', MARCA_INI, MARCA_FIM) +
    extract('public/assets/admin.js', '  function estaFechada(d)', '  /* O cartão "Em aberto" não é recorte') +
    extract('public/assets/admin.js', '  function porPrazo(a, b)', '  function linhaGrupo(g, nivel)');
  vm.runInContext(code + '\nthis.gruposPorFrente = gruposPorFrente;', ctx);
  ctx.st.demands = [
    { id:'a', titulo:'A', status:'A fazer', prioridade:'Média', artifact_id:'quiz', member_id:'m2' },
    { id:'b', titulo:'B', status:'A fazer', prioridade:'Média', artifact_id:'meta', member_id:null },
    { id:'c', titulo:'C', status:'A fazer', prioridade:'Média', artifact_id:null,   member_id:'m1' },
    { id:'d', titulo:'D', status:'A fazer', prioridade:'Média', artifact_id:null,   member_id:null },
    { id:'e', titulo:'E', status:'A fazer', prioridade:'Média', artifact_id:'os',   member_id:null }
  ];
  const topo = ctx.gruposPorFrente(ctx.st.demands);
  const nomes = topo.map(g => g.nome);
  assert.equal(nomes[nomes.length - 1], 'Sem frente');
  const g4 = topo.find(g => g.nome === 'Geração de demanda');
  assert.equal(g4.tipo, 'pai');
  assert.deepEqual(g4.filhos.map(f => f.nome), ['Meta Ads', 'Quiz']);
  assert.deepEqual(g4.filhos[1].itens.map(d => d.id), ['a']);
  assert.ok(topo.some(g => g.tipo === 'mentorado' && g.nome === 'João Vitor'));
  const g8 = topo.find(g => g.nome === 'Operação Olympus');
  assert.equal(g8.filhos[0].nome, 'Olympus OS');
});

test('FOCOS.semfrente pega aberta sem frente, e só ela', () => {
  const ctx = contextoQuadro();
  vm.runInContext(extract('public/assets/admin.js', MARCA_INI, MARCA_FIM) +
    extract('public/assets/admin.js', '  function estaFechada(d)', '  /* O cartão "Em aberto" não é recorte') +
    '\nthis.FOCOS = FOCOS;', ctx);
  assert.ok(ctx.FOCOS.semfrente.testa({ status:'A fazer', artifact_id:null }));
  assert.ok(!ctx.FOCOS.semfrente.testa({ status:'A fazer', artifact_id:'quiz' }));
  assert.ok(!ctx.FOCOS.semfrente.testa({ status:'Concluída', artifact_id:null }));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/frentes-demandas.test.cjs`
Expected: os 4 novos FAIL ("marcador não encontrado").

- [ ] **Step 3: Substituir o bloco de projeto pelo bloco de frente**

Em `public/assets/admin.js`, apague tudo desde o comentário `/* Projeto é o eixo de leitura: demanda de mentorado se agrupa por ele;` (logo depois de `function minha(d) {...}`) até o fim de `function casaProjeto(d, alvo) {...}` (a linha antes de `function estaFechada(d)`), e coloque no lugar:

```js
  /* ── frente: o eixo de leitura do quadro ──────────────────────────────
     A demanda aponta para a frente (demands.artifact_id): um artefato do
     mentorado ou uma frente interna da equipe, sempre dentro de uma área da
     jornada. Demanda de mentorado sem frente ainda se agrupa por ele; sem
     mentorado e sem frente vai para "Sem frente", que é onde a triagem
     acontece. `projeto_legado` é o texto antigo, só para leitura. */

  function frenteDe(d) {
    if (!d || !d.artifact_id) return null;
    return st.artifacts.filter(function (a) { return a.id === d.artifact_id; })[0] || null;
  }

  function rotuloFrente(a) {
    var g = grupoDe(a);
    return (g ? g.nome + ' · ' : '') + a.nome + (a.member_id ? ' (' + (membro(a.member_id) || 'mentorado') + ')' : '');
  }

  function contextoDe(d) {
    var a = frenteDe(d);
    if (a) return { key:'f:' + a.id, nome:a.nome, tipo:'frente', area:grupoDe(a) };
    if (d.member_id) return { key:'m:' + d.member_id, nome:membro(d.member_id) || 'Mentorado removido', tipo:'mentorado', area:null };
    return { key:'z:', nome:'Sem frente', tipo:'vazio', area:null };
  }

  /* Áreas na ordem cadastrada (as da equipe vêm depois por ordem, e por
     garantia por `interna`), frentes na ordem da área. */
  function areasOrdenadas() {
    return st.groups.slice().sort(function (a, b) {
      return ((a.interna ? 1 : 0) - (b.interna ? 1 : 0)) || ((a.ordem || 0) - (b.ordem || 0)) ||
        String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });
  }

  function frentesOrdenadas() {
    var ordemArea = {};
    areasOrdenadas().forEach(function (g, i) { ordemArea[g.id] = i; });
    return st.artifacts.slice().sort(function (a, b) {
      var ga = ordemArea[a.group_id], gb = ordemArea[b.group_id];
      if (ga === undefined) ga = 999; if (gb === undefined) gb = 999;
      return (ga - gb) || ((a.ordem || 0) - (b.ordem || 0)) ||
        String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });
  }

  /* Opções do filtro: a área inteira ("a:<id>") e, indentadas, as frentes dela. */
  function opcoesFrente() {
    var lista = [];
    areasOrdenadas().forEach(function (g) {
      var frentes = frentesOrdenadas().filter(function (a) { return a.group_id === g.id; });
      if (!frentes.length) return;
      lista.push({ value:'a:' + g.id, label:g.nome + ' (tudo)' });
      frentes.forEach(function (a) {
        lista.push({ value:a.id, label:'    ' + a.nome + (a.member_id ? ' (' + (membro(a.member_id) || 'mentorado') + ')' : '') });
      });
    });
    return lista;
  }

  /* O filtro casa a frente exata ou a área inteira. */
  function casaFrente(d, alvo) {
    var a = frenteDe(d);
    if (!a) return false;
    alvo = String(alvo || '');
    if (alvo.indexOf('a:') === 0) return a.group_id === alvo.slice(2);
    return a.id === alvo;
  }

```

- [ ] **Step 4: `FOCOS` ganha `semfrente`**

No objeto `FOCOS`, depois da entrada `semdono`, acrescente:

```js
    semfrente: { nome:'Sem frente', vazio:'Todas as abertas têm frente.',
      testa:function (d) { return aberta(d) && !d.artifact_id; } }
```
(acrescente a vírgula depois do `}` de `semdono`).

- [ ] **Step 5: Estado e preferências**

- Em `st` (~linha 20): `demResp: '', demMembro: '', demProjeto: '', demAbertas: 'open',` → `demResp: '', demMembro: '', demFrente: '', demAbertas: 'open',`; e `demVisao: 'minhas', demAgrupar: 'projeto', eu: null, temProjeto: true,` → `demVisao: 'minhas', demAgrupar: 'frente', eu: null,`. Atualize o comentário acima ("agrupado por projeto" → "agrupado por frente").
- Em `descobrirEu`, apague a linha `st.temProjeto = !!st.demands.length && ('projeto' in st.demands[0]);` e o trecho do comentário acima dela que fala da coluna "projeto".
- `grep -n "demProjeto\|temProjeto\|demAgrupar === 'projeto'\|'projeto'" public/assets/admin.js`: troque cada `st.demProjeto` por `st.demFrente`; cada `st.demAgrupar === 'projeto'` por `st.demAgrupar === 'frente'`. Se `salvarPrefsDem`/`chaveDem`/`lerPrefsDem` guardam `demProjeto`/`demAgrupar` no localStorage, troque a chave para `demFrente` e trate valor antigo `'projeto'` de `demAgrupar` como `'frente'`.
- Em `aplicarFoco`: `st.demResp = ''; st.demMembro = ''; st.demProjeto = '';` → `st.demResp = ''; st.demMembro = ''; st.demFrente = '';`.
- Em `demandasVisiveis`: `if (st.demProjeto && !casaProjeto(d, st.demProjeto)) return false;` → `if (st.demFrente && !casaFrente(d, st.demFrente)) return false;`.

- [ ] **Step 6: Toolbar e filtro em `renderDemandas`**

Em `public/admin/index.html`, na toolbar de Demandas:
```html
        <select class="inp" id="filtroProjetoDem" style="max-width:260px"></select>
        <div class="seg" id="filtroAgrupar">
          <button data-agrupar="projeto" aria-selected="true">Por projeto</button>
          <button data-agrupar="lista" aria-selected="false">Por demanda</button>
        </div>
```
vira
```html
        <select class="inp" id="filtroFrenteDem" style="max-width:280px"></select>
        <div class="seg" id="filtroAgrupar">
          <button data-agrupar="frente" aria-selected="true">Por frente</button>
          <button data-agrupar="lista" aria-selected="false">Por demanda</button>
        </div>
```

Em `renderDemandas`, troque o bloco:
```js
    var opProj = opcoesProjeto();
    if (st.demProjeto && !opProj.some(function (o) { return o.value.toLowerCase() === st.demProjeto.toLowerCase(); })) {
      st.demProjeto = '';
    }
    $('filtroProjetoDem').innerHTML = '<option value="">Qualquer projeto</option>' +
      opProj.map(function (o) {
        return '<option value="' + esc(o.value) + '"' +
          (o.value.toLowerCase() === String(st.demProjeto || '').toLowerCase() ? ' selected' : '') +
          '>' + esc(o.label) + '</option>';
      }).join('');
```
por
```js
    var opFrente = opcoesFrente();
    if (st.demFrente && !opFrente.some(function (o) { return o.value === st.demFrente; })) st.demFrente = '';
    $('filtroFrenteDem').innerHTML = '<option value="">Qualquer frente</option>' +
      opFrente.map(function (o) {
        return '<option value="' + esc(o.value) + '"' + (o.value === st.demFrente ? ' selected' : '') +
          '>' + esc(o.label) + '</option>';
      }).join('');
```
Procure o handler `change` de `#filtroProjetoDem` (grep `filtroProjetoDem`) e troque para `filtroFrenteDem` gravando em `st.demFrente`.

Na `assinatura` dos filtros: `st.demProjeto` → `st.demFrente`. Na mensagem de vazio: `st.demResp || st.demMembro || st.demProjeto` → `st.demResp || st.demMembro || st.demFrente` (duas ocorrências).

Cartões: no ramo `else` (visão "todas"), acrescente um quinto cartão depois de `SEM RESPONSÁVEL`:
```js
        cardStat('SEM FRENTE', semFrente.length, semFrente.length ? 'esperando triagem' : 'todas com frente', null, 'semfrente')
```
e, junto das outras contagens (`semDono`), defina:
```js
    var semFrente = abertas.filter(function (d) { return !d.artifact_id; });
```

Comentário e colunas da lista: `var comProjeto = st.demAgrupar === 'lista';` continua, mas renomeie a variável para `comFrente` em todo o `renderDemandas`, `linhaDemanda(d, comFrente)` e `linhaSubtarefa(e, comFrente)`; o cabeçalho `'Projeto'` vira `'Frente'`; a largura `128` da coluna vira `180`. Atualize o comentário acima ("coluna Projeto pra filtrar" → "coluna Frente pra filtrar"; "Por projeto" → "Por frente").

`var corpo = st.demAgrupar === 'projeto' ? gruposPorProjeto(rows)...` → `var corpo = st.demAgrupar === 'frente' ? gruposPorFrente(rows)...`.

- [ ] **Step 7: Agrupamento área → frente**

Troque `gruposPorProjeto` inteira por:

```js
  /* Área → frente. A demanda de mentorado sem frente fica no topo, pelo
     mentorado, como antes; sem nada vai para "Sem frente", no fim. A área é
     uma linha-pai que abre e fecha as frentes dela e soma os números. */
  function gruposPorFrente(rows) {
    var mapa = {};
    rows.forEach(function (d) {
      var c = contextoDe(d);
      var g = mapa[c.key] = mapa[c.key] || { key:c.key, nome:c.nome, tipo:c.tipo, area:c.area, itens:[], filhos:[] };
      g.itens.push(d);
    });
    var grupos = Object.keys(mapa).map(function (k) { return mapa[k]; });
    grupos.forEach(function (g) { g.itens.sort(porMentoradoPrazo); contarGrupo(g, g.itens); });

    var pais = {}, topo = [];
    grupos.forEach(function (g) {
      if (g.tipo !== 'frente' || !g.area) { topo.push(g); return; }
      var pk = 'pai:' + g.area.id;
      var pai = pais[pk] = pais[pk] || { key:pk, nome:g.area.nome, tipo:'pai', ordem:g.area.ordem, interna:!!g.area.interna, itens:[], filhos:[] };
      pai.filhos.push(g);
    });
    var ordemFrente = {};
    frentesOrdenadas().forEach(function (a, i) { ordemFrente['f:' + a.id] = i; });
    Object.keys(pais).forEach(function (k) {
      var pai = pais[k];
      pai.filhos.sort(function (a, b) { return (ordemFrente[a.key] || 0) - (ordemFrente[b.key] || 0); });
      contarGrupo(pai, pai.filhos.reduce(function (acc, f) { return acc.concat(f.itens); }, []));
      topo.push(pai);
    });
    topo.sort(ordemGrupo);
    return topo;
  }

  /* Dentro da frente: quem tem mentorado primeiro, por nome; depois prazo. */
  function porMentoradoPrazo(a, b) {
    var ma = a.member_id ? (membro(a.member_id) || '') : '', mb = b.member_id ? (membro(b.member_id) || '') : '';
    if (ma !== mb) return ma.localeCompare(mb, 'pt-BR');
    return porPrazo(a, b);
  }
```

Em `ordemGrupo`, troque a linha `if (a.tipo !== b.tipo) return a.tipo === 'vazio' ? 1 : b.tipo === 'vazio' ? -1 : 0;` por:
```js
    if (a.tipo !== b.tipo) return a.tipo === 'vazio' ? 1 : b.tipo === 'vazio' ? -1 : 0;
    if (a.tipo === 'pai' && b.tipo === 'pai' && !!a.interna !== !!b.interna) return a.interna ? 1 : -1;
```

Em `linhaGrupo`, o rótulo:
```js
    var rotulo = g.tipo === 'mentorado' ? 'mentorado'
      : g.tipo === 'pai' ? g.filhos.length + (g.filhos.length === 1 ? ' frente' : ' frentes')
      : g.tipo === 'projeto' ? (nivel ? 'frente' : 'projeto') : '';
```
vira
```js
    var rotulo = g.tipo === 'mentorado' ? 'mentorado sem frente'
      : g.tipo === 'pai' ? (g.interna ? 'área da equipe · ' : 'área · ') + g.filhos.length + (g.filhos.length === 1 ? ' frente' : ' frentes')
      : g.tipo === 'frente' ? 'frente' : '';
```
e `aria-label="Abrir ou fechar projeto"` → `aria-label="Abrir ou fechar grupo"`.

- [ ] **Step 8: Linha, célula e menu**

Em `linhaDemanda`: `var titulo = d.member_id ? d.titulo : tituloSemTag(d.titulo);` → `var titulo = d.titulo;`; `(comProjeto ? celulaProjeto(d) : '')` → `(comFrente ? celulaFrente(d) : '')`. Em `linhaSubtarefa`: `(comProjeto ? td('') : '')` → `(comFrente ? td('') : '')`.

Troque `celulaProjeto` inteira por:
```js
  /* A frente é menu: lista todas, por área, e deixa tirar. Trocar a frente
     zera a etapa, que era da frente antiga. */
  function celulaFrente(d) {
    var a = frenteDe(d);
    return tdCel(celula('d.frente', d.id, '<span class="tx">' + esc(a ? rotuloFrente(a) : 'sem frente') + '</span>', !a));
  }

  function itensMenuFrente(atual) {
    var itens = [{ value:'', label:'Sem frente', checked:!atual }];
    areasOrdenadas().forEach(function (g) {
      frentesOrdenadas().filter(function (a) { return a.group_id === g.id; }).forEach(function (a) {
        itens.push({ value:a.id, label:rotuloFrente(a), checked:a.id === atual });
      });
    });
    return itens;
  }

  function itensMenuEtapa(artifactId, atual) {
    var etapas = Club.ordenaEtapas(etapasDe(artifactId));
    return [{ value:'', label:'Sem etapa', checked:!atual }].concat(etapas.map(function (e) {
      return { value:e.id, label:e.titulo + ' · ' + Club.STEP_TIPO_ROTULO[Club.tipoEtapa(e)], checked:e.id === atual };
    }));
  }
```

Em `menuDaCelula`, troque o bloco `if (par[1] === 'projeto') { ... return; }` por:
```js
    if (par[1] === 'frente') {
      Club.menu(el, itensMenuFrente(r.artifact_id), { titulo:'Frente', onPick:function (v) {
        salvar(r.id, { artifact_id: v || null, step_id: null });
      } });
      return;
    }

    if (par[1] === 'etapa') {
      if (!r.artifact_id) { Club.toast('Escolha a frente antes da etapa.', 'alert'); return; }
      Club.menu(el, itensMenuEtapa(r.artifact_id, r.step_id), { titulo:'Etapa do checklist', onPick:function (v) {
        salvar(r.id, { step_id: v || null });
      } });
      return;
    }
```

- [ ] **Step 9: Varredura**

`grep -n "tituloSemTag\|lerProjeto\|comTag\|patchProjeto\|projetoDe\|projetosExistentes\|partesProjeto\|opcoesProjeto\|casaProjeto\|celulaProjeto\|SEP_PROJETO\|temProjeto\|demProjeto\|filtroProjetoDem\|gruposPorProjeto" public/assets/admin.js` deve devolver só as ocorrências dentro de `corpoDetalhe` e `modalDemanda` (Tasks 4 e 5 tratam). Qualquer outra: substitua (`tituloSemTag(x)` → `x`; `projetoDe(d)` → `contextoDe(d)`).

- [ ] **Step 10: Rodar e ver passar**

Run: `node --test tests/frentes-demandas.test.cjs` → 5 PASS. `node --check public/assets/admin.js` → sem erro.

- [ ] **Step 11: Commit**

```bash
git add public/assets/admin.js public/admin/index.html tests/frentes-demandas.test.cjs
git -c user.name="Felipe Melo" -c user.email="felipentys@gmail.com" commit -m "Demandas: quadro agrupa e filtra por área e frente, célula e menu de frente, cartão Sem frente" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `modalDemanda` — Frente e Etapa no formulário, prefill

**Files:**
- Modify: `public/assets/admin.js` (`modalDemanda`, ~3562–3760)
- Test: `tests/frentes-demandas.test.cjs`

**Interfaces:**
- Produces: `modalDemanda(d, prefill)` — `d` nulo ou sem `id` = nova; `prefill` opcional `{ titulo, member_id, artifact_id, step_id, responsaveis, origem }` preenche a nova. `registroDemanda(base, memberId, artifactId, stepId)` (função de módulo, testável) devolve o objeto gravável.
- Consumes: `itensMenuFrente`, `itensMenuEtapa`, `rotuloFrente`, `frenteDe` (Task 3).

- [ ] **Step 1: Teste que falha**

No fim de `tests/frentes-demandas.test.cjs`:

```js
test('registroDemanda grava frente e etapa, nunca projeto; etapa sem frente é descartada', () => {
  const code = extract('public/assets/admin.js', '  function registroDemanda(', '  function modalDemanda(');
  const ctx = vm.createContext({});
  vm.runInContext(code + '\nthis.registroDemanda = registroDemanda;', ctx);
  const base = { titulo:'X', descricao:'', status:'A fazer', prioridade:'Média', responsaveis:[], origem:'', vence_em:'' };
  const r = ctx.registroDemanda(base, 'm1', 'quiz', 's9');
  assert.equal(r.member_id, 'm1'); assert.equal(r.artifact_id, 'quiz'); assert.equal(r.step_id, 's9');
  assert.ok(!('projeto' in r) && !('projeto_legado' in r));
  const semFrente = ctx.registroDemanda(base, null, '', 's9');
  assert.equal(semFrente.artifact_id, null); assert.equal(semFrente.step_id, null);
});
```

- [ ] **Step 2: Rodar e ver falhar** — FAIL ("marcador não encontrado").

- [ ] **Step 3: Reescrever o formulário**

Imediatamente antes de `function modalDemanda(`, acrescente:

```js
  /* O que vai para o banco. Etapa só faz sentido dentro da frente. */
  function registroDemanda(base, memberId, artifactId, stepId) {
    var r = Object.assign({}, base, { member_id: memberId || null, artifact_id: artifactId || null });
    r.step_id = r.artifact_id ? (stepId || null) : null;
    return r;
  }
```

Em `modalDemanda`, mude a assinatura e os defaults:

```js
  function modalDemanda(d, prefill) {
    var novo = !d || !d.id;
    prefill = prefill || {};
    d = Object.assign({ titulo:'', descricao:'', status:'A fazer', prioridade:'Média',
               responsaveis:[], member_id:null, origem:'', vence_em:'', artifact_id:null, step_id:null },
               novo ? prefill : {}, d || {});
```
e apague a linha `var projetoAtual = d.id ? lerProjeto(d) : '';`.

No `body`, troque o `<div class="fld' + (d.member_id ? ' desligado' : '') + '" id="fldProjeto">…</div>` inteiro por:

```js
          '<div class="demand-form-meta">' +
            campoPick('Frente', 'artifact_id', 'pkFrente', d.artifact_id || '',
              'Área da jornada onde a demanda vive. Mentorado + frente = trabalho daquele artefato para ele.') +
            campoPick('Etapa do checklist', 'step_id', 'pkEtapa', d.step_id || '',
              'Opcional. Só as etapas da frente escolhida.') +
          '</div>' +
```

Em `sub:`, `(d.member_id ? d.titulo : tituloSemTag(d.titulo))` → `d.titulo`. No campo título, `value:tituloSemTag(d.titulo)` → `value:d.titulo`. Em `campoPick('Mentorado', 'member_id', 'pkMembro', d.member_id || '')` e `campoPick('Para quais mentorados', 'membros', 'pkMembros', '')` nada muda, mas em modo novo com `prefill.member_id` o pick de mentorados deve nascer com esse valor: `campoPick('Para quais mentorados', 'membros', 'pkMembros', d.member_id || '')` e, no `pickVarios('pkMembros', ...)`, o quarto argumento passa de `[]` para `d.member_id ? [d.member_id] : []`.

No `onSubmit`, apague `var proj = ...` (3 linhas) e a função `registro(memberId)` inteira com o comentário acima dela; e troque cada `registro(x)` por `registroDemanda(base, x, dados.artifact_id, dados.step_id)` — três lugares: `Object.assign({ id:d.id }, registro(alvos[0]))`, `Club.data.demands.save(registro(alvos[0]))`, `alvos.map(registro)` → `alvos.map(function (m) { return registroDemanda(base, m, dados.artifact_id, dados.step_id); })`.

Depois do bloco `pickVarios('pkResp', ...)`, apague `var fldProjeto = …`, a função `mostrarProjeto`, o `pickSimples('pkProjeto', …)` e a chamada final `mostrarProjeto(!!d.member_id);`; apague também `onPick:function (v) { mostrarProjeto(!!v); }` do `pickSimples('pkMembro', …)` (deixe `{ titulo:'Sobre qual mentorado' }`) e a linha `mostrarProjeto(n > 0);` de `atualizarLote`. No lugar do bloco de projeto, acrescente:

```js
    /* Frente e etapa: a etapa depende da frente, então trocar a frente
       redesenha o menu de etapas e zera a escolhida. */
    var etapaOculta = campoOculto('step_id');
    function montarEtapas(artifactId, stepId) {
      var host = $('pkEtapa');
      if (!host) return;
      host.innerHTML = '';
      if (etapaOculta) etapaOculta.value = stepId || '';
      if (!artifactId || !etapasDe(artifactId).length) {
        host.innerHTML = '<span class="hint">' + (artifactId ? 'Esta frente não tem checklist.' : 'Escolha a frente primeiro.') + '</span>';
        return;
      }
      pickSimples('pkEtapa', 'step_id', itensMenuEtapa(artifactId, stepId).map(function (i) {
        return { value:i.value, label:i.label };
      }), stepId || '', { titulo:'Etapa do checklist' });
    }
    pickSimples('pkFrente', 'artifact_id', itensMenuFrente(d.artifact_id).map(function (i) {
      return { value:i.value, label:i.label };
    }), d.artifact_id || '', { titulo:'Frente', onPick:function (v) { montarEtapas(v, ''); } });
    montarEtapas(d.artifact_id, d.step_id);
```

- [ ] **Step 4: Rodar e ver passar** — `node --test tests/frentes-demandas.test.cjs` → 6 PASS; `node --check public/assets/admin.js` limpo; `grep -n "mostrarProjeto\|pkProjeto\|projeto_novo\|fldProjeto" public/assets/admin.js` vazio.

- [ ] **Step 5: Commit**

```bash
git add public/assets/admin.js tests/frentes-demandas.test.cjs
git -c user.name="Felipe Melo" -c user.email="felipentys@gmail.com" commit -m "Demandas: formulário escolhe frente e etapa, aceita prefill da Progressão" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Detalhe e painel — Frente, Etapa, legado; concluir oferece marcar a etapa

**Files:**
- Modify: `public/assets/admin.js` (`corpoDetalhe` ~3178–3230; `mudarStatus` ~3760; `menuDaCelula` ramo `status`)
- Test: `tests/frentes-demandas.test.cjs`

**Interfaces:**
- Produces: `etapaParaMarcar(d)` → `{ memberId, stepId }` ou `null` (só quando a demanda tem `step_id`, `member_id` e a etapa ainda não está marcada para ele); `mudarStatus(id, status)` chama `Club.modal.confirm` com esse par ao concluir.
- Consumes: `marcada(memberId, stepId)`, `marcarEtapa(memberId, stepId)` (Progressão), `contextoDe`, `rotuloFrente`, `celula`, `itensMenuFrente`, `itensMenuEtapa`.

- [ ] **Step 1: Teste que falha**

```js
test('etapaParaMarcar: só com etapa, mentorado e etapa ainda não marcada', () => {
  const marcadas = { 'm1|s1': true };
  const ctx = vm.createContext({ marcada: (m, s) => !!marcadas[m + '|' + s] });
  vm.runInContext(extract('public/assets/admin.js', '  function etapaParaMarcar(', '  function mudarStatus(') +
    '\nthis.etapaParaMarcar = etapaParaMarcar;', ctx);
  assert.deepEqual(ctx.etapaParaMarcar({ member_id:'m1', step_id:'s2' }), { memberId:'m1', stepId:'s2' });
  assert.equal(ctx.etapaParaMarcar({ member_id:'m1', step_id:'s1' }), null, 'já marcada');
  assert.equal(ctx.etapaParaMarcar({ member_id:null, step_id:'s2' }), null, 'sem mentorado não há progresso');
  assert.equal(ctx.etapaParaMarcar({ member_id:'m1', step_id:null }), null);
});
```

- [ ] **Step 2: Rodar e ver falhar** — FAIL.

- [ ] **Step 3: Detalhe**

Em `corpoDetalhe`: `var projeto = projetoDe(d);` → `var ctxo = contextoDe(d); var frente = frenteDe(d); var etapaLigada = d.step_id ? etapasDe(d.artifact_id).filter(function (e) { return e.id === d.step_id; })[0] : null;`. `var titulo = subId || d.member_id ? r.titulo : tituloSemTag(r.titulo);` → `var titulo = r.titulo;`. `esc(d.member_id ? d.titulo : tituloSemTag(d.titulo))` → `esc(d.titulo)`.

`'<p class="demand-context">' + esc(projeto.nome) + '</p>'` →
```js
      '<p class="demand-context">' + esc(frente ? rotuloFrente(frente) + (etapaLigada ? ' · ' + etapaLigada.titulo : '')
        : ctxo.tipo === 'mentorado' ? ctxo.nome : 'Sem frente') + '</p>' +
```

Depois de `campo('Mentorado', …)` e antes de `(!subId ? campo('Origem', …) : '')`, acrescente:
```js
        (!subId ? campo('Frente', celula('d.frente', r.id, '<span class="tx">' +
          esc(frente ? rotuloFrente(frente) : 'Sem frente') + '</span>', !frente, chave('frente'))) : '') +
        (!subId && frente ? campo('Etapa', celula('d.etapa', r.id, '<span class="tx">' +
          esc(etapaLigada ? etapaLigada.titulo : 'Sem etapa') + '</span>', !etapaLigada, chave('etapa'))) : '') +
        (!subId && d.projeto_legado ? campo('Projeto (legado)', '<span class="tx tx-s" style="color:var(--faint)">' +
          esc(d.projeto_legado) + '</span>') : '') +
```

- [ ] **Step 4: Concluir oferece marcar a etapa**

Antes de `function mudarStatus(id, status) {`, acrescente:
```js
  /* Concluir a demanda que nasceu de uma etapa é, quase sempre, concluir a
     etapa. Quase: por isso pergunta, não marca sozinha. */
  function etapaParaMarcar(d) {
    if (!d || !d.member_id || !d.step_id) return null;
    if (marcada(d.member_id, d.step_id)) return null;
    return { memberId:d.member_id, stepId:d.step_id };
  }

```
Em `mudarStatus`, troque:
```js
    if (!achar('demand', id)) return;
    salvarDemanda(id, { status: status });
    if (status !== 'Concluída') { Club.toast('Demanda reaberta.'); return; }
```
por
```js
    var d = achar('demand', id);
    if (!d) return;
    salvarDemanda(id, { status: status });
    if (status !== 'Concluída') { Club.toast('Demanda reaberta.'); return; }
    var alvo = etapaParaMarcar(d);
    if (alvo) {
      var e = etapasDe(d.artifact_id).filter(function (x) { return x.id === alvo.stepId; })[0];
      Club.modal.confirm('Marcar a etapa também?',
        'A demanda veio da etapa "' + (e ? e.titulo : 'do checklist') + '" de ' + (membro(alvo.memberId) || 'mentorado') +
        '. Marcar como feita na Progressão?',
        function () { marcarEtapa(alvo.memberId, alvo.stepId); });
    }
```
Em `menuDaCelula`, no ramo `par[1] === 'status'`, `onPick:function (v) { salvar(r.id, { status:v }); }` → `onPick:function (v) { if (sub) salvar(r.id, { status:v }); else mudarStatus(r.id, v); }`.

- [ ] **Step 5: Rodar e ver passar** — 7 PASS; `node --check` limpo; `grep -n "projetoDe\|tituloSemTag" public/assets/admin.js` vazio.

- [ ] **Step 6: Commit**

```bash
git add public/assets/admin.js tests/frentes-demandas.test.cjs
git -c user.name="Felipe Melo" -c user.email="felipentys@gmail.com" commit -m "Demandas: detalhe mostra frente, etapa e projeto legado; concluir oferece marcar a etapa" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Progressão — "abrir demanda" na etapa e contador de demandas ligadas

**Files:**
- Modify: `public/assets/admin.js` (`linhaEtapa` ~727–775; handler de cliques ~4198; `st` para view)
- Test: `tests/frentes-demandas.test.cjs`

**Interfaces:**
- Produces: `prefillDaEtapa(m, e, a)` → objeto para `modalDemanda(null, prefill)`; `demandasAbertasDaEtapa(memberId, stepId)`; ações `data-abrir-demanda="<memberId>|<stepId>"` e `data-ver-demandas="<memberId>|<artifactId>"`.
- Consumes: `modalDemanda(d, prefill)` (Task 4), `aberta(d)`.

- [ ] **Step 1: Teste que falha**

```js
test('prefillDaEtapa: título da etapa, frente, etapa, mentorado; trava vai para a CS, senão dono do artefato', () => {
  const ctx = vm.createContext({
    st: { staff: [{ id:'kk', apelido:'KK', nome:'Kellen', ativo:true }, { id:'ta', apelido:'TA', nome:'Thomas', ativo:true }],
          groups: [{ id:'g4', nome:'Geração de demanda', responsaveis:['ta'] }] },
    grupoDe: a => ({ id:'g4', nome:'Geração de demanda', responsaveis:['ta'] }),
    Club: { tipoEtapa: e => e.tipo || 'entrega', fmtDataCurta: () => '22/09' }
  });
  vm.runInContext(extract('public/assets/admin.js', '  function prefillDaEtapa(', '  function demandasAbertasDaEtapa(') +
    '\nthis.prefillDaEtapa = prefillDaEtapa;', ctx);
  const m = { id:'m1', nome:'João Vitor' };
  const meta = { id:'meta', nome:'Meta Ads', responsaveis:['ta'] };
  const trava = ctx.prefillDaEtapa(m, { id:'s1', titulo:'Acesso à BM', tipo:'trava' }, meta);
  assert.equal(trava.titulo, 'Acesso à BM'); assert.equal(trava.member_id, 'm1');
  assert.equal(trava.artifact_id, 'meta'); assert.equal(trava.step_id, 's1');
  assert.deepEqual(trava.responsaveis, ['kk']);
  assert.ok(trava.origem.startsWith('Progressão · Meta Ads'));
  const entrega = ctx.prefillDaEtapa(m, { id:'s2', titulo:'Plano de subida', tipo:'entrega' }, meta);
  assert.deepEqual(entrega.responsaveis, ['ta']);
  const semDono = ctx.prefillDaEtapa(m, { id:'s3', titulo:'X', tipo:'entrega' }, { id:'q', nome:'Quiz', responsaveis:[] });
  assert.deepEqual(semDono.responsaveis, ['ta'], 'cai no dono da área');
});
```

- [ ] **Step 2: Rodar e ver falhar** — FAIL.

- [ ] **Step 3: Helpers e botão**

Antes de `function linhaEtapa(m, e, par) {`, acrescente:

```js
  /* A demanda que nasce da etapa já vem endereçada: título da etapa, frente,
     etapa, mentorado e dono. Trava é ato do mentorado — quem cobra é a CS. */
  function prefillDaEtapa(m, e, a) {
    var cs = st.staff.filter(function (p) { return p.apelido === 'KK' && p.ativo; }).map(function (p) { return p.id; });
    var g = grupoDe(a);
    var dono = (a.responsaveis && a.responsaveis.length) ? a.responsaveis : ((g && g.responsaveis) || []);
    return {
      titulo: e.titulo,
      member_id: m.id,
      artifact_id: a.id,
      step_id: e.id,
      responsaveis: Club.tipoEtapa(e) === 'trava' && cs.length ? cs : dono,
      origem: 'Progressão · ' + a.nome + ' · ' + Club.fmtDataCurta(new Date().toISOString().slice(0, 10))
    };
  }

  function demandasAbertasDaEtapa(memberId, stepId) {
    return st.demands.filter(function (d) {
      return d.step_id === stepId && d.member_id === memberId && aberta(d);
    });
  }

  function abrirDemandaDaEtapa(memberId, stepId) {
    var m = st.members.filter(function (x) { return x.id === memberId; })[0];
    var e = st.steps.filter(function (x) { return x.id === stepId; })[0];
    var a = e && st.artifacts.filter(function (x) { return x.id === e.artifact_id; })[0];
    if (!m || !e || !a) return;
    modalDemanda(null, prefillDaEtapa(m, e, a));
  }

  function verDemandasDaEtapa(memberId, artifactId) {
    st.demVisao = 'todas'; st.demFoco = ''; st.demAbertas = 'open';
    st.demResp = ''; st.demMembro = memberId; st.demFrente = artifactId;
    go('demands');
    renderDemandas();
  }

```
(Se a função de navegação entre abas não se chama `go`, use o nome que `data-nav` dispara — grep `function go(` / `mostrarView`.)

Em `linhaEtapa`, troque o fim:
```js
      td('') +
      td('<span class="tx-s">' + (p && p.feito_em
        ? esc('em ' + Club.fmtDataCurta(p.feito_em)) : '—') + '</span>') +
      '<div class="td end"></div>' +
    '</div>' + linhaNota(m, 'etapa:' + e.id, e.titulo);
```
por
```js
      td('') +
      td(abertas.length
        ? '<button type="button" class="btn btn-sm btn-ghost" data-ver-demandas="' + esc(m.id) + '|' + esc(e.artifact_id) +
            '" title="Ver no quadro">' + ico('check-square') + abertas.length + ' demanda' + (abertas.length === 1 ? '' : 's') + '</button>'
        : '<span class="tx-s">' + (p && p.feito_em ? esc('em ' + Club.fmtDataCurta(p.feito_em)) : '—') + '</span>') +
      '<div class="td end"><div class="row-acts">' +
        (!p && t !== 'aceite'
          ? '<button class="btn btn-sm btn-ghost" data-abrir-demanda="' + esc(m.id) + '|' + esc(e.id) +
              '" aria-label="Abrir demanda desta etapa" title="Abrir demanda">' + ico('plus') + '</button>'
          : '') +
      '</div></div>' +
    '</div>' + linhaNota(m, 'etapa:' + e.id, e.titulo);
```
e, no começo de `linhaEtapa`, logo depois de `var t = Club.tipoEtapa(e);`, acrescente `var abertas = demandasAbertasDaEtapa(m.id, e.id);`.

No handler de cliques do documento, junto de `var etapaBotao = e.target.closest('[data-etapa]');`, acrescente antes dele:
```js
    var abrirDem = e.target.closest('[data-abrir-demanda]');
    if (abrirDem) { var pd = abrirDem.dataset.abrirDemanda.split('|'); abrirDemandaDaEtapa(pd[0], pd[1]); return; }

    var verDem = e.target.closest('[data-ver-demandas]');
    if (verDem) { var pv = verDem.dataset.verDemandas.split('|'); verDemandasDaEtapa(pv[0], pv[1]); return; }

```
Como `renderDemandas` roda depois de salvar uma demanda (via `recarregarDemandas`), acrescente `renderMembers();` no fim do `.then` de `recarregarDemandas` (depois de `renderDemandas();`) para o contador da etapa acompanhar.

- [ ] **Step 4: Rodar e ver passar** — 8 PASS no arquivo; suíte completa 29 PASS; `node --check` limpo.

- [ ] **Step 5: Commit**

```bash
git add public/assets/admin.js tests/frentes-demandas.test.cjs
git -c user.name="Felipe Melo" -c user.email="felipentys@gmail.com" commit -m "Progressão: etapa abre demanda pré-preenchida e mostra as demandas ligadas" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Banco + deploy + verificação

**Files:** nenhum novo. Banco `zpyxnkuvircukjlfexrv` e `main`.

- [ ] **Step 1: Dry-run com rollback** (Management API, skill `demandas-admin`): script inteiro com `commit;` trocado pela PROVA 4 seguida de `rollback;`. Conferir: toda linha com `projeto_legado` tem `com_frente = n`; as 45 da Clínica com `do_alex = n`; "(mentorado sem projeto)" com `com_frente` entre 60 e 140 (heurística; fora disso, revisar as regex). Segundo dry-run com a PROVA 5 (`esperado 0`).
- [ ] **Step 2: Rodar de verdade.** PROVAs 1–6.
- [ ] **Step 3: Merge imediato** do PR da fase 3 em `main`; acompanhar o deploy (`curl https://oftalmoblack.com.br/assets/admin.js | grep -c gruposPorFrente` até > 0).
- [ ] **Step 4: Conferir no ar** (admin): quadro "Por frente" com áreas e frentes; filtro "Qualquer frente" por área; cartão "SEM FRENTE" em "Todas"; abrir uma demanda: Frente/Etapa no detalhe e no formulário; Progressão do João Vitor: "+" na etapa aberta abre o formulário preenchido; concluir uma demanda com etapa pergunta "Marcar a etapa também?". `/membros/?membro=<Alex Sá>` mostra "Encontro Grau Zero" só se `Disponível` (está `Em produção` → não aparece); outro mentorado nunca vê Encontro.
- [ ] **Step 5: Memória do projeto** e nota para a fase 4 (limpeza: `tasks`, `toggle_task`, `pilar`, `projeto_legado`, recorrência de rotina).

---

## Self-review

- **Spec coverage:** §2 áreas de equipe/frentes internas/Encontro → Task 1 §1–3. §3 `projeto → projeto_legado` → Task 1 §4; trigger já existe (fase 1). §4 backfill → Task 1 §5–6 com a decisão do Felipe (sem lista de revisão; ambíguo fica sem frente). §6.2 "abrir demanda" + contador → Task 6. §6.3 picker Frente/Etapa, lista área → frente, filtros, painel com frente/etapa/legado, cartão "sem frente", concluir → marcar etapa → Tasks 3–5. §7 fase 3 ordem (banco → UI) → Task 7. Deviação registrada: terceiro nível "mentorado" do agrupamento fica como coluna + ordenação (Global Constraints).
- **Placeholders:** nenhum; cada passo de código traz o código. Onde um nome de função existente pode variar (`go`), o passo diz como achar.
- **Consistência:** `frenteDe`, `contextoDe`, `rotuloFrente`, `areasOrdenadas`, `frentesOrdenadas`, `opcoesFrente`, `casaFrente`, `gruposPorFrente`, `porMentoradoPrazo`, `celulaFrente`, `itensMenuFrente`, `itensMenuEtapa`, `registroDemanda`, `etapaParaMarcar`, `prefillDaEtapa`, `demandasAbertasDaEtapa`, `abrirDemandaDaEtapa`, `verDemandasDaEtapa`, `st.demFrente`, `FOCOS.semfrente`, células `d.frente`/`d.etapa` — mesmos nomes em código, testes e marcadores. Marcadores de extração: `  /* ── frente: o eixo de leitura do quadro` → `  function estaFechada(d)`; `  function porPrazo(a, b)` → `  function linhaGrupo(g, nivel)` (inclui `contarGrupo`, `ordemGrupo`, `gruposPorFrente`, `porMentoradoPrazo`); `  function registroDemanda(` → `  function modalDemanda(`; `  function etapaParaMarcar(` → `  function mudarStatus(`; `  function prefillDaEtapa(` → `  function demandasAbertasDaEtapa(`.
