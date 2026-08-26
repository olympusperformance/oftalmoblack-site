/* ============================================================================
   Club OftalmoBlack — quadro de demandas na TV

   Nenhum login: quem lê o banco é a Edge Function demandas-tv, com a chave
   service_role que nunca sai de lá. As tabelas do quadro seguem fechadas para
   `anon` no RLS, então esta tela não abre caminho nenhum para o resto do banco.

   Quem decide se pede senha é o servidor, não este arquivo: a tela tenta ler o
   quadro direto e só desenha o portão se a função responder que precisa de
   senha (DEMANDAS_SENHA definida no projeto). Hoje o quadro está no modo
   público — nada a digitar na TV. Trancar depois é mexer na variável de
   ambiente; esta tela passa a pedir a senha sozinha.

   Quando pede, a senha digitada fica no localStorage desta TV para a tela
   voltar sozinha depois de uma queda de luz; é o mesmo risco de um post-it
   atrás do aparelho, e sem isso alguém teria que subir numa cadeira com
   teclado toda manhã.

   Depois que o quadro abre, nada nesta tela é clicável: ela relê o banco a cada
   meio minuto e gira as colunas que não couberam na altura da tela.
   ========================================================================= */
(function () {
  'use strict';

  var C = window.Club || {};
  var cfg = window.CLUB_CONFIG || {};

  var CHAVE     = 'ob-tv-senha';
  var RECARGA   = 30000;   /* nova leitura do banco */
  var GIRO      = 20000;   /* troca de página das colunas cheias */
  var RELOGIO   = 15000;
  var VELHO     = 3 * 60 * 1000;  /* a partir daqui o "atualizado" vira aviso */

  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc;

  var senha = null;
  var dados = null;        /* última leitura boa — a tela nunca fica em branco */
  var lidoEm = 0;
  var falhando = false;
  /* Quantos cartões couberam e em que página está cada situação. Vive fora do
     render porque o giro precisa lembrar disso entre uma leitura e outra. */
  var pagina = {};
  var couberam = {};

  /* ── portão ───────────────────────────────────────────────────────────── */

  function mostrarPortao(msg) {
    $('quadro').hidden = true;
    $('portao').hidden = false;
    var e = $('erro');
    e.hidden = !msg;
    e.textContent = msg || '';
    $('senha').value = '';
    $('senha').focus();
  }

  function guardar(v) {
    try { localStorage.setItem(CHAVE, v); } catch (err) { /* sem onde guardar */ }
  }
  function lido() {
    try { return localStorage.getItem(CHAVE); } catch (err) { return null; }
  }
  function esquecer() {
    try { localStorage.removeItem(CHAVE); } catch (err) { /* nada a fazer */ }
  }

  $('formSenha').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var v = $('senha').value;
    if (!v) return;
    $('btnEntrar').disabled = true;
    $('btnEntrar').textContent = 'Conferindo…';
    buscar(v).then(function () {
      senha = v;
      guardar(v);
      abrirQuadro();
    }).catch(function (e) {
      mostrarPortao(e.message);
    }).then(function () {
      $('btnEntrar').disabled = false;
      $('btnEntrar').textContent = 'Ver o quadro';
    });
  });

  /* ── leitura ──────────────────────────────────────────────────────────── */

  function buscar(comSenha) {
    if (!cfg.supabaseUrl) {
      return Promise.reject(new Error('Configuração do Supabase ausente no /config.js.'));
    }
    return fetch(cfg.supabaseUrl + '/functions/v1/demandas-tv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha: comSenha || '' })
    }).then(function (r) {
      return r.json().catch(function () {
        throw new Error('O servidor respondeu algo que não entendi.');
      }).then(function (d) {
        if (r.status === 401) { var e = new Error('Senha incorreta.'); e.senha = true; throw e; }
        if (!r.ok) throw new Error(d.erro || 'Não foi possível ler o quadro.');
        dados = d;
        lidoEm = Date.now();
        return d;
      });
    }, function () {
      throw new Error('Sem conexão com o servidor.');
    });
  }

  function recarregar() {
    buscar(senha).then(function () {
      falhando = false;
      render();
    }).catch(function (e) {
      /* Senha revogada no servidor: aí sim volta ao portão. Qualquer outra
         falha mantém o quadro no ar com a tarja de aviso. */
      if (e.senha) { esquecer(); senha = null; mostrarPortao('A senha mudou. Peça a nova à administração.'); return; }
      falhando = true;
      render();
    });
  }

  /* ── dados derivados ──────────────────────────────────────────────────── */

  function nomeStaff(id) {
    var p = (dados.equipe || []).filter(function (x) { return x.id === id; })[0];
    if (!p) return null;
    return p.apelido || C.initials(p.nome);
  }

  function nomeMembro(id) {
    var m = (dados.mentorados || []).filter(function (x) { return x.id === id; })[0];
    return m ? (m.nome || '').replace(/^(Dr|Dra)\.?\s+/i, '') : null;
  }

  function etapasDe(id) {
    return (dados.etapas || []).filter(function (e) { return e.demand_id === id; });
  }

  /* Prazo curto, do jeito que se lê de longe: "HOJE", "3D ATRASADA", "12 SET". */
  function prazo(d) {
    var n = C.diffDays(d.vence_em);
    if (n === null) return null;
    if (n < 0) return { txt: Math.abs(n) + 'D ATRASADA', cls: 'venceu' };
    if (n === 0) return { txt: 'VENCE HOJE', cls: 'perto' };
    if (n === 1) return { txt: 'AMANHÃ', cls: 'perto' };
    if (n <= 6) return { txt: 'EM ' + n + ' DIAS', cls: 'perto' };
    return { txt: C.fmtDate(d.vence_em), cls: '' };
  }

  function ordenar(rows) {
    var PESO = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };
    return rows.slice().sort(function (a, b) {
      var p = (PESO[a.prioridade] || 1) - (PESO[b.prioridade] || 1);
      if (p !== 0) return p;
      return String(a.vence_em || '9999').localeCompare(String(b.vence_em || '9999'));
    });
  }

  /* ── render ───────────────────────────────────────────────────────────── */

  function cartao(d) {
    var pz = prazo(d);
    var etapas = etapasDe(d.id);
    var feitas = etapas.filter(function (e) { return e.feito; }).length;

    var quem = (d.responsaveis || []).map(nomeStaff).filter(Boolean).join(' · ');
    var sobre = d.member_id ? nomeMembro(d.member_id) : null;

    var meta = [];
    if (quem)  meta.push('<span class="quem">' + esc(quem) + '</span>');
    if (sobre) meta.push('<span>' + esc(sobre) + '</span>');
    if (pz)    meta.push('<span class="prazo ' + pz.cls + '">' + esc(pz.txt) + '</span>');
    if (etapas.length) {
      meta.push('<span class="ck' + (feitas === etapas.length ? ' cheio' : '') + '">' +
        feitas + '/' + etapas.length + '</span>');
    }
    if (!meta.length) meta.push('<span class="ck">sem responsável</span>');

    return '<div class="tv-card' +
      (d.prioridade === 'Alta' ? ' alta' : '') +
      (pz && pz.cls === 'venceu' ? ' atrasada' : '') + '">' +
      '<div class="tv-card-t">' + esc(d.titulo) + '</div>' +
      '<div class="tv-card-sub">' + meta.join('') + '</div>' +
    '</div>';
  }

  function render() {
    if (!dados) return;

    var todas = dados.demandas || [];
    var abertas = todas.filter(function (d) {
      return C.DEM_ABERTOS.indexOf(d.status) !== -1;
    });

    /* ── números do topo ── */
    var atrasadas = abertas.filter(function (d) {
      var n = C.diffDays(d.vence_em);
      return n !== null && n < 0;
    }).length;
    var atencao = abertas.filter(function (d) {
      return d.status === 'Em risco' || d.status === 'Aguardando retorno';
    }).length;

    $('numeros').innerHTML =
      num('EM ABERTO', abertas.length, '') +
      num('ATRASADAS', atrasadas, atrasadas ? 'alerta' : '') +
      num('PEDINDO ATENÇÃO', atencao, atencao ? 'atencao' : '');

    /* ── colunas: só as situações que têm demanda ── */
    var porStatus = {};
    abertas.forEach(function (d) {
      (porStatus[d.status] = porStatus[d.status] || []).push(d);
    });

    /* "A fazer" e "Em andamento" ficam mesmo vazias: são a régua da leitura, e
       vê-las zeradas é uma informação, não um buraco. */
    var FIXAS = ['A fazer', 'Em andamento'];
    var cols = C.DEM_ABERTOS.filter(function (s) {
      return porStatus[s] || FIXAS.indexOf(s) !== -1;
    });

    if (!abertas.length) {
      $('colunas').style.removeProperty('--n');
      $('colunas').innerHTML = '<div class="tv-nada">Nenhuma demanda em aberto. ' +
        'Aproveite.</div>';
    } else {
      $('colunas').style.setProperty('--n', cols.length);
      $('colunas').innerHTML = cols.map(function (s) {
        var lista = ordenar(porStatus[s] || []);
        return '<div class="tv-col" data-status="' + esc(s) + '">' +
          '<div class="tv-col-top" style="color:' + C.DEM_COR[s] + '">' +
            '<span class="tv-ponto"></span>' +
            '<span class="tv-col-nome">' + esc(s.toUpperCase()) + '</span>' +
            '<span class="tv-col-n">' + lista.length + '</span>' +
          '</div>' +
          '<div class="tv-cards">' +
            (lista.length ? lista.map(cartao).join('')
                          : '<div class="tv-col-vazia">nada aqui</div>') +
          '</div>' +
          '<div class="tv-col-mais"></div>' +
        '</div>';
      }).join('');

      cortarAoQueCabe(porStatus);
    }

    marcarHora();
    tarja();
  }

  function num(rotulo, valor, cls) {
    return '<div class="tv-num ' + cls + '"><span class="v">' + valor +
      '</span><span class="k">' + rotulo + '</span></div>';
  }

  /* A TV não rola. Então o render põe todos os cartões e aqui se tira do fim
     até caber — medir é mais confiável que adivinhar quantos cabem, porque a
     altura do cartão muda com o título de uma ou duas linhas. O que sobrou não
     é perdido: entra na próxima página do giro. */
  function cortarAoQueCabe(porStatus) {
    Array.prototype.forEach.call(document.querySelectorAll('.tv-col'), function (col) {
      var s = col.dataset.status;
      var lista = ordenar(porStatus[s] || []);
      if (!lista.length) { couberam[s] = 0; return; }

      var caixa = col.querySelector('.tv-cards');
      var pe = col.querySelector('.tv-col-mais');

      /* A página atual começa onde a anterior parou. */
      var de = pagina[s] || 0;
      if (de >= lista.length) { de = pagina[s] = 0; }
      var visiveis = lista.slice(de);
      caixa.innerHTML = visiveis.map(cartao).join('');

      while (caixa.scrollHeight > caixa.clientHeight + 1 && caixa.children.length > 1) {
        caixa.removeChild(caixa.lastChild);
      }
      couberam[s] = caixa.children.length;

      pe.textContent = couberam[s] < lista.length
        ? (de + 1) + '–' + (de + couberam[s]) + ' de ' + lista.length
        : lista.length + (lista.length === 1 ? ' demanda' : ' demandas');
    });
  }

  function girar() {
    if (!dados) return;
    var mexeu = false;
    Object.keys(couberam).forEach(function (s) {
      var total = (dados.demandas || []).filter(function (d) { return d.status === s; }).length;
      if (couberam[s] && couberam[s] < total) {
        var prox = (pagina[s] || 0) + couberam[s];
        pagina[s] = prox >= total ? 0 : prox;
        mexeu = true;
      } else if (pagina[s]) {
        pagina[s] = 0;
        mexeu = true;
      }
    });
    if (mexeu) render();
  }

  function marcarHora() {
    var d = new Date(lidoEm || Date.now());
    var el = $('atualizado');
    el.textContent = 'ATUALIZADO ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    el.classList.toggle('velho', Date.now() - lidoEm > VELHO);
  }

  function relogio() {
    var d = new Date();
    $('relogio').textContent =
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    marcarHora();
  }

  function tarja() {
    var t = document.querySelector('.tv-tarja');
    if (falhando && !t) {
      t = document.createElement('div');
      t.className = 'tv-tarja';
      t.textContent = 'Sem conexão com o servidor — mostrando a última leitura';
      document.body.appendChild(t);
    } else if (!falhando && t) {
      t.remove();
    }
  }

  /* ── partida ──────────────────────────────────────────────────────────── */

  function abrirQuadro() {
    $('portao').hidden = true;
    $('quadro').hidden = false;
    render();
    relogio();
    setInterval(recarregar, RECARGA);
    setInterval(girar, GIRO);
    setInterval(relogio, RELOGIO);
    /* Redesenhar no resize porque quantos cartões cabem depende da altura. */
    window.addEventListener('resize', debounce(render, 250));
    /* A TV apagar a tela derrota o propósito de pendurar uma. Onde o navegador
       não tem a API, ou nega, não há o que fazer daqui. */
    if (navigator.wakeLock) {
      navigator.wakeLock.request('screen').catch(function () { /* sem trava */ });
    }
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  if (C.configError || !window.Club || !C.DEM_ABERTOS) {
    mostrarPortao('Os arquivos da tela não carregaram por inteiro. Recarregue a página.');
    return;
  }

  /* Tenta abrir o quadro sem perguntar nada — com a senha guardada nesta TV,
     se houver uma. O portão só aparece se o servidor disser que precisa. */
  senha = lido();
  buscar(senha).then(abrirQuadro).catch(function (e) {
    if (!e.senha) { mostrarPortao(e.message); return; }
    esquecer();
    var tinha = senha;
    senha = null;
    mostrarPortao(tinha ? 'A senha mudou. Peça a nova à administração.' : '');
  });
})();
