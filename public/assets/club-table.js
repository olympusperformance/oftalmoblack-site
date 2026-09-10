/* Colunas ajustáveis: a mesma grade continua alinhando cabeçalho e linhas. */
(function () {
  'use strict';

  var C = window.Club = window.Club || {};
  var MAX = 1200;

  C.ajustarColunas = function (raiz, opcoes) {
    var tabela = raiz.querySelector('.tbl');
    if (!tabela) return;
    var cab = tabela.querySelector('.tbl-h');
    var celulas = Array.prototype.slice.call(cab.children);
    var minimos = opcoes.minimos;
    var original = tabela.style.getPropertyValue('--cols');
    var estilo = getComputedStyle(cab), borda = getComputedStyle(tabela);
    var extra = parseFloat(estilo.paddingLeft) + parseFloat(estilo.paddingRight) +
      parseFloat(borda.borderLeftWidth) + parseFloat(borda.borderRightWidth) +
      (parseFloat(estilo.columnGap) || 0) * (celulas.length - 1);
    var larguras = null, arrasto = null, controles = [];
    var ferramentas = document.createElement('div');
    ferramentas.className = 'tbl-tools';
    ferramentas.innerHTML = '<span>Arraste as divisórias para ajustar as colunas.</span>' +
      '<button class="btn btn-sm btn-ghost" type="button">Restaurar colunas</button>';
    raiz.insertBefore(ferramentas, tabela.parentElement);
    var restaurar = ferramentas.querySelector('button');
    tabela.classList.add('tbl-resizable');
    tabela.style.minWidth = (minimos.reduce(function (a, b) { return a + b; }, 0) + extra) + 'px';

    function limitar(n, i) { return Math.round(Math.max(minimos[i], Math.min(MAX, n))); }

    function medidas() {
      return celulas.map(function (cel, i) {
        return limitar(cel.getBoundingClientRect().width || minimos[i], i);
      });
    }

    function aplicar(valores) {
      larguras = valores ? valores.slice() : null;
      tabela.style.setProperty('--cols', larguras
        ? larguras.map(function (n) { return n + 'px'; }).join(' ') : original);
      tabela.style.width = larguras
        ? (larguras.reduce(function (a, b) { return a + b; }, 0) + extra) + 'px' : '';
      restaurar.disabled = !larguras;
      controles.forEach(function (botao, i) {
        botao.setAttribute('aria-valuenow', larguras ? larguras[i] : medidas()[i]);
      });
    }

    function guardar() {
      try {
        if (larguras) localStorage.setItem(opcoes.chave, JSON.stringify(larguras));
        else localStorage.removeItem(opcoes.chave);
      } catch (err) { /* A interação continua mesmo sem armazenamento. */ }
    }

    function terminar(cancelar) {
      if (!arrasto) return;
      var a = arrasto;
      arrasto = null;
      if (cancelar || !a.moveu) aplicar(a.antes);
      else guardar();
      document.body.classList.remove('resizing-cols');
      a.botao.classList.remove('active');
      window.removeEventListener('blur', cancelarArrasto);
      window.removeEventListener('keydown', teclaArrasto);
      if (a.botao.hasPointerCapture(a.pointerId)) a.botao.releasePointerCapture(a.pointerId);
    }

    function cancelarArrasto() { terminar(true); }
    function teclaArrasto(e) {
      if (e.key === 'Escape') { e.preventDefault(); terminar(true); }
    }

    celulas.forEach(function (cel, i) {
      var nome = cel.textContent.trim();
      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'col-resize';
      botao.setAttribute('role', 'separator');
      botao.setAttribute('aria-orientation', 'vertical');
      botao.setAttribute('aria-label', 'Largura da coluna ' + nome);
      botao.setAttribute('aria-valuemin', minimos[i]);
      botao.setAttribute('aria-valuemax', MAX);
      botao.title = 'Arraste para ajustar. Use as setas ou dê dois cliques para restaurar esta coluna.';
      cel.appendChild(botao);
      controles.push(botao);

      botao.addEventListener('focus', function () {
        botao.setAttribute('aria-valuenow', medidas()[i]);
      });
      botao.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 || !e.isPrimary || arrasto) return;
        e.preventDefault();
        botao.focus();
        arrasto = { botao:botao, pointerId:e.pointerId, inicio:e.clientX,
          scroll:tabela.parentElement.scrollLeft, medidas:medidas(),
          antes:larguras && larguras.slice(), moveu:false };
        botao.setPointerCapture(e.pointerId);
        botao.classList.add('active');
        document.body.classList.add('resizing-cols');
        window.addEventListener('blur', cancelarArrasto);
        window.addEventListener('keydown', teclaArrasto);
      });
      botao.addEventListener('pointermove', function (e) {
        if (!arrasto || e.pointerId !== arrasto.pointerId) return;
        var delta = e.clientX - arrasto.inicio + tabela.parentElement.scrollLeft - arrasto.scroll;
        if (!arrasto.moveu && Math.abs(delta) < 2) return;
        arrasto.moveu = true;
        var valores = arrasto.medidas.slice();
        valores[i] = limitar(valores[i] + delta, i);
        aplicar(valores);
      });
      botao.addEventListener('pointerup', function () { terminar(false); });
      botao.addEventListener('pointercancel', cancelarArrasto);
      botao.addEventListener('lostpointercapture', cancelarArrasto);
      botao.addEventListener('dblclick', function () {
        var valores = medidas();
        valores[i] = minimos[i];
        aplicar(valores); guardar();
      });
      botao.addEventListener('keydown', function (e) {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) return;
        e.preventDefault();
        var valores = medidas(), passo = e.shiftKey ? 50 : 16;
        valores[i] = e.key === 'Home' ? minimos[i] : e.key === 'End' ? MAX
          : limitar(valores[i] + (e.key === 'ArrowRight' ? passo : -passo), i);
        aplicar(valores); guardar();
      });
    });

    restaurar.addEventListener('click', function () { aplicar(null); guardar(); });
    var salvas = null;
    try { salvas = JSON.parse(localStorage.getItem(opcoes.chave)); } catch (err) { /* ignora */ }
    if (!Array.isArray(salvas) || salvas.length !== minimos.length ||
        !salvas.every(function (n) { return typeof n === 'number' && Number.isFinite(n); })) salvas = null;
    aplicar(salvas ? salvas.map(limitar) : null);
  };
})();
