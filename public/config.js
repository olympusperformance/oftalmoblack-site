/* ============================================================================
   Club OftalmoBlack — configuração de runtime

   Em produção este arquivo é REGERADO no boot do container por
   docker-entrypoint.d/10-config.sh a partir das variáveis de ambiente.

   As duas chaves abaixo são públicas por definição: a URL do projeto e a chave
   "publishable" (anon) foram feitas para viver no navegador. Quem protege os
   dados é o Row Level Security do Postgres, definido em supabase/schema.sql —
   sem login não se lê nada, e cada mentorado só alcança as próprias linhas.

   A chave "secret" (service_role) NUNCA entra aqui: ela ignora o RLS.
   ========================================================================= */
window.CLUB_CONFIG = {
  supabaseUrl: 'https://zpyxnkuvircukjlfexrv.supabase.co',
  supabaseAnonKey: 'sb_publishable_EYqtAFRJAZYxOINRqHXcjg_CuO4QDN7'
};
