/* Teste de Arquétipo · motor do questionário e do resultado.
   A pontuação (score) e a escolha de principal, apoio e variações são as do
   teste original, linha a linha: triagem vale 4, aprofundamento vale 1 para o
   arquétipo e 3 para a variação; empate fica com a ordem de ARCH. */
(function () {
  'use strict';

  var ARCH = window.ARCH, Q = window.Q;
  var CHAVE = 'ob-teste-arquetipo-v1';
  var $ = function (id) { return document.getElementById(id); };

  var idx = 0;
  var answers = new Array(Q.length).fill(null);
  var usuario = { nome: '', cidade: '', data: '' };
  var concluido = false;
  var resultado = null;

  /* ── progresso salvo no aparelho (só conveniência; o teste funciona sem) ── */
  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ idx: idx, answers: answers, usuario: usuario, concluido: concluido }));
    } catch (e) {}
  }
  function lerSalvo() {
    try {
      var s = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (!s || !Array.isArray(s.answers) || s.answers.length !== Q.length) return null;
      return s;
    } catch (e) { return null; }
  }
  function apagarSalvo() {
    try { localStorage.removeItem(CHAVE); } catch (e) {}
  }

  /* ── navegação entre telas ── */
  function mostrar(id) {
    ['tela-capa', 'tela-quiz', 'tela-resultado'].forEach(function (t) {
      $(t).classList.toggle('ativa', t === id);
    });
    window.scrollTo(0, 0);
  }

  function hoje() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function startTest(ev) {
    if (ev) ev.preventDefault();
    var inp = $('i-nome');
    var nome = inp.value.trim();
    if (!nome) {
      inp.classList.add('erro');
      inp.setAttribute('aria-invalid', 'true');
      inp.focus();
      return;
    }
    if (answers.some(function (a) { return a !== null; }) &&
        !confirm('Começar do zero? As respostas salvas neste aparelho serão apagadas.')) return;
    usuario ={ nome: nome, cidade: $('i-cidade').value.trim(), data: $('i-data').value };
    idx = 0;
    answers = new Array(Q.length).fill(null);
    concluido = false;
    salvar();
    mostrar('tela-quiz');
    render();
  }

  function render() {
    var q = Q[idx];
    var n = String(idx + 1).padStart(2, '0');
    $('q-secao').textContent = q.secao;
    $('q-atual').textContent = n;
    $('q-pag').textContent = (idx + 1) + ' de ' + Q.length;
    $('q-fill').style.width = ((idx + 1) / Q.length * 100) + '%';
    $('q-barra').setAttribute('aria-valuenow', String(idx + 1));
    $('q-num').textContent = 'Pergunta ' + n;
    $('q-texto').textContent = q.texto;

    var box = $('q-opcoes');
    box.innerHTML = '';
    q.opcoes.forEach(function (o, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.setAttribute('aria-pressed', answers[idx] === i ? 'true' : 'false');
      var l = document.createElement('span');
      l.className = 'letra';
      l.setAttribute('aria-hidden', 'true');
      l.textContent = o.l;
      var t = document.createElement('span');
      t.textContent = o.t;
      b.appendChild(l);
      b.appendChild(t);
      b.addEventListener('click', function () { escolher(i); });
      box.appendChild(b);
    });

    $('btn-voltar').disabled = idx === 0;
    var nx = $('btn-proxima');
    nx.disabled = answers[idx] === null;
    nx.innerHTML = (idx === Q.length - 1 ? 'Ver resultado' : 'Próxima') + ' <span class="seta" aria-hidden="true">→</span>';
  }

  function escolher(i) {
    answers[idx] = i;
    salvar();
    var btns = $('q-opcoes').children;
    for (var k = 0; k < btns.length; k++) btns[k].setAttribute('aria-pressed', k === i ? 'true' : 'false');
    $('btn-proxima').disabled = false;
  }

  function next() {
    if (answers[idx] === null) return;
    if (idx === Q.length - 1) {
      showResult();
    } else {
      idx++;
      salvar();
      render();
      window.scrollTo(0, 0);
    }
  }

  function prev() {
    if (idx === 0) return;
    idx--;
    salvar();
    render();
    window.scrollTo(0, 0);
  }

  /* ── pontuação: idêntica ao original ── */
  function score() {
    var scores = {};
    Object.keys(ARCH).forEach(function (k) { scores[k] = { total: 0, vars: {} }; });
    answers.forEach(function (aIdx, qIdx) {
      if (aIdx === null) return;
      var opcao = Q[qIdx].opcoes[aIdx];
      var a = opcao.arch;
      var v = opcao.v;
      if (qIdx < 12) {
        scores[a].total += 4;
      } else {
        scores[a].total += 1;
        if (v) scores[a].vars[v] = (scores[a].vars[v] || 0) + 3;
      }
    });
    return scores;
  }

  function calcular() {
    var s = score();
    var ranking = Object.keys(s)
      .map(function (k) { return { k: k, total: s[k].total, vars: s[k].vars }; })
      .sort(function (a, b) { return b.total - a.total; });
    var primary = ranking[0], secondary = ranking[1];
    var pv = Object.entries(primary.vars).sort(function (a, b) { return b[1] - a[1]; });
    var sv = Object.entries(secondary.vars).sort(function (a, b) { return b[1] - a[1]; });
    var pVar = pv.length ? pv[0][0] : null;
    var sVar = sv.length ? sv[0][0] : null;
    var A = ARCH[primary.k], B = ARCH[secondary.k];
    var max = ranking[0].total || 1;
    return {
      usuario: usuario,
      principal: { chave: primary.k, nome: A.nome, desc: A.desc, essencia: A.essencia, ig: A.ig,
        variacao: pVar && A.variacoes[pVar] ? A.variacoes[pVar] : null },
      apoio: { chave: secondary.k, nome: B.nome, desc: B.desc,
        variacao: sVar && B.variacoes[sVar] ? B.variacoes[sVar] : null },
      ranking: ranking.map(function (r) {
        return { chave: r.k, nome: ARCH[r.k].nome.replace('O ', '').replace('A ', ''), total: r.total, pct: Math.round(r.total / max * 100) };
      })
    };
  }

  function showResult() {
    concluido = true;
    salvar();
    resultado = calcular();
    var r = resultado, P = r.principal, B = r.apoio;

    $('r-rotulo').textContent = 'Resultado · ' + (r.usuario.nome || '');
    $('r-arq').textContent = P.nome;
    $('r-var').textContent = P.variacao ? 'Variação · ' + P.variacao.nome : 'Arquétipo principal';
    $('r-desc').textContent = P.desc;

    var ess = $('r-essencia');
    ess.innerHTML = '';
    var p = document.createElement('p');
    p.innerHTML = P.essencia; // texto fixo de dados.js, com <strong>
    ess.appendChild(p);
    if (P.variacao) {
      var c = document.createElement('div');
      c.className = 'cartao filete vidro';
      c.innerHTML = '<p class="mini">Sua variação</p><p class="nome"></p><p></p>';
      c.children[1].textContent = P.variacao.nome;
      c.children[2].textContent = P.variacao.desc;
      ess.appendChild(c);
    }

    var ig = $('r-ig');
    ig.innerHTML = '';
    P.ig.forEach(function (card, i) {
      var d = document.createElement('div');
      d.className = 'cartao vidro';
      d.innerHTML = '<span class="ord" aria-hidden="true"></span><h4></h4><p></p>';
      d.children[0].textContent = String(i + 1).padStart(2, '0');
      d.children[1].textContent = card.t;
      d.children[2].textContent = card.d;
      ig.appendChild(d);
    });

    $('r-sec-nome').textContent = B.nome;
    $('r-sec-var').textContent = B.variacao ? 'Variação · ' + B.variacao.nome : 'Arquétipo de apoio';
    $('r-sec-desc').textContent = B.desc;

    var pl = $('r-placar');
    pl.innerHTML = '';
    r.ranking.forEach(function (row, i) {
      var l = document.createElement('div');
      l.className = 'linha' + (i === 0 ? ' top' : '');
      l.innerHTML = '<span class="n"></span><span class="b"><i></i></span><span class="v"></span>';
      l.children[0].textContent = row.nome;
      l.children[1].firstChild.style.width = row.pct + '%';
      l.children[2].textContent = row.total;
      pl.appendChild(l);
    });

    avisoPdf('');
    mostrar('tela-resultado');
    if (window.ArquetipoPDF) window.ArquetipoPDF.preparar();
  }

  function restart() {
    if (!confirm('Deseja refazer o teste? As respostas atuais serão apagadas.')) return;
    zerar();
  }

  function zerar() {
    idx = 0;
    answers = new Array(Q.length).fill(null);
    concluido = false;
    resultado = null;
    apagarSalvo();
    $('retomar').classList.remove('ativo');
    mostrar('tela-capa');
  }

  /* ── PDF ── */
  function avisoPdf(txt, erro) {
    document.querySelectorAll('.aviso-pdf').forEach(function (el) {
      el.textContent = txt;
      el.classList.toggle('erro', !!erro);
    });
  }
  function baixarPdf() {
    if (!resultado || !window.ArquetipoPDF) return;
    var btns = document.querySelectorAll('.js-pdf');
    btns.forEach(function (b) { b.disabled = true; });
    avisoPdf('Gerando o PDF…');
    window.ArquetipoPDF.baixar(resultado).then(function () {
      avisoPdf('PDF gerado. Confira a pasta de downloads do seu aparelho.');
    }).catch(function (e) {
      console.error(e);
      avisoPdf('Não foi possível gerar o PDF agora. Verifique a conexão e tente de novo.', true);
    }).then(function () {
      btns.forEach(function (b) { b.disabled = false; });
    });
  }

  /* ── início ── */
  function iniciar() {
    $('i-data').value = hoje();
    $('form-ident').addEventListener('submit', startTest);
    $('i-nome').addEventListener('input', function () {
      this.classList.remove('erro');
      this.removeAttribute('aria-invalid');
    });
    $('btn-voltar').addEventListener('click', prev);
    $('btn-proxima').addEventListener('click', next);
    $('btn-refazer').addEventListener('click', restart);
    document.querySelectorAll('.js-pdf').forEach(function (b) { b.addEventListener('click', baixarPdf); });

    document.addEventListener('keydown', function (e) {
      if (!$('tela-quiz').classList.contains('ativa')) return;
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.key === 'Enter') {
        if (answers[idx] !== null) { e.preventDefault(); next(); }
        return;
      }
      var k = e.key.toLowerCase();
      var pos = ['a', 'b', 'c', 'd'].indexOf(k);
      if (pos < 0) pos = ['1', '2', '3', '4'].indexOf(k);
      if (pos >= 0 && !e.ctrlKey && !e.metaKey && !e.altKey) escolher(pos);
    });

    var s = lerSalvo();
    if (s) {
      answers = s.answers;
      usuario = s.usuario || usuario;
      idx = Math.min(Math.max(0, s.idx | 0), Q.length - 1);
      concluido = !!s.concluido && answers.every(function (a) { return a !== null; });
      var feitas = answers.filter(function (a) { return a !== null; }).length;
      if (concluido || feitas > 0) {
        $('i-nome').value = usuario.nome || '';
        $('i-cidade').value = usuario.cidade || '';
        if (usuario.data) $('i-data').value = usuario.data;
        var partes = (usuario.nome || '').split(/\s+/);
        var nome = /^dr[aª]?\.?$/i.test(partes[0]) && partes[1] ? partes[0] + ' ' + partes[1] : partes[0];
        $('retomar-texto').innerHTML = concluido
          ? '<strong>' + esc(nome ? nome + ', você' : 'Você') + ' já concluiu o teste</strong> neste aparelho.'
          : '<strong>Você respondeu ' + feitas + ' de ' + Q.length + '</strong> perguntas neste aparelho.';
        $('btn-retomar').textContent = concluido ? 'Ver meu resultado' : 'Continuar';
        $('btn-retomar').onclick = function () {
          if (concluido) { showResult(); return; }
          mostrar('tela-quiz');
          render();
        };
        $('btn-zerar').onclick = function () {
          if (!confirm('Apagar as respostas salvas e começar do zero?')) return;
          zerar();
        };
        $('retomar').classList.add('ativo');
      }
    }
  }

  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── fundo animado da home (barras verticais), com quadro inicial síncrono
     para não depender de requestAnimationFrame em aba oculta ── */
  function fundo() {
    var cv = $('ob-canvas');
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var bars = [], cw = 0, ch = 0, t = 0, raf = null;
    var mouse = { x: 0, y: 0, tx: 0, ty: 0, active: false };
    var calmo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function montar() {
      var DPR = Math.min(window.devicePixelRatio || 1, 2);
      cw = window.innerWidth; ch = window.innerHeight;
      cv.width = cw * DPR; cv.height = ch * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      bars = [];
      var x = 0;
      while (x < cw) {
        var bw = 6 + Math.random() * 30;
        bars.push({ x: x, w: bw, base: 0.02 + Math.random() * 0.10, ph: Math.random() * Math.PI * 2, mid: 0.34 + Math.random() * 0.16 });
        x += bw + Math.random() * 3;
      }
      quadro();
    }
    function quadro() {
      t += 0.006;
      mouse.x += (mouse.tx - mouse.x) * 0.12;
      mouse.y += (mouse.ty - mouse.y) * 0.12;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      for (var i = 0; i < bars.length; i++) {
        var b = bars[i], cx = b.x + b.w / 2;
        var lum = b.base + 0.06 * (0.5 + 0.5 * Math.sin(cx * 0.012 - t * 1.6 + b.ph));
        if (mouse.active) {
          var g = Math.max(0, 1 - Math.abs(cx - mouse.x) / 240);
          lum += g * g * 0.30;
        }
        lum = Math.min(0.92, lum);
        var gr = ctx.createLinearGradient(0, 0, 0, ch);
        gr.addColorStop(0, 'rgba(0,0,0,0)');
        gr.addColorStop(b.mid, 'rgba(232,166,84,' + lum.toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(b.x, 0, b.w - 0.6, ch);
      }
    }
    function laco() { quadro(); raf = requestAnimationFrame(laco); }
    window.addEventListener('resize', montar);
    montar();
    if (calmo) return;
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      mouse.tx = e.clientX; mouse.ty = e.clientY; mouse.active = true;
    });
    raf = requestAnimationFrame(laco);
  }

  iniciar();
  fundo();
})();
