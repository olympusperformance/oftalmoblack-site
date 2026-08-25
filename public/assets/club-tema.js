/* ============================================================================
   Club OftalmoBlack — tema claro e escuro

   Este arquivo entra no <head>, antes do corpo da página, e é o único que
   entra lá: se o tema fosse aplicado no fim do carregamento a tela piscaria
   escura antes de clarear, e o piscar aparece justamente para quem escolheu
   o claro — todas as vezes.

   O escuro é o padrão da marca. Quem nunca tocou no botão vê escuro, mesmo em
   máquina configurada no claro; a escolha, uma vez feita, fica guardada nesta
   máquina e vale para as três telas do sistema.
   ========================================================================= */
(function () {
  'use strict';

  var CHAVE = 'ob-tema';
  var raiz = document.documentElement;

  /* Sessão anônima e navegador com armazenamento bloqueado jogam aqui: sem
     onde guardar, o tema vale só enquanto a página estiver aberta. */
  function lido() {
    try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
  }
  function guardar(v) {
    try { localStorage.setItem(CHAVE, v); } catch (e) { /* sem onde guardar */ }
  }

  var T = window.ClubTema = {};

  T.atual = function () { return lido() === 'light' ? 'light' : 'dark'; };

  T.aplicar = function (tema) {
    if (tema === 'light') raiz.setAttribute('data-theme', 'light');
    else raiz.removeAttribute('data-theme');
    /* A barra do navegador no celular pinta junto com a página. A cor não está
       escrita aqui: sai do --bg que o tema acabou de pôr em pé, senão passaria a
       existir uma segunda verdade sobre o fundo do sistema. */
    var meta = document.querySelector('meta[name="theme-color"]');
    var fundo = getComputedStyle(raiz).getPropertyValue('--bg').trim();
    if (meta && fundo) meta.setAttribute('content', fundo);
    vestirBotoes(tema);
  };

  T.trocar = function () {
    var novo = T.atual() === 'light' ? 'dark' : 'light';
    guardar(novo);
    T.aplicar(novo);
    return novo;
  };

  /* O botão mostra para onde vai, não onde está: no escuro mostra o sol, que é
     o que o clique entrega. O rótulo diz a mesma coisa em palavras, para quem
     ouve a tela em vez de olhar. */
  function vestirBotoes(tema) {
    var vaiPara = tema === 'light' ? 'dark' : 'light';
    var icone = vaiPara === 'light' ? 'i-sun' : 'i-moon';
    var texto = vaiPara === 'light' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';
    var bs = document.querySelectorAll('[data-tema]');
    for (var i = 0; i < bs.length; i++) {
      bs[i].setAttribute('aria-label', texto);
      bs[i].setAttribute('title', texto);
      var uso = bs[i].querySelector('use');
      if (uso) {
        uso.setAttribute('href', '#' + icone);
        /* Navegador antigo lê o atributo com o prefixo antigo. */
        uso.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + icone);
      }
    }
  }

  /* Antes do corpo existir só dá para marcar a raiz; o botão é vestido e ligado
     quando o documento acaba de ser lido. */
  T.aplicar(T.atual());

  document.addEventListener('DOMContentLoaded', function () {
    vestirBotoes(T.atual());
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-tema]');
      if (b) T.trocar();
    });
  });
})();
