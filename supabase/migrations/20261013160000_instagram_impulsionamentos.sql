-- ============================================================================
-- Impulsionamentos de post do Instagram, lidos direto da Meta.
--
-- A equipe acompanhava numa planilha ("Controle de Anúncios"): início, término,
-- link do post, gasto, total do impulsionamento, seguidores ganhos, custo por
-- visita ao perfil e custo por seguidor. Tudo isso a Marketing API entrega por
-- campanha, então a planilha passa a se preencher sozinha.
--
-- Como reconhecer um impulsionamento: a Meta dá à campanha o nome
-- "Post do Instagram: <começo da legenda>" (ou "Instagram post: ..." quando a
-- conta está em inglês). O coletor filtra por esse começo de nome.
--
-- Seguidores vêm de `instagram_profile_follow`, o mesmo "Seguidores no
-- Instagram" do Gerenciador: só os atribuídos àquela campanha, não o
-- crescimento do perfil. Não aparece em `actions`; é campo próprio.
-- ============================================================================

-- Qual conta de anúncios é de quem. Explícito e não descoberto: a conta da
-- Cíntia, por exemplo, responde ao system user mas não aparece em
-- me/adaccounts, e conta errada mostraria o gasto de um mentorado no outro.
CREATE TABLE IF NOT EXISTS cerebro.impulsionamento_contas (
  ad_account_id text PRIMARY KEY CHECK (ad_account_id ~ '^act_[0-9]+$'),
  member_id     uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  nome          text,
  ativo         boolean NOT NULL DEFAULT true,
  ultima_coleta timestamptz,
  ultimo_erro   text,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS impulsionamento_contas_member
  ON cerebro.impulsionamento_contas (member_id);

CREATE TABLE IF NOT EXISTS cerebro.impulsionamentos (
  campaign_id     text PRIMARY KEY,
  ad_account_id   text NOT NULL REFERENCES cerebro.impulsionamento_contas(ad_account_id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  post_url        text,
  inicio          timestamptz,
  termino         timestamptz,
  status          text,
  orcamento_total numeric(12,2),   -- "Total do impulsionamento"
  gasto           numeric(12,2) NOT NULL DEFAULT 0,
  seguidores      integer NOT NULL DEFAULT 0,
  visitas_perfil  integer NOT NULL DEFAULT 0,
  alcance         integer,
  moeda           text,
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS impulsionamentos_member_inicio
  ON cerebro.impulsionamentos (member_id, inicio DESC);

ALTER TABLE cerebro.impulsionamento_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cerebro.impulsionamentos       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS impulsionamento_contas_leitura ON cerebro.impulsionamento_contas;
CREATE POLICY impulsionamento_contas_leitura ON cerebro.impulsionamento_contas
  FOR SELECT USING (cerebro.eh_admin() OR member_id = cerebro.meu_member_id());

DROP POLICY IF EXISTS impulsionamentos_leitura ON cerebro.impulsionamentos;
CREATE POLICY impulsionamentos_leitura ON cerebro.impulsionamentos
  FOR SELECT USING (cerebro.eh_admin() OR member_id = cerebro.meu_member_id());

GRANT SELECT ON cerebro.impulsionamento_contas, cerebro.impulsionamentos TO authenticated;

-- O navegador lê por `public`, como o resto da aba Instagram.
CREATE OR REPLACE VIEW public.instagram_impulsionamentos
  WITH (security_invoker = on) AS
  SELECT i.campaign_id, i.member_id, m.nome AS mentorado, i.ad_account_id,
         i.nome, i.post_url, i.inicio, i.termino, i.status,
         i.orcamento_total, i.gasto, i.seguidores, i.visitas_perfil, i.alcance,
         i.moeda, i.atualizado_em
    FROM cerebro.impulsionamentos i
    JOIN public.members m ON m.id = i.member_id;

GRANT SELECT ON public.instagram_impulsionamentos TO authenticated;

-- As contas que tinham impulsionamento em 13/10/2026.
INSERT INTO cerebro.impulsionamento_contas (ad_account_id, member_id, nome) VALUES
  ('act_401884437261978',  '12d48b7b-3580-4529-ab02-50fe25c75002', 'CS - Dra. Cintia Santini (Clinica Novo Olhar)'),
  ('act_1213175646545722', '6f9684bd-f45a-4a68-b07b-03278f998494', 'Dr Arthur Onofre Beltran Filho'),
  ('act_1096285198533099', 'eb7db415-3be7-478c-bd91-88dbf6ce095d', 'Dr. Oswaldo Frazão Neto'),
  ('act_1503825143752978', '469a535b-af18-4fe5-a46c-420620167949', 'C DANIEL J 01'),
  ('act_262070151348195',  '3edd6b6e-9f48-4a98-8e8d-9a38cfb5e54c', 'CA - Conttemple Clínica'),
  ('act_1103458301849230', '5a6e976b-4917-49ae-8b94-c1cf6cd9a484', 'Dr João Vitor Coelho')
ON CONFLICT (ad_account_id) DO NOTHING;

-- Coleta duas vezes ao dia, com o mesmo token do coletor de métricas.
CREATE OR REPLACE FUNCTION cerebro.impulsionamentos_coletar_agora()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  projeto_url text;
  metricas_token text;
BEGIN
  SELECT decrypted_secret INTO projeto_url
    FROM vault.decrypted_secrets WHERE name = 'instagram_project_url';
  SELECT decrypted_secret INTO metricas_token
    FROM vault.decrypted_secrets WHERE name = 'instagram_metricas_token';

  IF coalesce(projeto_url, '') = '' OR coalesce(metricas_token, '') = '' THEN
    RAISE EXCEPTION 'Configure instagram_project_url e instagram_metricas_token no Vault';
  END IF;

  RETURN net.http_post(
    url := rtrim(projeto_url, '/') || '/functions/v1/instagram-impulsionamentos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-metricas-token', metricas_token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
END;
$$;

REVOKE ALL ON FUNCTION cerebro.impulsionamentos_coletar_agora() FROM PUBLIC, anon, authenticated;

-- 11h20/23h20 UTC = 7h20/19h20 em Manaus, depois do retrato das métricas.
SELECT cron.schedule(
  'instagram-impulsionamentos-diario',
  '20 11,23 * * *',
  $job$SELECT cerebro.impulsionamentos_coletar_agora();$job$
);

-- O coletor fala por aqui: o schema `cerebro` não é exposto ao PostgREST.
-- SECURITY DEFINER com grant só para service_role, como instagram_sync_*.
CREATE OR REPLACE FUNCTION public.impulsionamento_contas_ativas(p_conta text DEFAULT NULL)
RETURNS TABLE (ad_account_id text, member_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.ad_account_id, c.member_id FROM cerebro.impulsionamento_contas c
   WHERE c.ativo AND (p_conta IS NULL OR c.ad_account_id = p_conta);
$$;

CREATE OR REPLACE FUNCTION public.impulsionamentos_sync(p_conta text, p jsonb, p_erro text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer := 0;
BEGIN
  IF p_erro IS NOT NULL THEN
    UPDATE cerebro.impulsionamento_contas SET ultimo_erro = p_erro WHERE ad_account_id = p_conta;
    RETURN 0;
  END IF;
  INSERT INTO cerebro.impulsionamentos
        (campaign_id, ad_account_id, member_id, nome, post_url, inicio, termino, status,
         orcamento_total, gasto, seguidores, visitas_perfil, alcance, moeda, atualizado_em)
  SELECT x.campaign_id, c.ad_account_id, c.member_id, x.nome, x.post_url, x.inicio, x.termino, x.status,
         x.orcamento_total, x.gasto, x.seguidores, x.visitas_perfil, x.alcance, x.moeda, now()
    FROM jsonb_to_recordset(coalesce(p, '[]'::jsonb)) AS x(campaign_id text, nome text, post_url text,
           inicio timestamptz, termino timestamptz, status text, orcamento_total numeric,
           gasto numeric, seguidores integer, visitas_perfil integer, alcance integer, moeda text)
    -- A conta e o mentorado vêm da tabela, nunca do payload.
    JOIN cerebro.impulsionamento_contas c ON c.ad_account_id = p_conta
  ON CONFLICT (campaign_id) DO UPDATE
     SET nome = EXCLUDED.nome, post_url = COALESCE(EXCLUDED.post_url, cerebro.impulsionamentos.post_url),
         inicio = EXCLUDED.inicio, termino = EXCLUDED.termino, status = EXCLUDED.status,
         orcamento_total = EXCLUDED.orcamento_total, gasto = EXCLUDED.gasto,
         seguidores = EXCLUDED.seguidores, visitas_perfil = EXCLUDED.visitas_perfil,
         alcance = EXCLUDED.alcance, moeda = EXCLUDED.moeda, atualizado_em = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE cerebro.impulsionamento_contas SET ultima_coleta = now(), ultimo_erro = NULL
   WHERE ad_account_id = p_conta;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.impulsionamento_contas_ativas(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.impulsionamentos_sync(text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.impulsionamento_contas_ativas(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.impulsionamentos_sync(text, jsonb, text) TO service_role;

-- Quem tem conta de impulsionamento ligada, para o seletor da tela.
CREATE OR REPLACE VIEW public.instagram_impulsionamento_contas
  WITH (security_invoker = on) AS
  SELECT c.member_id, m.nome AS mentorado, c.ad_account_id, c.nome AS conta,
         c.ativo, c.ultima_coleta, c.ultimo_erro
    FROM cerebro.impulsionamento_contas c
    JOIN public.members m ON m.id = c.member_id;

GRANT SELECT ON public.instagram_impulsionamento_contas TO authenticated;
