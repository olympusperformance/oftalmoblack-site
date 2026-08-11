/* ============================================================================
   Club OftalmoBlack — cliente do Supabase

   Uma instância só, compartilhada pelas três telas. Carregar este arquivo
   depois de vendor/supabase.js e de config.js.
   ========================================================================= */
(function () {
  'use strict';

  var C = window.Club = window.Club || {};
  var cfg = window.CLUB_CONFIG || {};

  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    /* Sem isto as telas quebrariam com "cannot read property of undefined" em
       algum ponto distante da causa real. */
    C.configError = 'Configuração do Supabase ausente. Confira o /config.js e as ' +
      'variáveis de ambiente do serviço.';
    return;
  }

  C.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: window.localStorage
    }
  });
})();
