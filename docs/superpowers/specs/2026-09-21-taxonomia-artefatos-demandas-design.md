# Taxonomia dos Artefatos e hierarquia das Demandas — design

Data: 2026-09-21. Sessão de planejamento com o Felipe; nenhuma linha de código ou SQL rodou. Decisões abaixo foram tomadas uma a uma na conversa; o que está marcado como *rascunho* ainda depende de aprovação na implementação.

Repo `oftalmoblack-site` (HTML estático + Supabase `zpyxnkuvircukjlfexrv`). Referência obrigatória: a jornada do mentorado em <https://alexsa.norteads.com/jornada-mentorado/> (revisão de 20/09/2026, níveis 1–3).

## 1. Decisões fechadas

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Eixo da "área" | **Espelho da jornada** (fase + dono), com Marketing partido em dois. Não o papel no funil. |
| 2 | Níveis | **2**: área → artefato. Funil (VSL, Quiz) é artefato irmão do Meta Ads. Sem `parent_id`. |
| 3 | Pilar | **Sai.** Coluna `artifact_groups.pilar` e `Club.PILARES` são removidos. Área é o único eixo. |
| 4 | Onde vive o que não é artefato | **Frente unificada**: `artifacts` vira "frente", com `tipo` (`artefato` ou `interna`). Áreas de equipe marcadas `interna`. |
| 5 | Demanda → artefato | `demands.artifact_id` + `demands.step_id` (FKs nullable). `projeto` vira `projeto_legado`, some um ciclo depois. |
| 6 | Etapa × demanda × tarefa | **Gera uma etapa por clique** na Progressão (opção C). Aba Tarefas e tabela `tasks` morrem. Ação do mentorado = etapa `trava` + demanda da CS. |
| 7 | Recorrência de rotina | Fase 4 (limpeza) ou fase própria. Não bloqueia o resto. |
| 8 | Checklists dos artefatos novos | Rascunho a partir do nível 3 da jornada, `status = 'Em produção'` até o Felipe aprovar o texto. |
| 9 | Backfill das demandas | Lista de revisão antes de aplicar. Internas: determinístico pelo `projeto`. De mentorado: heurística por título, aprovada linha a linha. |
| 10 | Nível 4 da jornada | **Fora deste escopo.** São tutoriais/checklists de execução da equipe; vão para uma área futura do admin, não são etapa nem demanda. |

## 2. Taxonomia final

Oito áreas: cinco do mentorado (espelham as áreas 2–5 da jornada) e três da equipe (áreas 1 e 6 da jornada mais a operação interna).

| Área | Tipo | Jornada | Frentes | O que muda |
|---|---|---|---|---|
| Onboarding | mentorado | 2 | **Onboarding** | novo, checklist §5 |
| Tecnologia e dados | mentorado | 3 | Sistema Black · **Tracker Black** | rename de Trackeamento; sai de "Tráfego" |
| Presença e conteúdo | mentorado | 4.2–4.5 | Site Institucional · GBP · **AEO** · Linha Editorial · Fábrica de Conteúdo | AEO novo; GBP e Site saem de "SEO / Site"; Linha e Fábrica saem de "Conteúdo" |
| Geração de demanda | mentorado | 4.1, 4.6, 4.7 | Meta Ads · Google Ads · Funil VSL · Quiz · Automação Instagram · Agente de comentários · **Encontro Grau Zero** (exclusivo do Alex Sá) | Automação IG e Agente saem de "Conteúdo"; Encontro vira artefato com `member_id = Alex Sá` |
| Comercial da clínica | mentorado | 5 | SDR IA · **Treinamento comercial** | SDR IA sai de "Sistema Black"; Treinamento novo |
| Fechamento | equipe (`interna`) | 1 | Comercial Olympus | frente interna (era "Olympus / Comercial") |
| Club e eventos | equipe (`interna`) | 6 | Club OftalmoBlack · Imersão Grau Zero | frentes internas |
| Operação Olympus | equipe (`interna`) | — | Olympus OS · Coordenação | frentes internas |

Grupos atuais que desaparecem como nome: "SEO / Site", "Conteúdo", "Tráfego", "Sistema Black" (renomeados ou redistribuídos, ver §7 fase 1).

### 2.1 Cruzamento jornada × 13 artefatos (inventário que sustentou a taxonomia)

**Já existia, mesmo lugar:** Sistema Black (3.1), Meta Ads e Google Ads (4.1), Site Institucional com artigos (4.2), GBP (4.3), Linha Editorial (4.5), Funil VSL e Quiz (4.6).

**Existia com nome ou grupo diferente da jornada:** Trackeamento → Tracker Black em Tecnologia (3.2); SDR IA → Comercial da clínica ("solução possível a avaliar e contratar", jornada §5); Automação Instagram e Agente de comentários → aquisição, dono Ítalo (4.7); GBP separado de Site e de SEO/AEO (4.2, 4.3 e 4.4 têm três donos).

**Jornada prevê, não existia:** Onboarding (2.1–2.6, com critério de conclusão em 2.6), AEO (4.4), diagnóstico e treinamento comercial com Lenize (5.1). Watchdogs, análise semanal e presença/CS (3.4, 5.4, 6.x) são rotinas da equipe, não entrega ao mentorado: não viram artefato.

**Existia, jornada não menciona:** Fábrica de Conteúdo (Doxa, produto pago). Fica como artefato em Presença e conteúdo.

## 3. Modelo de dados

Tabelas mantêm os nomes (`artifact_groups`, `artifacts`) para não quebrar `club-data.js`; a UI passa a dizer "Área" e "Frente".

```sql
-- áreas
alter table public.artifact_groups
  add column if not exists interna boolean not null default false;
-- pilar: drop só na fase 4, depois que a UI parou de ler.

-- frentes
alter table public.artifacts
  add column if not exists tipo text not null default 'artefato';
alter table public.artifacts drop constraint if exists artifacts_tipo_ck;
alter table public.artifacts add constraint artifacts_tipo_ck
  check (tipo in ('artefato', 'interna'));

-- demandas
alter table public.demands
  add column if not exists artifact_id uuid references public.artifacts(id) on delete set null,
  add column if not exists step_id     uuid references public.artifact_steps(id) on delete set null;
create index if not exists demands_artifact_idx on public.demands (artifact_id);
create index if not exists demands_step_idx     on public.demands (step_id);
-- fase 3, junto com a UI nova:
-- alter table public.demands rename column projeto to projeto_legado;
```

Regras:

- **Frente interna** (`tipo = 'interna'`): sem etapas, sem progresso, nunca aparece para mentorado. Só existe para agrupar demandas.
- **Área interna** (`interna = true`): só contém frentes internas. Não aparece na Progressão nem em `/membros/`.
- **`step_id` implica `artifact_id`**: trigger `before insert or update` em `demands`. Se `step_id` vier preenchido, `artifact_id` recebe o `artifact_id` da etapa; se `artifact_id` também vier e divergir, `raise exception`.
- **Demanda sem frente é permitida** (`artifact_id null`). O painel ganha cartão "sem frente" para triagem, como o "sem dono" atual.
- **Encontro Grau Zero** é `artifacts` com `member_id = Alex Sá`, `tipo = 'artefato'`, `status = 'Em produção'`, sem etapas por enquanto. Usa o mecanismo que `progresso.sql` já documenta ("member_id nulo = turma inteira").

RLS (o que muda):

```sql
-- artifacts: mentorado só lê artefato de verdade
drop policy if exists "le os artefatos liberados" on public.artifacts;
create policy "le os artefatos liberados" on public.artifacts
  for select to authenticated
  using (public.is_admin()
         or (tipo = 'artefato'
             and (member_id is null or member_id = public.current_member_id())));

-- artifact_groups: hoje só admin lê; mentorado precisa ler áreas não internas
-- para /membros/ agrupar os cartões
create policy "mentorado le as areas do mentorado" on public.artifact_groups
  for select to authenticated
  using (public.is_admin() or not interna);

-- artifact_steps: repete a regra (política não dispara política):
--   acrescentar `and a.tipo = 'artefato'` no exists da política atual.
```

`demands`, `demand_steps`, `step_progress`, `marcar_etapa`: inalterados.

## 4. Backfill das demandas

Todo backfill sai primeiro como **lista de revisão** (`projeto_legado` × título × frente proposta × mentorado proposto × regra que decidiu), o Felipe aprova, e só o aprovado é aplicado. Nada em massa sem essa lista e sem snapshot.

### 4.1 Internas (195): determinístico pelo `projeto`

| `projeto` hoje | n | Frente | Mentorado |
|---|---|---|---|
| Clínica Dr. Alex / Tráfego B2C | 25 | Meta Ads, **ou** Tracker Black se o título tiver carimbo, vigia, tracking, click_token, alexsa_trk (revisar) | Alex Sá |
| Clínica Dr. Alex / SDR IA Marina | 15 | SDR IA | Alex Sá |
| Clínica Dr. Alex / Comercial | 3 | Treinamento comercial | Alex Sá |
| Clínica Dr. Alex / Atendimento | 1 | Treinamento comercial | Alex Sá |
| Clínica Dr. Alex / Conteúdo | 1 | Linha Editorial | Alex Sá |
| Olympus / Sistema Black | 39 | Sistema Black | — |
| Olympus / SDR IA (produto) | 4 | SDR IA | — |
| Olympus / GBP e SEO | 4 | GBP | — |
| Olympus / Sites mentorados | 1 | Site Institucional | — |
| Olympus / Conteúdo mentorados | 2 | Linha Editorial, ou Fábrica de Conteúdo se o título tiver Doxa | — |
| Olympus / Tráfego Mestres | 1 | Meta Ads | — |
| Olympus / Comercial | 11 | Comercial Olympus (interna) | — |
| Olympus / Club OftalmoBlack | 13 | Club OftalmoBlack (interna) | — |
| Olympus / Imersão Grau Zero | 11 | Imersão Grau Zero (interna) | — |
| Olympus / Encontro Grau Zero | 11 | Encontro Grau Zero (artefato do Alex) | Alex Sá |
| Olympus / Olympus OS | 23 | Olympus OS (interna) | — |
| Olympus / Coordenação | 1 | Coordenação (interna) | — |
| sem projeto | 29 | fica `null`, cai no cartão "sem frente" | — |

### 4.2 De mentorado (160): heurística por título, revisada

Palavras → frente: meta ads, campanha, CTWA, otimização, criativo → Meta Ads · google → Google Ads · VSL → Funil VSL · quiz, bio → Quiz · SDR, Luiza, Marina, Luzia → SDR IA · site, domínio, hospedagem → Site Institucional · GBP, ficha, Google Meu Negócio → GBP · direct, comentário, ManyChat → Automação Instagram · CRM, Sistema Black, MeAgenda, importar → Sistema Black · tracking, CAPI, rastreamento, UTM → Tracker Black · Doxa → Fábrica de Conteúdo · Imersão, Growth, onboarding → Onboarding. Sem match → `null`. A lista mostra a palavra que decidiu; o Felipe corrige linha a linha.

### 4.3 Verificação do backfill

- `count(*)` de `demands` antes = depois.
- Para cada `projeto_legado`: `count(*)` = soma das demandas nas frentes que ele virou.
- Nenhuma demanda com `member_id` trocado fora das 45 da Clínica Dr. Alex.
- Amostra de 20 linhas aleatórias conferida à mão.

## 5. Checklists dos artefatos novos (rascunho, `Em produção`)

Tipos: `aceite` · `entrega` · `trava` (ação do mentorado) · `rotina` (com `cadencia_dias`) · `opcional`. Texto a aprovar pelo Felipe antes de virar `Disponível`.

**Onboarding** (jornada 2; Felipe conduz, CS valida, Carol formaliza, João Felipe libera acessos)

| ordem | tipo | etapa | jornada |
|---|---|---|---|
| 0 | aceite | Fechamento avisado pelo Dr. Alex: entrada no Club | 1 |
| 1 | entrega | Primeiro contato pelo WhatsApp feito e dados da venda recuperados | 2.1 |
| 2 | entrega | Dados repassados à Carol; contrato e link de pagamento enviados | 2.2 |
| 3 | trava | Contrato assinado e primeiro pagamento confirmado | 2.2 |
| 4 | trava | Formulário complementar devolvido | 2.3 |
| 5 | entrega | Grupo operacional criado e mentorado no grupo A ou B | 2.3 |
| 6 | entrega | Acessos liberados (Área de Membros, Greenn, MLS) e primeiro acesso conferido | 2.3 |
| 7 | entrega | Pesquisa da clínica e pauta da 1ª reunião prontas | 2.3 |
| 8 | entrega | 1ª reunião de onboarding realizada com o Dr. Alex; 5 indicações pedidas | 2.4 |
| 9 | entrega | Plano inicial apresentado na Growth e aceite registrado | 2.5 |
| 10 | entrega | Ações encaminhadas no quadro com responsável, prazo e entrega | 2.5 |
| 11 | entrega | Integração validada pela CS (5 itens de 2.6) | 2.6 |
| 12 | opcional | 2ª reunião agendada ao final do onboarding | 2.5 |

**AEO** (jornada 4.4; Felipe)

| ordem | tipo | etapa |
|---|---|---|
| 0 | aceite | Aceite da frente AEO |
| 1 | entrega | Referência inicial registrada: presença nas respostas de IA, ativos existentes e lacunas |
| 2 | entrega | Plano: melhorias, objetivos, resultado esperado e dependências |
| 3 | trava | Validações médicas do conteúdo entregues |
| 4 | entrega | Ações de AEO executadas nos ativos (site, artigos, perfis) |
| 5 | entrega | Entregas conferidas e acompanhamento organizado |
| 6 | rotina 7d | Evolução avaliada na análise semanal |

**Treinamento comercial** (jornada 5.1; Felipe diagnostica, Lenize treina)

| ordem | tipo | etapa |
|---|---|---|
| 0 | aceite | Aceite do treinamento comercial |
| 1 | trava | Estrutura comercial informada (SDR, closer, secretária, médico) e acesso a atendimentos e registros |
| 2 | entrega | Diagnóstico: gargalos, evidências separadas de hipóteses |
| 3 | entrega | Plano adaptado à capacidade da clínica (Felipe e Lenize) |
| 4 | entrega | Treinamento realizado pela Lenize com o material do método |
| 5 | entrega | Combinados, responsáveis e aplicação esperada registrados |
| 6 | rotina 7d | Aplicação e resultados acompanhados na análise semanal |
| 7 | opcional | Reforço individual com Lenize sob demanda |

Responsáveis por artefato (`artifacts.responsaveis`, por sigla de `staff.apelido`): Onboarding → FM, KK; AEO → FM; Treinamento comercial → FM, LZ; Tracker Black mantém TA e ganha FM.

## 6. UI

### 6.1 Artefatos (`admin.js`: `renderArtifacts`, `modalGrupo`, `modalArtefato`)

- "Grupo" vira "Área" em todo texto. `cabecalhoGrupo` deixa de mostrar pilar. Select de pilar sai de `modalGrupo`; `Club.PILARES` sai de `club-ui.js`.
- `modalGrupo` ganha toggle "Área da equipe (interna)".
- `modalArtefato` ganha `tipo` (Artefato do mentorado ou Frente interna). Frente interna não mostra checklist, status nem ícone de mentorado.
- Áreas internas e suas frentes aparecem só para admin, no fim da lista, com rótulo "equipe".

### 6.2 Progressão (`renderMembers`, `faixaGrupo`, `linhaArtefato`)

- `faixaGrupo` sem pilar. Áreas `interna` e frentes `tipo = 'interna'` não entram.
- Cada etapa não feita ganha ação **"abrir demanda"**: abre `modalDemanda` pré-preenchido com título = etapa, `artifact_id`, `step_id`, `member_id`, `responsaveis` = `artifacts.responsaveis` (etapa `trava` → CS, KK), `origem` = "Progressão · artefato · data".
- Etapa mostra contador de demandas abertas ligadas (`step_id`), clicável para `#demandas?foco=` filtrado.

### 6.3 Demandas (`modalDemanda`, `gruposPorProjeto`, `renderPainel`, `FOCOS`)

- Campo `projeto` sai do formulário. Entra **Frente**: select agrupado por área (mentorado escolhido → artefatos primeiro, frentes internas por último). Entra **Etapa** (opcional, só as etapas da frente escolhida).
- Lista agrupa **área → frente → mentorado**. `partesProjeto`, `SEP_PROJETO` e a regex de TAG saem; `opcoesProjeto` vira `opcoesFrente` lendo `artifact_groups` + `artifacts`.
- Filtros: área e frente (além de responsável e mentorado, que já existem).
- `renderPainel` mostra frente e etapa; `projeto_legado` aparece somente leitura, cinza, enquanto existir.
- `FOCOS` ganha "sem frente" (`artifact_id is null`, abertas).
- Concluir demanda com `step_id` → pergunta "marcar etapa como feita para este mentorado?" → chama `marcar_etapa`. Não é automático.

### 6.4 Área do mentorado (`membros.js`)

- Filtro já existente (linha 358) passa a exigir `tipo === 'artefato'` além do que faz hoje.
- Cartões agrupados por área (hoje é lista solta); ordem = `artifact_groups.ordem`. Áreas internas não chegam (RLS).
- Lista de tarefas (`Club.data.tasks.list`, `toggle`) sai.

### 6.5 Tarefas

- Aba sai de `admin/index.html` e de `admin.js` (`renderTasks`, `modalTarefa`). `Club.data.tasks` sai de `club-data.js`. Banco na fase 4.

### 6.6 Sem impacto

Graduação (`club-graduacao.js`, `member_graduations`): não referencia artefato, área, pilar nem etapa. `/demandas/` e edge function `demandas-tv`: fora de escopo por decisão do Felipe (não existe área de TV).

## 7. Migração

Regra de ouro: **nenhum `artifact_steps.id` muda**. Renomear artefato, trocar `group_id`, criar área ou artefato novo não toca `step_progress`. O plano não apaga nem recria etapa nenhuma. Snapshot mesmo assim.

Toda execução no banco só com autorização explícita do Felipe, script idempotente, no SQL Editor ou pela Management API, com o admin fechado.

### Fase 1: banco, aditivo (nada de UI muda)

| Passo | O quê |
|---|---|
| 0 | Snapshot: `_bkp_20260921_artifact_groups`, `_artifacts`, `_artifact_steps`, `_step_progress`, `_demands`, `_demand_steps` (`create table ... as select *`). |
| 1 | DDL do §3: `interna`, `tipo`, `artifact_id`, `step_id`, índices, trigger `step_id → artifact_id`. |
| 2 | Áreas: "SEO / Site" → "Presença e conteúdo" (ordem 3); "Tráfego" → "Geração de demanda" (ordem 4); "Sistema Black" → "Tecnologia e dados" (ordem 2). Criar "Onboarding" (1) e "Comercial da clínica" (5). "Conteúdo" esvazia no passo 3 (Linha e Fábrica → Presença; Automação IG e Agente → Geração) e é apagado depois. |
| 3 | Artefatos: `group_id` de Trackeamento → Tecnologia; SDR IA → Comercial da clínica; Automação Instagram e Agente de comentários → Geração de demanda; Linha Editorial e Fábrica → Presença e conteúdo. Rename Trackeamento → "Tracker Black". Reordenar `ordem` dentro de cada área. |
| 4 | Criar Onboarding, AEO, Treinamento comercial com os checklists do §5, `status = 'Em produção'`, `responsaveis` por sigla. |
| 5 | RLS do §3. |
| 6 | Verificação (§7.5). |

Frentes internas e Encontro Grau Zero **não** entram aqui: a UI atual mostraria frentes sem etapas na Progressão e em Artefatos. Entram na fase 3, quando Demandas precisa delas.

### Fase 2: admin Artefatos, Progressão, /membros/

§6.1, §6.2 (sem o "abrir demanda"), §6.4 (filtro `tipo` e agrupamento por área). Deploy. Verificar com login de mentorado: nenhuma frente interna, áreas na ordem certa, progresso igual.

### Fase 3: Demandas

| Passo | O quê |
|---|---|
| 1 | Banco: criar áreas internas (Fechamento 6, Club e eventos 7, Operação Olympus 8, `interna = true`) e frentes internas (Comercial Olympus, Club OftalmoBlack, Imersão Grau Zero, Olympus OS, Coordenação, `tipo = 'interna'`); criar Encontro Grau Zero com `member_id = Alex Sá`. |
| 2 | Gerar lista de revisão do backfill (§4.1 + §4.2) para o Felipe. |
| 3 | UI §6.3 + "abrir demanda" da §6.2. Junto do deploy: `rename column projeto to projeto_legado`. |
| 4 | Aplicar o backfill aprovado. Verificação §4.3. |

### Fase 4: limpeza (um ciclo depois da fase 3)

Aba Tarefas e `Club.data.tasks` (§6.5); `drop table tasks`; `drop function toggle_task`; `alter table artifact_groups drop column pilar`; `alter table demands drop column projeto_legado` depois de o Felipe confirmar que não precisa mais consultar. Recorrência de rotina (fechar demanda de etapa `rotina` → "reabrir em N dias?" criando a próxima com `vence_em + cadencia_dias`) entra aqui ou em fase própria.

### 7.5 Verificação (fases 1 e 3)

```sql
-- progresso intacto (633 / 618 em 21/09)
select count(*), count(*) filter (where feito) from step_progress;

-- artefatos que já existiam mantêm exatamente os mesmos step_ids (esperado: zero linhas); os 3 novos ficam fora por não estarem no snapshot
select a.id, array_agg(s.id order by s.ordem)
  from artifacts a join artifact_steps s on s.artifact_id = a.id
 where a.id in (select id from _bkp_20260921_artifacts)
 group by a.id
except
select a.id, array_agg(s.id order by s.ordem)
  from _bkp_20260921_artifacts a join _bkp_20260921_artifact_steps s on s.artifact_id = a.id group by a.id;

-- nenhum artefato sem área; nenhuma frente interna em área de mentorado e vice-versa
select count(*) from artifacts where group_id is null;
select a.nome from artifacts a join artifact_groups g on g.id = a.group_id
 where (a.tipo = 'interna') <> g.interna;

-- mentorado não enxerga frente interna (rodar autenticado como mentorado; esperado 0)
select count(*) from artifacts where tipo = 'interna';
```

## 8. Fora de escopo e não-decisões

- **Nível 4 da jornada** (procedimentos, tutoriais, checklists de conferência da equipe): área futura do admin. Não é etapa de artefato nem demanda.
- **`parent_id` em `artifacts`** (funil dentro do Meta Ads só para exibição): descartado por YAGNI; pode voltar sem tocar progresso.
- **Geração automática de demandas ao aceitar artefato** (opção B): descartada. GBP sozinho geraria 432 demandas. Jornada: "não são uma fila obrigatória de entregas para todos".
- **TV, `/demandas/`, `demandas-tv`**: não existe área de TV. Ignorar.
- **Renomear tabelas** (`artifact_groups` → `areas`): não. Custo em `club-data.js` sem ganho funcional.
- **Texto das etapas dos 3 artefatos novos**: rascunho. Aprovação do Felipe antes de `Disponível`.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Frente interna vazar para mentorado | RLS na fase 1, antes de qualquer frente interna existir (fase 3); filtro `tipo` em `membros.js`; teste autenticado como mentorado. |
| Rename de `projeto` quebrar a lista atual | Rename só no deploy da fase 3, no mesmo commit da UI nova. |
| Drop de `pilar` quebrar `cabecalhoGrupo` | Drop só na fase 4, depois da UI da fase 2 no ar. |
| Backfill errado em massa | Lista de revisão + snapshot + verificação por `projeto_legado`; `projeto_legado` fica um ciclo para conferir. |
| Progressão poluída por frente sem etapa | Frentes internas só nascem na fase 3, quando Progressão já filtra `tipo`. |
| Quadro com 1000+ linhas | Já paginado (commit a283651). |
