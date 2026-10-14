(function () {
  'use strict';
  var emailForm = document.getElementById('emailForm');
  var senhaForm = document.getElementById('senhaForm');
  var erro = document.getElementById('erro');
  var mensagem = document.getElementById('mensagem');
  var salvar = document.getElementById('salvar');
  var pronto = false;
  var hash = new URLSearchParams(location.hash.slice(1));
  var query = new URLSearchParams(location.search);
  var linkInvalido = hash.has('error') || query.has('error');
  var recuperacao = hash.get('type') === 'recovery';

  function falha(texto) { erro.textContent = texto; erro.hidden = false; }
  function aviso(texto) { mensagem.textContent = texto; mensagem.hidden = false; }
  function limparAvisos() { erro.hidden = true; mensagem.hidden = true; }
  function erroAuth(e) {
    if (/rate.limit|too many|after.*seconds/i.test(e.message || '') || e.status === 429) {
      return 'Espere um minuto antes de pedir outro link.';
    }
    if (/weak|password.*least|password.*short/i.test(e.message || '')) {
      return 'Use uma senha mais forte, com pelo menos 8 caracteres.';
    }
    if (/session|expired|invalid.*token/i.test(e.message || '')) {
      return 'O link expirou ou já foi usado. Peça um novo link.';
    }
    return 'Não foi possível concluir. Tente novamente ou fale com a equipe.';
  }

  if (Club.configError) { falha(Club.configError); return; }
  if (linkInvalido) {
    history.replaceState(null, '', location.pathname);
    emailForm.hidden = false;
    falha('O link expirou ou já foi usado. Peça um novo link.');
  }

  // getSession espera a inicialização do SDK e a validação do link. Não
  // habilitar o formulário apenas pela presença de um token na URL.
  Club.sb.auth.getSession().then(function (r) {
    if (r.error) throw r.error;
    var sessao = r.data && r.data.session;
    if (linkInvalido || !sessao) {
      emailForm.hidden = false;
      if (recuperacao && !linkInvalido) falha('O link expirou ou já foi usado. Peça um novo link.');
      return;
    }
    pronto = true;
    emailForm.hidden = true;
    senhaForm.hidden = false;
    salvar.disabled = false;
    document.getElementById('titulo').textContent = 'Definir nova senha';
    document.getElementById('descricao').textContent = 'Use pelo menos 8 caracteres.';
    // O SDK já validou e guardou a sessão. Remover tokens do endereço.
    history.replaceState(null, '', location.pathname);
  }).catch(function () {
    emailForm.hidden = false;
    falha('Não foi possível validar o acesso. Peça um novo link.');
  });

  emailForm.addEventListener('submit', function (e) {
    e.preventDefault();
    limparAvisos();
    if (!emailForm.reportValidity()) return;
    var botao = document.getElementById('enviar');
    botao.disabled = true;
    Club.sb.auth.resetPasswordForEmail(document.getElementById('email').value.trim(), {
      redirectTo: location.origin + '/recuperar-senha/'
    }).then(function (r) {
      if (r.error) throw r.error;
      aviso('Se este e-mail estiver cadastrado, você receberá um link. Confira também o spam e abra apenas o e-mail mais recente.');
    }).catch(function (err) { falha(erroAuth(err)); })
      .finally(function () { botao.disabled = false; });
  });

  senhaForm.addEventListener('submit', function (e) {
    e.preventDefault();
    limparAvisos();
    if (!pronto || salvar.disabled || !senhaForm.reportValidity()) return;
    var senha = document.getElementById('senha').value;
    if (senha !== document.getElementById('confirmacao').value) {
      falha('As senhas não são iguais.'); return;
    }
    salvar.disabled = true;
    Club.sb.auth.updateUser({ password: senha }).then(function (r) {
      if (r.error) throw r.error;
      pronto = false;
      senhaForm.reset();
      senhaForm.hidden = true;
      aviso('Senha atualizada. Volte para entrar com sua nova senha.');
      // Encerrar a sessão local de recuperação sem afetar outros dispositivos.
      return Club.sb.auth.signOut({ scope: 'local' });
    }).catch(function (err) {
      falha(erroAuth(err));
      salvar.disabled = false;
    });
  });
})();
