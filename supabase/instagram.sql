-- ============================================================================
-- Instagram dos mentorados no Cérebro.
--
-- O acompanhamento hoje é por print e memória: ninguém sabe dizer se o
-- mentorado cresceu ou encolheu no mês sem abrir o celular dele. Estas duas
-- tabelas guardam um retrato por dia e por conta, e a partir do segundo dia a
-- progressão existe sozinha.
--
-- De onde vem o dado: system user token do BM `Dr. Alex Sá | Manager`, que já
-- enxerga 15 contas por parceria. `followers_count` e `media_count` vêm do
-- perfil; `views`, `reach`, `total_interactions`, `accounts_engaged` e
-- `profile_views` vêm de /insights com metric_type=total_value.
--
-- Decisões:
--   * uma linha por (conta, dia) — recoletar o mesmo dia atualiza, não duplica;
--   * as métricas de janela (views, reach) guardam o valor dos ÚLTIMOS 7 DIAS
--     terminando naquele dia, porque é assim que o Instagram as entrega e
--     porque somar dia a dia contaria a mesma pessoa várias vezes;
--   * `seguidores` é estoque (o total no dia); `seguidores_ganhos` é fluxo (o
--     que entrou naquele dia, direto do follower_count do Instagram). Guardar
--     os dois evita ter de escolher entre "quanto tem" e "quanto cresceu".
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 · Qual conta é de quem
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cerebro.instagram_contas (
  ig_user_id   text PRIMARY KEY,
  member_id    uuid REFERENCES public.members(id) ON DELETE SET NULL,
  username     text NOT NULL,
  page_id      text,
  page_nome    text,
  ativo        boolean NOT NULL DEFAULT true,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cerebro.instagram_contas IS
  'Contas de Instagram alcançadas pelo system user, ligadas ao mentorado. member_id nulo = conta no BM sem mentorado correspondente.';

CREATE INDEX IF NOT EXISTS instagram_contas_member ON cerebro.instagram_contas (member_id);

-- ---------------------------------------------------------------------------
-- 2 · O retrato de cada dia
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cerebro.instagram_metricas (
  ig_user_id         text NOT NULL REFERENCES cerebro.instagram_contas(ig_user_id) ON DELETE CASCADE,
  dia                date NOT NULL,
  seguidores         integer,   -- estoque: total no dia
  seguindo           integer,
  publicacoes        integer,
  seguidores_ganhos  integer,   -- fluxo: entraram neste dia
  visualizacoes      integer,   -- views, últimos 7 dias até `dia`
  alcance            integer,   -- reach, janela de 7 dias
  alcance_dia        integer,   -- reach daquele dia sozinho (série retroativa)
  interacoes         integer,   -- total_interactions
  contas_engajadas   integer,   -- accounts_engaged
  visitas_perfil     integer,   -- profile_views
  coletado_em        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ig_user_id, dia)
);

COMMENT ON COLUMN cerebro.instagram_metricas.visualizacoes IS
  'views dos últimos 7 dias terminando em `dia` — janela do Instagram, não soma diária.';

CREATE INDEX IF NOT EXISTS instagram_metricas_dia ON cerebro.instagram_metricas (dia DESC);

-- ---------------------------------------------------------------------------
-- 3 · O que a tela e o Cérebro leem
-- ---------------------------------------------------------------------------
-- Última coleta de cada conta, com a variação de 7 e 30 dias já calculada.
-- Variação nula quer dizer que ainda não há retrato antigo o bastante — é o
-- estado normal na primeira semana, e a tela deve dizer isso em vez de "0".
-- `security_invoker` aqui não é detalhe: sem ele a view roda com os direitos do
-- dono e o RLS das tabelas base é ignorado — a view de cima, mesmo sendo
-- invoker, herdaria o furo e a chave publishable leria a turma inteira sem
-- login. Foi exatamente o que aconteceu no primeiro teste.
--
-- A variação de 7 e 30 dias sai da SOMA dos ganhos diários, não da diferença
-- contra um retrato antigo do estoque. Motivo: a carga retroativa recupera
-- alcance e ganho por dia, mas não o total de seguidores de cada dia — esse só
-- existe a partir da primeira coleta. Comparando estoques, a coluna diria
-- "aguardando" por um mês inteiro tendo o dado na mão.
CREATE OR REPLACE VIEW cerebro.instagram_resumo
  WITH (security_invoker = on) AS
WITH ultima AS (
  SELECT DISTINCT ON (ig_user_id) *
    FROM cerebro.instagram_metricas
   ORDER BY ig_user_id, dia DESC
)
SELECT
  c.ig_user_id, c.member_id, m.nome AS mentorado, c.username,
  u.dia, u.seguidores, u.publicacoes, u.visualizacoes, u.alcance,
  u.interacoes, u.visitas_perfil,
  g7.ganhos  AS var_seguidores_7d,
  g30.ganhos AS var_seguidores_30d,
  a30.media  AS alcance_medio_30d
FROM cerebro.instagram_contas c
JOIN ultima u ON u.ig_user_id = c.ig_user_id
LEFT JOIN public.members m ON m.id = c.member_id
LEFT JOIN LATERAL (
  SELECT sum(seguidores_ganhos)::int AS ganhos FROM cerebro.instagram_metricas x
   WHERE x.ig_user_id = c.ig_user_id AND x.dia > u.dia - 7 AND x.seguidores_ganhos IS NOT NULL
) g7 ON true
LEFT JOIN LATERAL (
  SELECT sum(seguidores_ganhos)::int AS ganhos FROM cerebro.instagram_metricas x
   WHERE x.ig_user_id = c.ig_user_id AND x.dia > u.dia - 30 AND x.seguidores_ganhos IS NOT NULL
) g30 ON true
LEFT JOIN LATERAL (
  SELECT round(avg(alcance_dia))::int AS media FROM cerebro.instagram_metricas x
   WHERE x.ig_user_id = c.ig_user_id AND x.dia > u.dia - 30 AND x.alcance_dia IS NOT NULL
) a30 ON true
WHERE c.ativo;

-- ---------------------------------------------------------------------------
-- 4 · Quem enxerga
-- ---------------------------------------------------------------------------
-- Mesma convenção do resto do Cérebro: o mentorado vê o próprio, o admin vê
-- tudo. Sem política de escrita — só o coletor (service role) escreve.
ALTER TABLE cerebro.instagram_contas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cerebro.instagram_metricas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_contas_leitura ON cerebro.instagram_contas;
CREATE POLICY instagram_contas_leitura ON cerebro.instagram_contas
  FOR SELECT USING (cerebro.eh_admin() OR member_id = cerebro.meu_member_id());

DROP POLICY IF EXISTS instagram_metricas_leitura ON cerebro.instagram_metricas;
CREATE POLICY instagram_metricas_leitura ON cerebro.instagram_metricas
  FOR SELECT USING (
    cerebro.eh_admin() OR EXISTS (
      SELECT 1 FROM cerebro.instagram_contas c
       WHERE c.ig_user_id = instagram_metricas.ig_user_id
         AND c.member_id = cerebro.meu_member_id()
    )
  );

GRANT USAGE ON SCHEMA cerebro TO anon, authenticated;
GRANT SELECT ON cerebro.instagram_contas, cerebro.instagram_metricas TO anon, authenticated;
GRANT SELECT ON cerebro.instagram_resumo TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5 · A ponte para o navegador e para o coletor
-- ---------------------------------------------------------------------------
-- O PostgREST expõe só `public` e `graphql_public`. Abrir o schema `cerebro`
-- inteiro entregaria mensagens e blocos de WhatsApp à chave publishable — o
-- RLS seguraria, mas basta uma tabela nova sem política para virar vazamento.
-- Em vez disso, uma view por cima, com `security_invoker`: quem lê é o usuário
-- logado, então as políticas do item 4 continuam mandando.
CREATE OR REPLACE VIEW public.instagram_resumo
  WITH (security_invoker = on) AS
  SELECT * FROM cerebro.instagram_resumo;

GRANT SELECT ON public.instagram_resumo TO anon, authenticated;

-- Série histórica para o gráfico de progressão, já pronta para a tela.
CREATE OR REPLACE VIEW public.instagram_serie
  WITH (security_invoker = on) AS
  SELECT c.member_id, c.username, m.dia, m.seguidores, m.seguidores_ganhos,
         m.alcance_dia, m.visualizacoes, m.alcance, m.interacoes, m.visitas_perfil
    FROM cerebro.instagram_metricas m
    JOIN cerebro.instagram_contas c ON c.ig_user_id = m.ig_user_id
   WHERE c.ativo;

GRANT SELECT ON public.instagram_serie TO anon, authenticated;

-- O coletor escreve por aqui: o schema `cerebro` não é alcançável pelo
-- PostgREST, e é assim que ele fica. SECURITY DEFINER com grant só para
-- service_role — a chave publishable não chama nenhuma das duas.
CREATE OR REPLACE FUNCTION public.instagram_sync_contas(p jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  INSERT INTO cerebro.instagram_contas
        (ig_user_id, member_id, username, page_id, page_nome, ativo, atualizado_em)
  SELECT x.ig_user_id, x.member_id, x.username, x.page_id, x.page_nome, true, now()
    FROM jsonb_to_recordset(p) AS x(ig_user_id text, member_id uuid, username text,
                                    page_id text, page_nome text)
  ON CONFLICT (ig_user_id) DO UPDATE
     SET member_id = COALESCE(EXCLUDED.member_id, cerebro.instagram_contas.member_id),
         username = EXCLUDED.username,
         page_id = EXCLUDED.page_id,
         page_nome = EXCLUDED.page_nome,
         ativo = true,
         atualizado_em = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.instagram_sync_metricas(p jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  INSERT INTO cerebro.instagram_metricas
        (ig_user_id, dia, seguidores, seguindo, publicacoes, seguidores_ganhos,
         visualizacoes, alcance, interacoes, contas_engajadas, visitas_perfil, coletado_em)
  SELECT x.ig_user_id, x.dia, x.seguidores, x.seguindo, x.publicacoes, x.seguidores_ganhos,
         x.visualizacoes, x.alcance, x.interacoes, x.contas_engajadas, x.visitas_perfil, now()
    FROM jsonb_to_recordset(p) AS x(ig_user_id text, dia date, seguidores integer,
                                    seguindo integer, publicacoes integer,
                                    seguidores_ganhos integer, visualizacoes integer,
                                    alcance integer, interacoes integer,
                                    contas_engajadas integer, visitas_perfil integer)
  ON CONFLICT (ig_user_id, dia) DO UPDATE
     SET seguidores = EXCLUDED.seguidores,
         seguindo = EXCLUDED.seguindo,
         publicacoes = EXCLUDED.publicacoes,
         seguidores_ganhos = COALESCE(EXCLUDED.seguidores_ganhos, cerebro.instagram_metricas.seguidores_ganhos),
         visualizacoes = COALESCE(EXCLUDED.visualizacoes, cerebro.instagram_metricas.visualizacoes),
         alcance = COALESCE(EXCLUDED.alcance, cerebro.instagram_metricas.alcance),
         interacoes = COALESCE(EXCLUDED.interacoes, cerebro.instagram_metricas.interacoes),
         contas_engajadas = COALESCE(EXCLUDED.contas_engajadas, cerebro.instagram_metricas.contas_engajadas),
         visitas_perfil = COALESCE(EXCLUDED.visitas_perfil, cerebro.instagram_metricas.visitas_perfil),
         coletado_em = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.instagram_sync_contas(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_sync_metricas(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.instagram_sync_contas(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_sync_metricas(jsonb) TO service_role;
