/* ============================================================================
   Club OftalmoBlack — cliente do Supabase

   Uma instância só, compartilhada pelas três telas. Carregar este arquivo
   depois de vendor/supabase.js e de config.js.
   ========================================================================= */
(function () {
  'use strict';

  // O login encaminha a recuperação antes de inicializar o SDK. Evitar
  // consumir o token nesta página enquanto a navegação ainda está pendente.
  var retorno = new URLSearchParams(location.hash.slice(1));
  if (location.pathname === '/entrar/' &&
      (retorno.get('type') === 'recovery' || retorno.has('error'))) return;

  var C = window.Club = window.Club || {};
  var cfg = window.CLUB_CONFIG || {};

  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    /* Sem isto as telas quebrariam com "cannot read property of undefined" em
       algum ponto distante da causa real. */
    C.configError = 'Configuração do Supabase ausente. Confira o /config.js e as ' +
      'variáveis de ambiente do serviço.';
    return;
  }

  /* A URL do projeto também é usada para chamar Edge Function (o chat do
     Cérebro), então fica à mão em vez de cada arquivo reler o config. */
  C.cfg = cfg;

  C.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: window.localStorage
    }
  });
})();
