-- Atualiza somente o fluxo diario de novos seguidores. O coletor recebe uma
-- janela historica da Meta; usar o RPC geral apagaria os estoques ja salvos
-- quando a linha trouxesse apenas seguidores_ganhos.
CREATE OR REPLACE FUNCTION public.instagram_sync_seguidores_ganhos(p jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  INSERT INTO cerebro.instagram_metricas
        (ig_user_id, dia, seguidores_ganhos, coletado_em)
  SELECT x.ig_user_id, x.dia, x.seguidores_ganhos, now()
    FROM jsonb_to_recordset(p) AS x(
      ig_user_id text,
      dia date,
      seguidores_ganhos integer
    )
   WHERE x.seguidores_ganhos IS NOT NULL
  ON CONFLICT (ig_user_id, dia) DO UPDATE
     SET seguidores_ganhos = EXCLUDED.seguidores_ganhos,
         coletado_em = now();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

REVOKE ALL ON FUNCTION public.instagram_sync_seguidores_ganhos(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.instagram_sync_seguidores_ganhos(jsonb)
  TO service_role;

COMMENT ON FUNCTION public.instagram_sync_seguidores_ganhos(jsonb) IS
  'Upsert restrito do follower_count diario retornado pela Meta; somente service_role.';
