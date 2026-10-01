-- Contas fora da BM (hoje só o @dralexsa) entram na coleta pelo login do Instagram.
-- O token fica numa tabela sem grant nenhum: nem anon nem authenticated leem, e o
-- schema cerebro não passa pelo PostgREST. Quem lê e grava é o coletor, por RPC.
CREATE TABLE IF NOT EXISTS cerebro.instagram_tokens_login (
  ig_user_id    text PRIMARY KEY REFERENCES cerebro.instagram_contas(ig_user_id) ON DELETE CASCADE,
  token         text NOT NULL,
  expira_em     timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cerebro.instagram_tokens_login ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cerebro.instagram_tokens_login FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE cerebro.instagram_tokens_login IS
  'Token do login pelo Instagram para contas que o system user da BM não alcança. Segredo: sem grant para anon/authenticated.';

CREATE OR REPLACE FUNCTION public.instagram_tokens_login()
RETURNS TABLE (ig_user_id text, username text, token text, expira_em timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
  SELECT t.ig_user_id, c.username, t.token, t.expira_em
    FROM cerebro.instagram_tokens_login t
    JOIN cerebro.instagram_contas c ON c.ig_user_id = t.ig_user_id
   WHERE c.ativo;
$$;

CREATE OR REPLACE FUNCTION public.instagram_salvar_token_login(p_ig_user_id text, p_token text, p_expira_em timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
  UPDATE cerebro.instagram_tokens_login
     SET token = p_token, expira_em = p_expira_em, atualizado_em = now()
   WHERE ig_user_id = p_ig_user_id;
$$;

REVOKE ALL ON FUNCTION public.instagram_tokens_login() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.instagram_salvar_token_login(text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.instagram_tokens_login() TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_salvar_token_login(text, text, timestamptz) TO service_role;
