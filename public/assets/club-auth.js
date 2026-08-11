/* ============================================================================
   Club OftalmoBlack — sessão e guarda de rota

   Autenticação de verdade, pelo Supabase Auth. A sessão vive no localStorage
   gerenciada pela própria biblioteca, com refresh automático do token.

   Quem é admin e quem é mentorado não vem do navegador: vem da função me() no
   Postgres, que lê a tabela app_admins. O navegador não tem como se promover.
   ========================================================================= */
(function () {
  'use strict';

  var C = window.Club = window.Club || {};
  var sessao = null;   // sessão normalizada, preenchida por ready()
  var pronto = null;   // Promise em voo, para não perguntar duas vezes

  /* O administrador não é mentorado, então não tem cadastro em members e fica
     sem nome. Nesse caso vale o que estiver no metadata do usuário (definível
     em Authentication → Users → Raw User Meta Data) e, na falta dele, a parte
     do e-mail antes do @ — melhor que estampar o endereço inteiro na tela. */
  function nomeDoAdmin(user, email) {
    var meta = user.user_metadata || {};
    if (meta.name) return meta.name;
    if (meta.full_name) return meta.full_name;
    var local = String(email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Administrador';
  }

  /* Traduz o retorno de me() para o formato que as telas consomem. */
  function normaliza(user, me) {
    var m = me && me.member;
    var email = (me && me.email) || user.email;
    var nome = m ? m.nome : nomeDoAdmin(user, email);
    return {
      userId: user.id,
      email: email,
      role: me && me.is_admin ? 'admin' : 'member',
      memberId: m ? m.id : null,
      member: m || null,
      name: nome,
      initials: m ? (m.iniciais || C.initials(m.nome)) : C.initials(nome)
    };
  }

  function carregarSessao() {
    if (C.configError) return Promise.reject(new Error(C.configError));

    return C.sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) { sessao = null; return null; }

      return C.sb.rpc('me').then(function (res) {
        if (res.error) throw res.error;
        sessao = normaliza(s.user, res.data);
        return sessao;
      });
    });
  }

  var auth = {
    /* Resolve com a sessão normalizada ou null. Idempotente. */
    ready: function () {
      if (!pronto) pronto = carregarSessao();
      return pronto;
    },

    /* Depois de ready(), dá a sessão sem esperar. */
    current: function () { return sessao; },

    login: function (email, senha) {
      return C.sb.auth.signInWithPassword({
        email: String(email || '').trim(),
        password: String(senha || '')
      }).then(function (r) {
        if (r.error) throw new Error(traduz(r.error));
        pronto = carregarSessao();
        return pronto;
      });
    },

    logout: function () {
      return C.sb.auth.signOut().then(function () {
        sessao = null;
        pronto = null;
        location.href = '/entrar/';
      });
    },

    homeFor: function (s) {
      return s && s.role === 'admin' ? '/admin/' : '/membros/';
    },

    /* Guarda de rota. Resolve com a sessão, ou redireciona e resolve com null.
       Quem chama deve parar o que está fazendo quando vier null. */
    require: function (role) {
      return auth.ready().then(function (s) {
        if (!s) {
          var back = encodeURIComponent(location.pathname + location.search);
          location.replace('/entrar/?de=' + back);
          return null;
        }
        if (role && s.role !== role) {
          location.replace(auth.homeFor(s));
          return null;
        }
        return s;
      });
    }
  };

  /* As mensagens do Supabase chegam em inglês e algumas são técnicas demais
     para mostrar a um mentorado. */
  function traduz(err) {
    var m = String(err.message || '');
    if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar.';
    if (/too many requests|rate limit/i.test(m)) {
      return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
    }
    if (/failed to fetch|network/i.test(m)) return 'Sem conexão com o servidor.';
    return m || 'Não foi possível entrar.';
  }

  C.auth = auth;
})();
