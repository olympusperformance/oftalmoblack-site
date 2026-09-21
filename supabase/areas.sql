-- ============================================================================
-- Áreas da jornada: fase 1 da taxonomia de 21/09/2026
--
-- Spec: docs/superpowers/specs/2026-09-21-taxonomia-artefatos-demandas-design.md
-- Roda DEPOIS de frentes.sql e demandas.sql, inteiro, no SQL Editor, com o
-- admin fechado. Idempotente: rodar duas vezes deixa o banco igual.
-- Rodar meses depois REVERTE edições de área/ordem/responsáveis feitas no admin
-- nos 14 artefatos e 5 áreas listados, e não renova o snapshot.
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

-- Tabela nova em public nasce exposta ao PostgREST (grants padrão, sem RLS).
-- Snapshot é só para rollback pela equipe: tranca já na criação.
alter table public._bkp_20260921_artifact_groups enable row level security;
alter table public._bkp_20260921_artifacts       enable row level security;
alter table public._bkp_20260921_artifact_steps  enable row level security;
alter table public._bkp_20260921_step_progress   enable row level security;
alter table public._bkp_20260921_demands         enable row level security;
alter table public._bkp_20260921_demand_steps    enable row level security;
revoke all on public._bkp_20260921_artifact_groups, public._bkp_20260921_artifacts,
              public._bkp_20260921_artifact_steps,  public._bkp_20260921_step_progress,
              public._bkp_20260921_demands,         public._bkp_20260921_demand_steps
  from anon, authenticated;

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

-- 2. artefatos que já existiam mantêm exatamente os mesmos step_ids (esperado: zero linhas); os 3 novos ficam fora por não estarem no snapshot
-- select a.id, array_agg(s.id order by s.ordem)
--   from public.artifacts a join public.artifact_steps s on s.artifact_id = a.id
--  where a.id in (select id from public._bkp_20260921_artifacts)
--  group by a.id
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
