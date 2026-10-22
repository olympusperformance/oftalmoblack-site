/* Teste DISC · telas, questionário e resultado.
   A página diz para quem é o teste em <body data-publico="medico|equipe">;
   sem público, mostra a escolha entre os dois.
   Pontuação igual à do teste original: o perfil Adaptado conta as palavras
   marcadas como MAIS; o Natural é 24 - menos - (24 - mais - menos) / 2,
   arredondado. O fator predominante é o maior Adaptado. Única diferença: no
   empate do Adaptado decide o Natural (o original ficava com a ordem
   D, I, S, C, o que puxava todo empate para o D). */
(function () {
  'use strict';

  var DISC = window.DISC;
  var ORDEM = DISC.ORDEM, GRUPOS = DISC.GRUPOS, F = DISC.FATORES;
  var TOTAL = GRUPOS.length;
  var $ = function (id) { return document.getElementById(id); };

  /* ── pontuação (função pura; a conferência automática usa a mesma) ── */
  function pontuar(respostas) {
    var mais = { D: 0, I: 0, S: 0, C: 0 }, menos = { D: 0, I: 0, S: 0, C: 0 };
    respostas.forEach(function (r) {
      if (r && r.mais) mais[r.mais]++;
      if (r && r.menos) menos[r.menos]++;
    });
    var adaptado = {}, natural = {};
    ORDEM.forEach(function (k) {
      adaptado[k] = mais[k];
      natural[k] = Math.max(0, Math.round(TOTAL - menos[k] - (TOTAL - mais[k] - menos[k]) / 2));
    });
    var ranking = ORDEM.slice().sort(function (a, b) {
      return (adaptado[b] - adaptado[a]) || (natural[b] - natural[a]) || (ORDEM.indexOf(a) - ORDEM.indexOf(b));
    });
    return { mais: mais, menos: menos, adaptado: adaptado, natural: natural, ranking: ranking, principal: ranking[0], secundario: ranking[1] };
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function embaralhar(a) {
    var x = a.slice();
    for (var i = x.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = x[i]; x[i] = x[j]; x[j] = t;
    }
    return x;
  }
  function hoje() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function lista(itens) {
    return '<ul class="lista">' + itens.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
  }
  function letra(k) {
    return '<span class="letra-f" style="--cor:' + F[k].cor + '">' + k + '</span>';
  }
  var SETA = '<span class="seta" aria-hidden="true">→</span>';
  var ICONE_PDF = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 20h16"/></svg>';

  var publico = document.body.getAttribute('data-publico') || '';
  var P = DISC.PUBLICOS[publico] || null;
  var app = $('app');

  /* ── escolha entre médico e equipe (/teste-disc/) ── */
  function telaEscolha() {
    app.innerHTML =
      '<section class="tela ativa" id="tela-escolha" aria-labelledby="titulo-escolha"><div class="capa">' +
        '<p class="eyebrow">Club OftalmoBlack</p>' +
        '<h1 id="titulo-escolha">Teste <span class="grifo">DISC</span></h1>' +
        '<p class="sub">Perfil comportamental<span class="sep"> · </span><span class="nw">24 grupos · ± 10 minutos</span></p>' +
        '<p class="chamada"><em>O mesmo teste,</em><br>dois relatórios.</p>' +
        '<p class="lead">Escolha quem vai responder. As palavras são as mesmas; o resultado muda conforme o papel na clínica.</p>' +
        '<div class="escolhas">' +
          '<a class="escolha vidro" href="/teste-disc/medico/">' +
            '<span class="mini">Para o médico</span><span class="nome">Mestres do Black</span>' +
            '<span class="txt">Temperamento, liderança da clínica, condução da consulta com cada tipo de paciente e os perfis que completam o seu na equipe.</span>' +
            '<span class="ir">Fazer o teste ' + SETA + '</span></a>' +
          '<a class="escolha vidro" href="/teste-disc/equipe/">' +
            '<span class="mini">Para a equipe</span><span class="nome">Equipe da clínica</span>' +
            '<span class="txt">Secretária, SDR, closer, gestão e toda a equipe: temperamento, funções em que a pessoa rende mais, atendimento ao paciente e como liderar esse perfil.</span>' +
            '<span class="ir">Fazer o teste ' + SETA + '</span></a>' +
        '</div>' +
        '<p class="rodape">Confidencial · Uso interno · Club OftalmoBlack</p>' +
      '</div></section>';
  }

  /* ── teste de um público ── */
  var CHAVE = 'ob-teste-disc-' + publico + '-v1';
  var idx = 0;
  var respostas = novasRespostas();
  var ordem = novaOrdem();
  var usuario = { data: '' };
  var concluido = false;
  var resultado = null;

  function novasRespostas() {
    return GRUPOS.map(function () { return { mais: null, menos: null }; });
  }
  function novaOrdem() {
    return GRUPOS.map(function () { return embaralhar(ORDEM); });
  }
  function completo(r) { return !!(r && r.mais && r.menos && r.mais !== r.menos); }
  function feitas() { return respostas.filter(completo).length; }

  /* progresso salvo no aparelho (só conveniência; o teste funciona sem) */
  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ idx: idx, respostas: respostas, ordem: ordem, usuario: usuario, concluido: concluido }));
    } catch (e) {}
  }
  function lerSalvo() {
    try {
      var s = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (!s || !Array.isArray(s.respostas) || s.respostas.length !== TOTAL) return null;
      if (!Array.isArray(s.ordem) || s.ordem.length !== TOTAL) s.ordem = novaOrdem();
      var ok = function (k) { return k === null || ORDEM.indexOf(k) >= 0; };
      s.respostas = s.respostas.map(function (r) {
        return r && ok(r.mais) && ok(r.menos) ? { mais: r.mais, menos: r.menos } : { mais: null, menos: null };
      });
      return s;
    } catch (e) { return null; }
  }
  function apagarSalvo() {
    try { localStorage.removeItem(CHAVE); } catch (e) {}
  }

  function mostrar(id) {
    ['tela-capa', 'tela-quiz', 'tela-resultado'].forEach(function (t) {
      $(t).classList.toggle('ativa', t === id);
    });
    window.scrollTo(0, 0);
  }

  function montarTelas() {
    var chips =
      '<div class="chips">' +
        '<span class="chip"><svg viewBox="0 0 24 24" fill="none" stroke="#d89d4d" stroke-width="1.5" stroke-linecap="round"><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 9.3h17M3.5 14.7h17"/></svg>24 grupos</span>' +
        '<span class="chip"><svg viewBox="0 0 24 24" fill="none" stroke="#d89d4d" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.6 2.2M9.5 2.5h5"/></svg>± 10 minutos</span>' +
        '<span class="chip"><svg viewBox="0 0 24 24" fill="none" stroke="#d89d4d" stroke-width="1.5" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.3" fill="#fdf3b5" stroke="none"/></svg>Confidencial</span>' +
      '</div>';

    var principal = P.campos[0];
    var outros = P.campos.slice(1).map(function (c) {
      return '<div class="campo"><label for="i-' + c.id + '">' + esc(c.rotulo) + '</label>' +
        '<input type="text" id="i-' + c.id + '" name="' + c.id + '" autocomplete="' + c.autocomplete + '" placeholder="' + esc(c.placeholder) + '"></div>';
    }).join('') +
      '<div class="campo"><label for="i-data">Data</label><input type="date" id="i-data" name="data"></div>';

    app.innerHTML =
      /* capa */
      '<section class="tela ativa" id="tela-capa" aria-labelledby="titulo-capa"><div class="capa">' +
        '<p class="eyebrow">Club OftalmoBlack</p>' +
        '<h1 id="titulo-capa">Teste <span class="grifo">DISC</span></h1>' +
        '<p class="sub">' + esc(P.titulo) + '<span class="sep"> · </span><span class="nw">24 grupos de palavras</span></p>' +
        '<p class="chamada"><em>' + esc(P.chamada[0]) + '</em><br>' + esc(P.chamada[1]) + '</p>' +
        '<p class="lead">' + esc(P.lead) + ' Confidencial e de uso interno.</p>' +
        chips +
        '<div class="retomar vidro" id="retomar" role="status"><p id="retomar-texto"></p><div class="acoes">' +
          '<button type="button" class="btn btn-ouro" id="btn-retomar"></button>' +
          '<button type="button" class="btn btn-linha" id="btn-zerar">Recomeçar</button></div></div>' +
        '<div class="bloco-capa vidro"><h2>Instruções</h2><ol class="passos">' +
          '<li>Cada grupo tem quatro palavras. Marque a que <strong>mais</strong> combina com você e a que <strong>menos</strong> combina.</li>' +
          '<li>' + esc(P.contexto) + '</li>' +
          '<li>Vá na primeira impressão. Não existe perfil bom ou ruim, nem resposta certa.</li>' +
          '<li>O progresso fica salvo neste aparelho. Se precisar parar, é só voltar ao mesmo link.</li>' +
        '</ol></div>' +
        '<form class="bloco-capa vidro" id="form-ident" novalidate><h2>Identificação</h2>' +
          '<div class="campo"><label for="i-' + principal.id + '">' + esc(principal.rotulo) + '</label>' +
            '<input type="text" id="i-' + principal.id + '" name="' + principal.id + '" autocomplete="' + principal.autocomplete + '" placeholder="' + esc(principal.placeholder) + '" required>' +
            '<p class="msg">Informe seu nome para continuar.</p></div>' +
          '<div class="campos-grade">' + outros + '</div>' +
        '</form>' +
        '<div class="cta"><button type="submit" form="form-ident" class="btn btn-ouro" id="btn-iniciar">Iniciar o teste ' + SETA + '</button></div>' +
      '</div></section>' +

      /* questionário */
      '<section class="tela" id="tela-quiz" aria-label="Grupos de palavras">' +
        '<div class="progresso"><div class="info"><span class="secao">Teste DISC</span>' +
          '<span class="conta"><b id="q-atual">01</b> <span>/ ' + TOTAL + '</span></span></div>' +
          '<div class="barra" role="progressbar" aria-valuemin="1" aria-valuemax="' + TOTAL + '" aria-valuenow="1" id="q-barra"><i id="q-fill"></i></div></div>' +
        '<div class="qcard vidro">' +
          '<p class="qnum" id="q-num">Grupo 01</p>' +
          '<h2 class="qtexto" id="q-texto">Qual palavra <em>mais</em> combina com você? E qual <em>menos</em> combina?</h2>' +
          '<p class="qdica">' + esc(P.dica) + ' Vá na primeira impressão.</p>' +
          '<div class="palavras" id="q-palavras" role="group" aria-labelledby="q-num q-texto"></div>' +
          '<p class="q-status" id="q-status" aria-live="polite"></p>' +
        '</div>' +
        '<div class="nav">' +
          '<button type="button" class="btn btn-linha" id="btn-voltar"><span class="seta" aria-hidden="true">←</span> Voltar</button>' +
          '<span class="pag" id="q-pag">1 de ' + TOTAL + '</span>' +
          '<button type="button" class="btn btn-ouro" id="btn-proxima" disabled>Próximo ' + SETA + '</button>' +
        '</div>' +
      '</section>' +

      /* resultado */
      '<section class="tela" id="tela-resultado" aria-label="Resultado do teste"></section>';
  }

  /* ── capa ── */
  function lerUsuario() {
    var u = { data: $('i-data').value };
    P.campos.forEach(function (c) { u[c.id] = $('i-' + c.id).value.trim(); });
    return u;
  }
  function preencherCapa() {
    P.campos.forEach(function (c) { if (usuario[c.id]) $('i-' + c.id).value = usuario[c.id]; });
    $('i-data').value = usuario.data || hoje();
  }

  function iniciarTeste(ev) {
    if (ev) ev.preventDefault();
    var inp = $('i-nome');
    if (!inp.value.trim()) {
      inp.classList.add('erro');
      inp.setAttribute('aria-invalid', 'true');
      inp.focus();
      return;
    }
    if (respostas.some(function (r) { return r.mais || r.menos; }) &&
        !confirm('Começar do zero? As respostas salvas neste aparelho serão apagadas.')) return;
    usuario = lerUsuario();
    idx = 0;
    respostas = novasRespostas();
    ordem = novaOrdem();
    concluido = false;
    resultado = null;
    salvar();
    mostrar('tela-quiz');
    renderGrupo();
  }

  /* ── questionário ── */
  function renderGrupo() {
    var g = GRUPOS[idx];
    var n = String(idx + 1).padStart(2, '0');
    $('q-atual').textContent = n;
    $('q-pag').textContent = (idx + 1) + ' de ' + TOTAL;
    $('q-fill').style.width = ((idx + 1) / TOTAL * 100) + '%';
    $('q-barra').setAttribute('aria-valuenow', String(idx + 1));
    $('q-num').textContent = 'Grupo ' + n;

    var box = $('q-palavras');
    box.innerHTML = '';
    ordem[idx].forEach(function (k) {
      var linha = document.createElement('div');
      linha.className = 'palavra';
      linha.setAttribute('data-k', k);
      var txt = document.createElement('span');
      txt.className = 'p-txt';
      txt.textContent = g[k];
      var bot = document.createElement('span');
      bot.className = 'p-botoes';
      [['mais', 'Mais'], ['menos', 'Menos']].forEach(function (par) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'marca ' + par[0];
        b.textContent = par[1];
        b.setAttribute('aria-label', g[k] + ': ' + par[1].toLowerCase() + ' combina comigo');
        b.addEventListener('click', function () { marcar(k, par[0]); });
        bot.appendChild(b);
      });
      linha.appendChild(txt);
      linha.appendChild(bot);
      box.appendChild(linha);
    });
    $('btn-voltar').disabled = idx === 0;
    atualizarGrupo();
  }

  function marcar(k, lado) {
    var r = respostas[idx];
    if (lado === 'mais') {
      if (r.menos === k) r.menos = null;
      r.mais = r.mais === k ? null : k;
    } else {
      if (r.mais === k) r.mais = null;
      r.menos = r.menos === k ? null : k;
    }
    salvar();
    atualizarGrupo();
  }

  function atualizarGrupo() {
    var r = respostas[idx];
    var linhas = $('q-palavras').children;
    for (var i = 0; i < linhas.length; i++) {
      var k = linhas[i].getAttribute('data-k');
      linhas[i].classList.toggle('e-mais', r.mais === k);
      linhas[i].classList.toggle('e-menos', r.menos === k);
      linhas[i].querySelector('.mais').setAttribute('aria-pressed', r.mais === k ? 'true' : 'false');
      linhas[i].querySelector('.menos').setAttribute('aria-pressed', r.menos === k ? 'true' : 'false');
    }
    var ultimo = idx === TOTAL - 1;
    var pronto = completo(r);
    $('q-status').textContent = pronto ? (ultimo ? 'Pronto para ver o resultado.' : 'Pronto para avançar.')
      : r.mais ? 'Falta marcar a palavra que MENOS combina.'
      : r.menos ? 'Falta marcar a palavra que MAIS combina.'
      : 'Marque uma palavra em MAIS e outra em MENOS.';
    $('q-status').classList.toggle('ok', pronto);
    var nx = $('btn-proxima');
    nx.disabled = !pronto;
    nx.innerHTML = (ultimo ? 'Ver resultado' : 'Próximo') + ' ' + SETA;
  }

  function proximo() {
    if (!completo(respostas[idx])) return;
    if (idx === TOTAL - 1) {
      mostrarResultado();
    } else {
      idx++;
      salvar();
      renderGrupo();
      window.scrollTo(0, 0);
    }
  }
  function voltar() {
    if (idx === 0) return;
    idx--;
    salvar();
    renderGrupo();
    window.scrollTo(0, 0);
  }

  /* ── resultado ── */
  function calcular() {
    var pt = pontuar(respostas);
    var combo = DISC.COMBOS[pt.principal + pt.secundario] || null;
    return { publico: publico, usuario: usuario, pontos: pt, principal: F[pt.principal], secundario: F[pt.secundario], combo: combo };
  }

  function graficoHTML(titulo, sub, valores) {
    var max = Math.max(valores.D, valores.I, valores.S, valores.C, 8);
    return '<div class="grafico vidro"><p class="g-tit">Perfil <em>' + titulo + '</em></p><p class="g-sub">' + sub + '</p><div class="barras">' +
      ORDEM.map(function (k) {
        var pct = Math.max(4, Math.round(valores[k] / max * 100));
        return '<div class="col"><span class="v">' + valores[k] + '</span><span class="trilho"><i style="height:' + pct + '%;background:' + F[k].cor + '"></i></span>' +
          '<span class="l">' + k + '</span><span class="lf">' + F[k].fator + '</span></div>';
      }).join('') + '</div></div>';
  }

  function bloco(num, titulo, corpo) {
    return '<div class="res-bloco"><div class="cab"><span class="num">' + num + '</span><h3>' + titulo + '</h3></div>' + corpo + '</div>';
  }

  function matrizHTML(m) {
    return '<div class="matriz">' + ORDEM.map(function (k) {
      return '<div class="cartao vidro m-item">' +
        '<p class="m-cab">' + letra(k) + '<span>' + esc(F[k].paciente) + '</span></p>' +
        '<p><b>Risco:</b> ' + esc(m[k][0]) + '</p><p><b>Ajuste:</b> ' + esc(m[k][1]) + '</p></div>';
    }).join('') + '</div>';
  }

  function blocosMedico(A, n) {
    var M = A.medico;
    return [
      bloco(n(), 'Você na liderança da clínica',
        '<div class="corpo"><p>' + esc(M.lideranca.texto) + '</p></div>' +
        '<div class="ig">' + M.lideranca.praticas.map(function (t, i) {
          return '<div class="cartao vidro"><span class="ord" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span><p class="ig-txt">' + esc(t) + '</p></div>';
        }).join('') + '</div>'),
      bloco(n(), 'Você na consulta',
        '<div class="cartao filete vidro"><p class="mini">Como você conduz naturalmente</p><p>' + esc(M.conduz.forca) + '</p>' +
          '<p class="risco"><b>Risco:</b> ' + esc(M.conduz.risco) + '</p></div>' +
        '<p class="intro-m">Com cada tipo de paciente:</p>' + matrizHTML(M.matriz)),
      bloco(n(), 'Quem completa o seu perfil na equipe',
        '<div class="corpo"><p>' + esc(M.complemento.texto) + '</p></div>' +
        '<div class="comp">' + M.complemento.perfis.map(function (p) {
          return '<div class="cartao vidro c-item"><p class="m-cab">' + letra(p[0]) + '<span>Perfil ' + p[0] + ' · ' + esc(F[p[0]].temperamento) + '</span></p><p>' + esc(p[1].charAt(0).toUpperCase() + p[1].slice(1)) + '.</p></div>';
        }).join('') + '</div>' +
        '<p class="nota">' + esc(P.contratar) + '</p>')
    ];
  }

  function blocosEquipe(A, B, n) {
    var E = A.equipe;
    return [
      bloco(n(), 'Onde você rende mais na clínica',
        '<div class="corpo"><p>Funções em que esse perfil costuma render mais:</p></div>' + lista(E.funcoes) +
        '<div class="cartao filete vidro"><p class="mini">Ambiente ideal</p><p>' + esc(A.ambiente) + '</p>' +
          '<p class="risco"><b>Rende pouco em:</b> ' + esc(E.poucoRende.charAt(0).toLowerCase() + E.poucoRende.slice(1)) + '</p></div>' +
        '<p class="nota">' + esc(P.ressalva) + '</p>'),
      bloco(n(), 'No atendimento ao paciente',
        '<div class="corpo"><p>' + esc(P.apostila) + ' O seu é <strong>' + esc(A.temperamento) + '</strong>, com <strong>' + esc(B.temperamento) + '</strong> como secundário.</p></div>' +
        '<div class="cartao filete vidro"><p class="mini">Como você atende naturalmente</p><p>' + esc(E.atende.forca) + '</p>' +
          '<p class="risco"><b>Risco:</b> ' + esc(E.atende.risco) + '</p></div>' +
        '<p class="intro-m">Com cada tipo de paciente:</p>' + matrizHTML(E.matriz)),
      bloco(n(), 'Como liderar este perfil', '<div class="corpo"><p>' + esc(A.liderar) + '</p></div>')
    ];
  }

  function mostrarResultado() {
    concluido = true;
    salvar();
    resultado = calcular();
    var r = resultado, A = r.principal, B = r.secundario, pt = r.pontos;
    var c = 0;
    var n = function () { c++; return String(c).padStart(2, '0'); };

    var essencia = bloco(n(), 'Sua essência',
      '<div class="corpo"><p>' + esc(A.essencia) + '</p></div>' +
      '<div class="duas">' +
        (r.combo ? '<div class="cartao filete vidro"><p class="mini">Combinação ' + A.letra + ' + ' + B.letra + '</p><p class="nome">' + esc(r.combo[0]) + '</p><p>' + esc(r.combo[1]) + '</p></div>' : '') +
        '<div class="cartao filete vidro"><p class="mini">Temperamento</p><p class="nome">' + esc(A.temperamento) + '</p>' +
          '<p>Com ' + esc(B.temperamento) + ' como secundário. O que te move: ' + esc(A.move) + '.</p></div>' +
      '</div>');

    var graficos = bloco(n(), 'Seus dois perfis',
      '<div class="corpo"><p>' + esc(DISC.GRAFICOS) + '</p></div>' +
      '<div class="graficos">' +
        graficoHTML('Adaptado', 'No trabalho hoje · a “máscara”', pt.adaptado) +
        graficoHTML('Natural', 'Sob pressão · o “núcleo”', pt.natural) +
      '</div>' +
      '<div class="legenda">' + ORDEM.map(function (k) {
        return '<p>' + letra(k) + '<span><b>' + F[k].fator + '.</b> ' + F[k].eixo + '.</span></p>';
      }).join('') + '</div>');

    var comunica = bloco(n(), 'Como você se comunica', '<div class="corpo"><p>' + esc(A.comunicacao) + '</p></div>');

    var forcas = bloco(n(), 'Forças e pontos de atenção',
      '<div class="duas"><div class="cartao vidro"><p class="mini">Forças naturais</p>' + lista(A.forcas) + '</div>' +
      '<div class="cartao vidro"><p class="mini">Pontos de atenção</p>' + lista(A.atencao) + '</div></div>');

    var especificos = publico === 'medico' ? blocosMedico(A, n) : blocosEquipe(A, B, n);

    var desenv = bloco(n(), 'Plano de desenvolvimento', lista(A.desenvolver));

    var acoes = '<div class="acoes-res"><button type="button" class="btn btn-ouro js-pdf">' + ICONE_PDF + 'Baixar resultado em PDF</button></div>' +
      '<p class="aviso-pdf" aria-live="polite"></p>';
    var proximos = bloco(n(), 'Próximos passos',
      '<div class="corpo"><p>' + esc(P.proximos) + '</p></div>' +
      '<div class="acoes-res"><button type="button" class="btn btn-ouro js-pdf">' + ICONE_PDF + 'Baixar resultado em PDF</button>' +
        '<button type="button" class="btn btn-linha" id="btn-refazer">Refazer o teste</button></div>' +
      '<p class="aviso-pdf" aria-live="polite"></p>');

    $('tela-resultado').innerHTML =
      '<div class="res-hero">' +
        '<p class="eyebrow" id="r-rotulo"></p>' +
        '<p class="rotulo">Seu perfil predominante</p>' +
        '<h1 class="arq"><span class="grifo">' + esc(A.fator) + '</span></h1>' +
        '<p class="var">Perfil ' + A.letra + ' · Temperamento ' + esc(A.temperamento) + '</p>' +
        '<p class="desc">' + esc(A.tracos) + '</p>' +
        acoes +
      '</div>' +
      essencia + graficos + comunica + forcas + especificos.join('') + desenv + proximos +
      '<p class="rodape">Confidencial · Uso interno · Club OftalmoBlack</p>';
    $('r-rotulo').textContent = 'Resultado · ' + (usuario.nome || '');

    document.querySelectorAll('.js-pdf').forEach(function (b) { b.addEventListener('click', baixarPdf); });
    $('btn-refazer').addEventListener('click', refazer);
    avisoPdf('');
    mostrar('tela-resultado');
    if (window.DiscPDF) window.DiscPDF.preparar();
  }

  function refazer() {
    if (!confirm('Deseja refazer o teste? As respostas atuais serão apagadas.')) return;
    zerar();
  }
  function zerar() {
    idx = 0;
    respostas = novasRespostas();
    ordem = novaOrdem();
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
    if (!resultado || !window.DiscPDF) return;
    var btns = document.querySelectorAll('.js-pdf');
    btns.forEach(function (b) { b.disabled = true; });
    avisoPdf('Gerando o PDF…');
    window.DiscPDF.baixar(resultado).then(function () {
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
    montarTelas();
    preencherCapa();
    $('form-ident').addEventListener('submit', iniciarTeste);
    $('i-nome').addEventListener('input', function () {
      this.classList.remove('erro');
      this.removeAttribute('aria-invalid');
    });
    $('btn-voltar').addEventListener('click', voltar);
    $('btn-proxima').addEventListener('click', proximo);

    var s = lerSalvo();
    if (!s) return;
    respostas = s.respostas;
    ordem = s.ordem;
    usuario = s.usuario || usuario;
    idx = Math.min(Math.max(0, s.idx | 0), TOTAL - 1);
    concluido = !!s.concluido && respostas.every(completo);
    var nfeitas = feitas();
    if (!concluido && nfeitas === 0 && !respostas.some(function (r) { return r.mais || r.menos; })) return;
    preencherCapa();
    var partes = (usuario.nome || '').split(/\s+/);
    var nome = /^dr[aª]?\.?$/i.test(partes[0]) && partes[1] ? partes[0] + ' ' + partes[1] : partes[0];
    $('retomar-texto').innerHTML = concluido
      ? '<strong>' + esc(nome ? nome + ', você' : 'Você') + ' já concluiu o teste</strong> neste aparelho.'
      : '<strong>Você respondeu ' + nfeitas + ' de ' + TOTAL + '</strong> grupos neste aparelho.';
    $('btn-retomar').textContent = concluido ? 'Ver meu resultado' : 'Continuar';
    $('btn-retomar').onclick = function () {
      if (concluido) { mostrarResultado(); return; }
      mostrar('tela-quiz');
      renderGrupo();
    };
    $('btn-zerar').onclick = function () {
      if (!confirm('Apagar as respostas salvas e começar do zero?')) return;
      zerar();
    };
    $('retomar').classList.add('ativo');
  }

  /* ── fundo animado da home (barras verticais), com quadro inicial síncrono
     para não depender de requestAnimationFrame em aba oculta ── */
  function fundo() {
    var cv = $('ob-canvas');
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var bars = [], cw = 0, ch = 0, t = 0;
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
    function laco() { quadro(); requestAnimationFrame(laco); }
    window.addEventListener('resize', montar);
    montar();
    if (calmo) return;
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      mouse.tx = e.clientX; mouse.ty = e.clientY; mouse.active = true;
    });
    requestAnimationFrame(laco);
  }

  // usados na conferência automática
  window.DISCTeste = { pontuar: pontuar, resultado: function () { return resultado; } };
  if (P) iniciar(); else telaEscolha();
  fundo();
})();
