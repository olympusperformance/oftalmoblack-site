-- Atualiza apenas o alcance diario retroativo, sem apagar retratos ou ganhos.
CREATE OR REPLACE FUNCTION public.instagram_sync_alcance_diario(p jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  INSERT INTO cerebro.instagram_metricas
        (ig_user_id, dia, alcance_dia, coletado_em)
  SELECT x.ig_user_id, x.dia, x.alcance_dia, now()
    FROM jsonb_to_recordset(p) AS x(
      ig_user_id text,
      dia date,
      alcance_dia integer
    )
   WHERE x.alcance_dia IS NOT NULL
  ON CONFLICT (ig_user_id, dia) DO UPDATE
     SET alcance_dia = EXCLUDED.alcance_dia,
         coletado_em = now();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

REVOKE ALL ON FUNCTION public.instagram_sync_alcance_diario(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.instagram_sync_alcance_diario(jsonb)
  TO service_role;
