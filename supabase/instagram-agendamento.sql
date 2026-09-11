-- Coleta automatica dos retratos usados pelo admin e pela area de membros.
-- Aplicar depois de instagram.sql e da publicacao de instagram-metricas.
-- Pre-requisitos no Vault, sem colocar credenciais neste arquivo:
--   instagram_project_url: URL do projeto Supabase
--   instagram_metricas_token: mesmo valor do secret METRICAS_TOKEN da funcao

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION cerebro.instagram_coletar_agora()
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
    url := rtrim(projeto_url, '/') || '/functions/v1/instagram-metricas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-metricas-token', metricas_token
    ),
    -- Sem data fixa: a funcao determina o dia no momento da coleta.
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
END;
$$;

REVOKE ALL ON FUNCTION cerebro.instagram_coletar_agora() FROM PUBLIC, anon, authenticated;

-- O cron usa UTC: 11h/23h UTC = 7h/19h em America/Manaus.
-- O mesmo nome torna a instalacao idempotente, sem duplicar agendamentos.
-- A segunda coleta atualiza o mesmo retrato e permite recuperar falhas da manha.
SELECT cron.schedule(
  'instagram-metricas-diario',
  '0 11,23 * * *',
  $job$SELECT cerebro.instagram_coletar_agora();$job$
);

COMMIT;
