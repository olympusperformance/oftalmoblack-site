-- ============================================================================
-- Frentes internas, Encontro do Alex e demanda ligada à frente: fase 3 da
-- taxonomia de 21/09/2026
--
-- Spec: docs/superpowers/specs/2026-09-21-taxonomia-artefatos-demandas-design.md
-- Roda DEPOIS de areas.sql, inteiro, com o admin fechado; o deploy da UI nova
-- (PR da fase 3) sai logo em seguida. Idempotente: rodar duas vezes deixa o
-- banco igual. Rodar meses depois NÃO refaz o backfill: só preenche
-- artifact_id vazio e, na heurística por título, só demanda criada antes de
-- 22/09/2026 — a que a equipe deixou "Sem frente" de propósito fica quieta.
-- Não renova o snapshot.
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
   and a.nome = case when d.titulo ~* '(carimbo|vigia|track|click_token|alexsa_trk|\mtrk\M|\mcapi\M|rastre)'
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
-- Ordem dos casos importa (SDR antes de CRM; quiz antes de campanha; Imersão
-- antes de Onboarding). Sem palavra → fica null e cai no cartão "Sem frente"
-- para triagem na UI.

update public.demands d
   set artifact_id = a.id
  from public.artifacts a
 where d.member_id is not null
   and d.artifact_id is null
   and d.criado_em < '2026-09-22'
   and a.member_id is null
   and a.nome = case
     when d.titulo ~* '(sdr|luiza|luzia|marina|atende sozinho|fora do hor)'                 then 'SDR IA'
     when d.titulo ~* '(doxa|f[áa]brica)'                                                    then 'Fábrica de Conteúdo'
     when d.titulo ~* '(direct|coment[áa]rio|manychat|bot de direct)'                       then 'Automação Instagram'
     when d.titulo ~* '(gbp|ficha|google meu neg|perfil da empresa)'                         then 'GBP'
     when d.titulo ~* '(google ads|\mgoogle\M)'                                              then 'Google Ads'
     when d.titulo ~* '(vsl)'                                                                then 'Funil VSL'
     when d.titulo ~* '(quiz|link da bio|\mbio\M)'                                           then 'Quiz'
     when d.titulo ~* '(tracking|traqueamento|trackeamento|rastre|\mcapi\M|utm|carimbo|vigia)' then 'Tracker Black'
     when d.titulo ~* '(sistema black|crm|meagenda|me agenda|minha agenda|\mimporta|\mexporta|\mmigra)' then 'Sistema Black'
     when d.titulo ~* '(\msite\M|dom[íi]nio|hospedagem|artigo)'                             then 'Site Institucional'
     when d.titulo ~* '(linha editorial|roteiro|script|conte[úu]do)'                         then 'Linha Editorial'
     when d.titulo ~* '(meta ads|campanha|ctwa|otimiza|criativo|tr[áa]fego|an[úu]ncio|conta de an|quinzenal|auditoria)' then 'Meta Ads'
     when d.titulo ~* '(imers[ãa]o|convidado)'                                                then 'Imersão Grau Zero'
     when d.titulo ~* '(onboarding|growth|contrato|plataformas)'                              then 'Onboarding'
     when d.titulo ~* '(lenize|treinamento)'                                                  then 'Treinamento comercial'
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
