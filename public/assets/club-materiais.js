/* ============================================================================
   Club OftalmoBlack — área Materiais: Comece por aqui, Aulas, Materiais gerais
   e Da sua clínica

   O Cérebro não hospeda vídeo: cada aula é o player da Panda embutido pelo
   link, como na Greenn. A lista de aulas (com o id de cada vídeo) vem do
   "catálogo de aulas", um arquivo privado do acervo (categoria Sistema, turma
   inteira): só quem está logado lê, e nada disso fica no repositório, que é
   público. O catálogo sai de aulas-cerebro/scripts/catalogo_cerebro.py e já
   traz os títulos em Pirulen convertidos em contorno.

   Materiais gerais são os da turma inteira; os da clínica, os que têm o
   mentorado em visivel_para. O que o mentorado marca como assistido fica neste
   navegador por enquanto: a tabela lesson_progress ainda não existe
   (aulas-cerebro/spec-materiais-cerebro-V2.md).

   Desenho: protótipo V7 (aulas-cerebro/prototipo-materiais-cerebro-V7.html).
   ========================================================================= */
(function () {
  'use strict';

  var C = window.Club = window.Club || {};

  var PLAYER = 'https://player-vz-4d3a89c5-8b2.tv.pandavideo.com.br/embed/?v=';
  var CAT_SISTEMA = 'Sistema';
  var ARQ_CATALOGO = 'catalogo-aulas.json';
  var SECOES = ['comece', 'aulas', 'gerais', 'clinica'];
  var NOME_SECAO = { comece:'Comece por aqui', aulas:'Aulas', gerais:'Materiais gerais', clinica:'Da sua clínica' };
  var NOME_CURTO = { comece:'Comece', aulas:'Aulas', gerais:'Gerais', clinica:'Sua clínica' };

  var TRACO = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var ICO = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 10.8v5.6M12 7.6v.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true" ' + TRACO + '><path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7z"/><path d="M14 3v4h4"/></svg>',
    trava: '<svg viewBox="0 0 24 24" aria-hidden="true" ' + TRACO + '><rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    baixar: '<svg viewBox="0 0 24 24" aria-hidden="true" ' + TRACO + '><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/></svg>',
    busca: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    comece: '<svg viewBox="0 0 24 24" aria-hidden="true" ' + TRACO + '><circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.3 4.9-4.9 2.3 2.3-4.9z"/></svg>',
    aulas: '<svg viewBox="0 0 24 24" aria-hidden="true" ' + TRACO + '><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.2 9.3v5.4l4.6-2.7z" fill="currentColor"/></svg>',
    gerais: '<svg viewBox="0 0 24 24" aria-hidden="true" ' + TRACO + '><path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7z"/><path d="M14 3v4h4M9 12.5h6M9 16h6"/></svg>',
    clinica: '<svg viewBox="0 0 24 24" aria-hidden="true" ' + TRACO + '><path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.2l2 2H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M12 10.8v5.4M9.3 13.5h5.4"/></svg>'
  };
  var FOLHA = '<svg class="mx-doc-folha" viewBox="0 0 64 80" aria-hidden="true"><path class="mx-folha" d="M8 4h34l16 16v52a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"/><path class="mx-folha" d="M42 4v16h16"/><path class="mx-linhas" d="M15 38h34M15 47h34M15 56h22"/></svg>';

  var D = null;            // catálogo
  var ctx = null;          // { catalogo, membro, materiais, admin }
  var raiz = null, app = null, campo = null;
  var vistos = {}, abertos = {}, chaveVistos = '', chaveAbertos = '';
  var aulas = [], porChave = {}, cursoPorId = {}, datadas = [];
  var gerais = [], clinica = [], matPorId = {}, matsDaAula = {}, matsDoCurso = {};
  var est = { rota:null, filtroG:'todos', filtroC:'todos', busca:'', navegou:0 };
  var relogio = null, slideAtual = 0, pausado = false, ouvindo = false;

  /* ── utilidades ───────────────────────────────────────────────────────── */

  function ler(chave) {
    try { return JSON.parse(localStorage.getItem(chave) || '{}') || {}; } catch (e) { return {}; }
  }
  function gravar(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch];
    });
  }
  function semAcento(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function dur(seg) {
    if (!seg) return '';
    var min = Math.max(1, Math.round(seg / 60));
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + 'h' + String(m).padStart(2, '0') : m + ' min';
  }
  function chip(txt, cl) { return '<span class="mx-chip' + (cl ? ' ' + cl : '') + '">' + esc(txt) + '</span>'; }
  function bytes(n) { return C.fmtBytes ? C.fmtBytes(n) : ''; }
  function extensao(nome) { return C.fmtExt ? C.fmtExt(nome) : String(nome || '').split('.').pop().toUpperCase(); }
  function dataCurta(iso) { return C.fmtDataCurta ? C.fmtDataCurta(iso) : String(iso || ''); }
  function avisar(msg, icone) { if (C.toast) C.toast(msg, icone); }

  /* Título branco com a parte dourada, como nas artes: o que vem depois do
     último " - ", dos dois-pontos ou do último " e "; senão a última palavra. */
  function realce(texto) {
    var t = String(texto).trim(), a = '', b = '', i, m;
    if ((i = t.lastIndexOf(' - ')) > 0) { a = t.slice(0, i); b = t.slice(i + 3); }
    else if ((i = t.indexOf(': ')) > 0) { a = t.slice(0, i + 1); b = t.slice(i + 2); }
    else if ((m = t.match(/^(.*\S)\s+(e\s+\S.*)$/i))) { a = m[1]; b = m[2]; }
    else {
      var p = t.split(/\s+/), n = p.length > 1 ? 1 : 0;
      if (n && p[p.length - 1].length <= 3 && p.length > 2) n = 2;
      a = p.slice(0, p.length - n).join(' '); b = p.slice(p.length - n).join(' ');
    }
    if (!b) return '<span class="mx-ouro">' + esc(t) + '</span>';
    return esc(a) + ' <span class="mx-ouro">' + esc(b) + '</span>';
  }

  /* Os títulos da Greenn seguem "TIPO - TEMA - DD.MM.AAAA" (Encontros e
     Treinamentos) ou o padrão antigo dos Hot Seats e das Masterclasses. */
  var TIPOS = { 'ENCONTRO DE MESTRES':'Encontro de Mestres', 'TREINAMENTO DE EQUIPE':'Treinamento de Equipe',
                'ENCONTRO GRAU ZERO':'Encontro Grau Zero', 'REUNIÃO SECRETA':'Reunião Secreta' };
  function partes(t) {
    var m = t.match(/^(ENCONTRO DE MESTRES|TREINAMENTO DE EQUIPE|ENCONTRO GRAU ZERO|REUNIÃO SECRETA) - (.+) - (\d{2})\.(\d{2})\.(\d{4})$/);
    if (m) return { chapeu:TIPOS[m[1]], tema:m[2], dia:m[3], mes:m[4], ano:m[5] };
    m = t.match(/^HOT SEAT\s+(\d{2})[\/.](\d{2})[\/.](\d{2,4})\s*-\s*(.+)$/);
    if (m) return { chapeu:'Hot Seat', tema:m[4], dia:m[1], mes:m[2], ano:m[3].length === 2 ? '20' + m[3] : m[3] };
    m = t.match(/^HOT SEAT - (.+)$/);
    if (m) return { chapeu:'Hot Seat', tema:m[1] };
    m = t.match(/^Masterclass - (.+?) \| (\d{2})\.(\d{2})\.(\d{4})$/);
    if (m) return { chapeu:'Masterclass', tema:m[1], dia:m[2], mes:m[3], ano:m[4] };
    return { chapeu:'', tema:t };
  }
  function dataDe(p) { return p.dia ? p.dia + '/' + p.mes + '/' + p.ano : ''; }

  /* ── índices ──────────────────────────────────────────────────────────── */

  function indexar() {
    aulas = []; porChave = {}; cursoPorId = {};
    var hoje = new Date();
    D.cursos.concat([D.comece]).forEach(function (c) {
      cursoPorId[String(c.id)] = c;
      c.lista = [];
      c.modulos.forEach(function (m) {
        m.seg = 0;
        m.aulas.forEach(function (a, i) {
          a.curso = c; a.modulo = m; a.pos = i + 1; a.i = c.lista.length;
          a.p = partes(a.t);
          a.quando = a.p.ano ? new Date(+a.p.ano, +a.p.mes - 1, +a.p.dia) : null;
          a.novo = !!a.quando && (hoje - a.quando) / 864e5 <= 31 && a.quando <= hoje;
          m.seg += a.s || 0;
          c.lista.push(a); porChave[a.k] = a;
          if (c !== D.comece) aulas.push(a);
        });
      });
      c.seg = c.lista.reduce(function (x, a) { return x + (a.s || 0); }, 0);
    });
    datadas = aulas.filter(function (a) { return a.quando; })
      .sort(function (x, y) { return y.quando - x.quando; });

    var rows = (ctx.materiais || []).filter(function (r) { return r.categoria !== CAT_SISTEMA; });
    var ordem = categoriasGerais(rows), doCatalogo = Object.keys(D.materiaisCurso || {});
    function posicao(r) { var i = doCatalogo.indexOf(r.arquivo_nome); return i === -1 ? 999 : i; }
    gerais = rows.filter(function (r) { return !r.visivel_para || !r.visivel_para.length; })
      .sort(function (x, y) { return ordem.indexOf(x.categoria) - ordem.indexOf(y.categoria) || posicao(x) - posicao(y); });
    clinica = rows.filter(function (r) { return r.visivel_para && r.visivel_para.length; })
      .sort(function (x, y) { return String(y.publicado_em).localeCompare(String(x.publicado_em)); });
    matPorId = {}; matsDaAula = {}; matsDoCurso = {};
    var porCat = {};
    gerais.forEach(function (m) {
      matPorId[m.id] = m;
      m._iCat = porCat[m.categoria] = (porCat[m.categoria] === undefined ? -1 : porCat[m.categoria]) + 1;
      ((D.materiaisAulas || {})[m.arquivo_nome] || []).forEach(function (k) {
        (matsDaAula[k] = matsDaAula[k] || []).push(m);
      });
      var cid = (D.materiaisCurso || {})[m.arquivo_nome];
      if (cid !== undefined) (matsDoCurso[cid] = matsDoCurso[cid] || []).push(m);
    });
    clinica.forEach(function (m) { matPorId[m.id] = m; });
  }

  /* As categorias do catálogo primeiro, na ordem dele; depois as outras. */
  function categoriasGerais(rows) {
    var lista = (D.categorias || []).slice();
    (C.MAT_CATEGORIAS || []).concat(rows.map(function (r) { return r.categoria; })).forEach(function (c) {
      if (c && lista.indexOf(c) === -1) lista.push(c);
    });
    return lista;
  }
  function categoriasPresentes(rows, base) {
    return base.filter(function (c) { return rows.some(function (r) { return r.categoria === c; }); });
  }

  /* ── fotos ────────────────────────────────────────────────────────────── */

  function foco(k) { return (D.focos && D.focos[k]) || '50% 40%'; }
  /* Enquadra a foto numa capa pequena perto do foco dela (onde está a pessoa),
     com variação leve para as capas seguidas não ficarem iguais. */
  function enquadre(k, n) {
    var f = foco(k).split(' ').map(parseFloat);
    var px = Math.min(100, Math.max(0, f[0] + (n * 37) % 21 - 10));
    var py = Math.min(100, Math.max(0, f[1] + (n * 53) % 21 - 10));
    return '--img:var(--img-' + k + ');--px:' + px + '%;--py:' + py + '%;--zoom:' + (100 + (n * 29) % 31) + '%';
  }
  function recorte(a) {
    var fotos = a.curso.fotos, n = a.i + (Number(a.curso.id) || 0) % 7;
    return enquadre(fotos[n % fotos.length], n);
  }
  function recorteMat(m) {
    var fotos = (D.fotoCat && D.fotoCat[m.categoria]) || D.cursos[0].fotos;
    return enquadre(fotos[m._iCat % fotos.length], m._iCat * 5 + 3);
  }

  /* ── peças ────────────────────────────────────────────────────────────── */

  function chapeu(a) {
    var d = dataDe(a.p);
    if (a.p.chapeu && d) return a.p.chapeu + ' · ' + d;
    return a.p.chapeu || d || a.modulo.nome;
  }
  function miniatura(a) {
    var visto = !!vistos[a.k], fechada = !a.v;
    return '<span class="mx-miniatura' + (fechada ? ' mx-fechada' : '') + '" style="' + recorte(a) + '">' +
      (a.novo ? '<span class="mx-chip-novo">Novo</span>' : '') +
      (fechada ? '<span class="mx-chip-trava">Em gravação</span>'
        : visto ? '<span class="mx-chip-visto">✓ Assistida</span>'
        : a.s ? '<span class="mx-dur">' + dur(a.s) + '</span>' : '') +
      '<span class="mx-tag">' + esc(chapeu(a)) + '</span>' +
      (fechada ? '' : '<span class="mx-tocar" aria-hidden="true">' + ICO.play + '</span>') +
      (visto ? '<span class="mx-feita" aria-hidden="true"></span>' : '') +
    '</span>';
  }
  function cartao(a, trocar) {
    return '<button type="button" class="mx-cartao" data-mx="aula" data-k="' + esc(a.k) + '"' + (trocar ? ' data-trocar="1"' : '') + '>' +
      miniatura(a) +
      '<span class="mx-tit">' + esc(a.p.tema) + '</span>' +
      '<span class="mx-meta">' + esc(a.curso.curto) + ' · ' + dur(a.s) + '</span>' +
    '</button>';
  }
  function feitas(c) { return c.lista.filter(function (a) { return vistos[a.k]; }).length; }
  function barra(pct) { return '<span class="mx-barra" aria-hidden="true"><i style="width:' + pct + '%"></i></span>'; }
  function poster(c) {
    var nums = plural(c.lista.length, 'aula', 'aulas') + ' · ' + dur(c.seg);
    return '<button type="button" class="mx-poster" data-mx="curso" data-id="' + esc(c.id) + '" aria-label="' + esc(c.curto + ': ' + nums) + '">' +
      '<span class="mx-capa" style="--capa:var(--img-capa-' + esc(c.id) + ')" aria-hidden="true"></span>' +
      '<span class="mx-nums" aria-hidden="true">' + esc(nums) + '</span>' +
      barra(Math.round(feitas(c) / c.lista.length * 100)) +
    '</button>';
  }
  function setas(itens) {
    return '<div class="mx-carrossel">' +
      '<button type="button" class="mx-seta mx-esq" data-mx="rolar" data-dir="-1" aria-label="Voltar">‹</button>' +
      '<div class="mx-trilho">' + itens.join('') + '</div>' +
      '<button type="button" class="mx-seta mx-dir" data-mx="rolar" data-dir="1" aria-label="Avançar">›</button>' +
    '</div>';
  }
  function secao(titulo, sub, corpo, extra, id) {
    return '<section class="mx-secao"' + (id ? ' id="' + id + '"' : '') + '>' +
      '<div class="mx-secao-topo"><h2>' + esc(titulo) + (sub ? '<span class="mx-sub">' + esc(sub) + '</span>' : '') + '</h2>' + (extra || '') + '</div>' +
      corpo +
    '</section>';
  }
  function prateleira(titulo, sub, itens, extra) {
    return itens.length ? secao(titulo, sub, setas(itens), extra) : '';
  }
  /* Linha de um curso na aba Aulas: caixa própria com a capa, o nome e as aulas. */
  function linhaCurso(c) {
    var f = feitas(c);
    var itens = c.lista.slice(0, 20).map(function (a) { return cartao(a); });
    if (c.lista.length > 20) itens.push('<button type="button" class="mx-cartao mx-fim" data-mx="curso" data-id="' + esc(c.id) + '">' +
      '<span class="mx-miniatura" style="--img:var(--img-' + c.foto + ');--px:50%;--py:40%;--zoom:120%"><span class="mx-ver">Ver as <span class="mx-ouro">' + c.lista.length + ' aulas</span></span></span></button>');
    return '<section class="mx-linha-curso" style="--img:var(--img-' + c.foto + ');--pos:' + foco(c.foto) + '">' +
      '<div class="mx-caixa-curso">' +
        '<div class="mx-caixa-topo">' +
          '<button type="button" class="mx-capinha-curso" data-mx="curso" data-id="' + esc(c.id) + '" style="--capa:var(--img-capa-' + esc(c.id) + ')" aria-label="' + esc('Ver o curso ' + c.curto) + '"></button>' +
          '<div class="mx-caixa-titulo">' +
            '<span class="mx-rotulo">' + esc(c.chapeu) + '</span>' +
            '<h2>' + esc(c.curto) + '</h2>' +
            '<span class="mx-meta">' + plural(c.lista.length, 'aula', 'aulas') + ' · ' + dur(c.seg) +
              (f ? ' · ' + f + ' assistidas ' + barra(Math.round(f / c.lista.length * 100)) : '') + '</span>' +
          '</div>' +
          '<button type="button" class="mx-link" data-mx="curso" data-id="' + esc(c.id) + '">Ver o curso ›</button>' +
        '</div>' +
        setas(itens) +
      '</div>' +
    '</section>';
  }
  function top10() {
    return datadas.slice(0, 10).map(function (a, i) {
      return '<button type="button" class="mx-top" data-mx="aula" data-k="' + esc(a.k) + '" aria-label="' + esc((i + 1) + 'º: ' + a.t) + '">' +
        '<span class="mx-numero" aria-hidden="true">' + D.numeros[i] + '</span>' +
        '<span class="mx-capinha" style="' + recorte(a) + '"><span class="mx-tag">' + esc(chapeu(a)) + '</span><span class="mx-tit">' + esc(a.p.tema) + '</span></span>' +
      '</button>';
    });
  }
  /* Para cada curso com alguma aula marcada: a próxima não assistida depois da última marcada. */
  function continuar() {
    var res = [];
    D.cursos.forEach(function (c) {
      var ultima = -1, quando = 0;
      c.lista.forEach(function (a, i) { if (vistos[a.k] > quando) { quando = vistos[a.k]; ultima = i; } });
      if (ultima < 0) return;
      var prox = c.lista.slice(ultima + 1).filter(function (a) { return !vistos[a.k]; })[0] ||
                 c.lista.filter(function (a) { return !vistos[a.k]; })[0];
      if (prox) res.push({ a:prox, quando:quando });
    });
    return res.sort(function (x, y) { return y.quando - x.quando; }).map(function (x) { return x.a; });
  }

  /* Faixa larga: a foto cobre tudo; se a pessoa está no meio, no computador a
     foto vira um painel à direita para o texto não cobrir ninguém. */
  function fundoFaixa(k, ativo) {
    var painel = (D.paineis || []).indexOf(k) !== -1;
    return '<div class="mx-slide' + (ativo ? ' mx-ativo' : '') + (painel ? ' mx-painel' : '') + '" style="--img:var(--img-' + k + ');--pos:' + foco(k) +
      ';--asp:' + ((D.aspectos || {})[k] || 1.5) + '" aria-hidden="true">' + (painel ? '<span class="mx-foto-painel"></span>' : '') + '</div>';
  }
  function faixa(o) {
    return '<section class="mx-palco mx-faixa">' + fundoFaixa(o.img, true) +
      '<div class="mx-wrap"><div class="mx-conteudo">' +
        '<span class="mx-rotulo">' + esc(o.rotulo) + '</span>' +
        '<h1 class="mx-titulo-palco">' + o.svg + '</h1>' +
        '<div class="mx-chips">' + o.chips.map(function (c) { return chip(c); }).join('') + '</div>' +
        '<p class="mx-sinopse">' + esc(o.texto) + '</p>' +
        (o.acoes ? '<div class="mx-acoes">' + o.acoes + '</div>' : '') +
      '</div></div>' +
    '</section>';
  }

  /* ── Aulas ────────────────────────────────────────────────────────────── */

  function vPalco() {
    var sl = D.destaques;
    var textos = sl.map(function (s, i) {
      return '<div class="mx-slide-texto"' + (i ? ' hidden' : '') + '>' +
        '<span class="mx-rotulo">' + esc(s.rotulo) + '</span>' +
        '<h1 class="mx-titulo-palco">' + s.svg + '</h1>' +
        '<div class="mx-chips">' + s.chips.map(function (c) { return chip(c[0], c[1] ? 'mx-' + c[1] : ''); }).join('') + '</div>' +
        '<p class="mx-sinopse">' + esc(s.texto) + '</p>' +
        '<div class="mx-acoes">' +
          '<button type="button" class="mx-botao mx-ouro-cheio" data-mx="aula" data-k="' + esc(s.k) + '">' + ICO.play + esc(s.botao || 'Assistir') + '</button>' +
          '<button type="button" class="mx-botao mx-vidro" data-mx="curso" data-id="' + esc(s.curso) + '">' + ICO.info + 'Mais informações</button>' +
        '</div>' +
      '</div>';
    }).join('');
    var pontos = sl.map(function (s, i) {
      return '<button type="button" data-mx="slide" data-i="' + i + '" aria-label="Destaque ' + (i + 1) + ' de ' + sl.length + '" aria-current="' + (i === 0) + '"></button>';
    }).join('');
    return '<section class="mx-palco" aria-roledescription="carrossel" aria-label="Destaques">' +
      sl.map(function (s, i) { return fundoFaixa(s.img, i === 0); }).join('') +
      '<div class="mx-wrap"><div class="mx-conteudo">' + textos + '</div></div>' +
      '<div class="mx-pontos">' + pontos + '</div>' +
    '</section>';
  }
  function vAulas() {
    var total = aulas.reduce(function (x, a) { return x + (a.s || 0); }, 0);
    return vPalco() + '<div class="mx-wrap mx-corpo">' +
      prateleira('Continuar assistindo', '', continuar().map(function (a) { return cartao(a); })) +
      prateleira('Top 10 mais recentes', 'encontros, treinamentos e hot seats', top10()) +
      prateleira('Cursos', plural(D.cursos.length, 'curso', 'cursos') + ' · ' + dur(total) + ' de aula', D.cursos.map(poster)) +
      D.cursos.map(linhaCurso).join('') +
    '</div>';
  }

  /* ── Comece por aqui ──────────────────────────────────────────────────── */

  /* Os passos já aparecem com o título; enquanto o vídeo não existe, ficam
     fechados ("Em gravação"). Abrem quando o catálogo ganha o id da Panda. */
  function passo(a, i) {
    var aberto = !!a.v, feito = aberto && !!vistos[a.k], n = D.comece.lista.length;
    var cabeca = '<span class="mx-topo-passo"><span aria-hidden="true">' + D.numeros[i] + '</span>' +
      '<span class="mx-estado-passo" aria-hidden="true">' + (feito ? '✓' : aberto ? ICO.play : ICO.trava) + '</span></span>';
    var corpo = cabeca + miniatura(a) +
      '<span class="mx-tit">' + esc(a.t) + '</span>' +
      '<span class="mx-meta">' + esc(aberto ? (a.texto || '') + (a.s ? ' · ' + dur(a.s) : '') : 'Em gravação · ' + (a.texto || '')) + '</span>';
    var rotulo = 'Passo ' + (i + 1) + ' de ' + n + ': ' + a.t + (feito ? ', feito' : aberto ? '' : ', em gravação');
    if (!aberto) return '<li><div class="mx-passo mx-trancado" role="group" aria-label="' + esc(rotulo) + '">' + corpo + '</div></li>';
    return '<li><button type="button" class="mx-passo' + (feito ? ' mx-feito' : '') + '" data-mx="aula" data-k="' + esc(a.k) + '" aria-label="' + esc(rotulo) + '">' + corpo + '</button></li>';
  }
  function areas() {
    function card(aba, titulo, texto, conta) {
      return '<button type="button" class="mx-area" data-mx-secao="' + aba + '">' +
        '<span class="mx-area-ico" aria-hidden="true">' + ICO[aba] + '</span>' +
        '<span class="mx-tit">' + esc(titulo) + '</span>' +
        '<span class="mx-texto">' + esc(texto) + '</span>' +
        '<span class="mx-conta">' + esc(conta) + ' ›</span>' +
      '</button>';
    }
    return '<div class="mx-areas">' +
      card('aulas', 'Aulas', 'Encontros de Mestres, treinamentos de equipe, hot seats e cursos completos, com o que você já assistiu marcado.',
        plural(aulas.length, 'aula', 'aulas') + ' em ' + plural(D.cursos.length, 'curso', 'cursos')) +
      card('gerais', 'Materiais gerais', 'Os PDFs do método, das lentes e cirurgia e dos termos de consentimento, para todo o Black.',
        plural(gerais.length, 'material', 'materiais')) +
      card('clinica', 'Da sua clínica', 'Roteiros, relatórios, tutoriais e análises feitos para a operação da sua clínica.',
        plural(clinica.length, 'arquivo', 'arquivos')) +
    '</div>';
  }
  function vComece() {
    var lista = D.comece.lista;
    var prontos = lista.filter(function (a) { return a.v; });
    var nf = prontos.filter(function (a) { return vistos[a.k]; }).length;
    var prox = prontos.filter(function (a) { return !vistos[a.k]; })[0];
    var acoes = prox
      ? '<button type="button" class="mx-botao mx-ouro-cheio" data-mx="aula" data-k="' + esc(prox.k) + '">' + ICO.play + (nf ? 'Continuar' : 'Começar') + '</button>' +
        '<button type="button" class="mx-botao mx-vidro" data-mx-secao="aulas">Ir para as aulas</button>'
      : '<button type="button" class="mx-botao mx-ouro-cheio" data-mx-secao="aulas">' + ICO.play + 'Ver as aulas</button>' +
        '<button type="button" class="mx-botao mx-vidro" data-mx-secao="gerais">Materiais gerais</button>';
    var texto = prontos.length
      ? 'Os vídeos do Dr. Alex para quem chega ao Black: por onde começar, onde acessar as aulas e o que fazer agora.'
      : 'Os vídeos do Dr. Alex para quem chega ao Black estão em gravação: por onde começar, onde acessar as aulas e o que fazer agora. Cada passo abre aqui assim que o vídeo ficar pronto.';
    return faixa({ img:D.comece.foto, rotulo:D.comece.chapeu, svg:D.faixas.comece,
        chips:[plural(lista.length, 'passo', 'passos'), prontos.length === lista.length ? 'Pronto para começar' : prontos.length ? prontos.length + ' de ' + lista.length + ' prontos' : 'Em gravação'],
        texto:texto, acoes:acoes }) +
      '<div class="mx-wrap mx-corpo">' +
        secao('Seus primeiros passos', prontos.length ? nf + ' de ' + prontos.length + ' feitos' : 'em gravação',
          '<ol class="mx-trilha">' + lista.map(passo).join('') + '</ol>',
          prontos.length ? '<span class="mx-progresso" aria-hidden="true">' + barra(Math.round(nf / lista.length * 100)) + '</span>' : '') +
        secao('O que tem em Materiais', '', areas()) +
      '</div>';
  }

  /* ── Materiais gerais ─────────────────────────────────────────────────── */

  function docCartao(m) {
    var k = ((D.materiaisAulas || {})[m.arquivo_nome] || []).filter(function (x) { return porChave[x] && porChave[x].v; })[0];
    var tam = bytes(m.arquivo_bytes);
    return '<article class="mx-doc">' +
      '<button type="button" class="mx-doc-capa" data-mx="abrir" data-id="' + esc(m.id) + '" style="' + recorteMat(m) + '" tabindex="-1" aria-hidden="true">' +
        '<span class="mx-doc-tipo">' + esc(extensao(m.arquivo_nome)) + (tam ? ' · ' + esc(tam) : '') + '</span>' +
        (abertos[m.id] ? '<span class="mx-doc-aberto">✓ Aberto</span>' : '') + FOLHA +
      '</button>' +
      '<div class="mx-doc-corpo">' +
        '<span class="mx-tag">' + esc(m.categoria) + '</span>' +
        '<h3 class="mx-doc-titulo">' + esc(m.titulo) + '</h3>' +
        (m.descricao ? '<p class="mx-meta">' + esc(m.descricao) + '</p>' : '') +
        '<p class="mx-meta mx-doc-arquivo">' + esc(extensao(m.arquivo_nome)) + (tam ? ' · ' + esc(tam) : '') + (abertos[m.id] ? ' · <b class="mx-ok">✓ Aberto</b>' : '') + '</p>' +
        '<div class="mx-doc-acoes">' +
          '<button type="button" class="mx-botao mx-ouro-cheio mx-pequeno" data-mx="abrir" data-id="' + esc(m.id) + '">' + (/\.pdf$/i.test(m.arquivo_nome || '') ? 'Abrir PDF' : 'Baixar') + '</button>' +
          (k ? '<button type="button" class="mx-botao mx-vidro mx-pequeno" data-mx="aula" data-k="' + esc(k) + '">' + ICO.play + 'Ver a aula</button>' : '') +
        '</div>' +
      '</div>' +
    '</article>';
  }
  function linhaMat(m) {
    return '<button type="button" class="mx-mat-linha" data-mx="abrir" data-id="' + esc(m.id) + '">' +
      '<span class="mx-arq-ico" aria-hidden="true">' + esc(extensao(m.arquivo_nome)) + '</span>' +
      '<span class="mx-arq-info"><span class="mx-tit">' + esc(m.titulo) + '</span><span class="mx-meta">' + esc(m.categoria) +
        (m.arquivo_bytes ? ' · ' + esc(bytes(m.arquivo_bytes)) : '') + (abertos[m.id] ? ' · <b class="mx-ok">✓ Aberto</b>' : '') + '</span></span>' +
      '<span class="mx-link" aria-hidden="true">Abrir ›</span>' +
    '</button>';
  }
  function filtros(grupo, cats, rows, atual) {
    function b(v, rot, n) {
      return '<button type="button" data-mx="filtro" data-grupo="' + grupo + '" data-v="' + esc(v) + '" aria-pressed="' + (v === atual) + '">' + esc(rot) + ' <small>' + n + '</small></button>';
    }
    return '<div class="mx-filtros" role="group" aria-label="Categorias">' + b('todos', 'Todos', rows.length) +
      cats.map(function (c) { return b(c, c, rows.filter(function (r) { return r.categoria === c; }).length); }).join('') + '</div>';
  }
  function listaGerais() {
    var todas = categoriasPresentes(gerais, categoriasGerais(gerais));
    var cats = est.filtroG === 'todos' ? todas : [est.filtroG];
    return cats.map(function (cat) {
      var itens = gerais.filter(function (m) { return m.categoria === cat; });
      return itens.length ? secao(cat, plural(itens.length, 'material', 'materiais'), '<div class="mx-docs">' + itens.map(docCartao).join('') + '</div>') : '';
    }).join('');
  }
  function vGerais() {
    var cats = categoriasPresentes(gerais, categoriasGerais(gerais));
    return faixa({ img:D.imagens.gerais, rotulo:'Para todo o Black', svg:D.faixas.gerais,
        chips:[plural(gerais.length, 'material', 'materiais'), plural(cats.length, 'categoria', 'categorias'), 'PDF'],
        texto:'Os PDFs do método, das lentes e cirurgia e dos termos de consentimento, separados por categoria. Cada um leva à aula relacionada, quando tem.' }) +
      '<div class="mx-wrap mx-corpo">' +
        (gerais.length
          ? filtros('gerais', cats, gerais, est.filtroG) + '<div data-mx-lista="gerais">' + listaGerais() + '</div>'
          : '<p class="mx-vazio">Os materiais gerais aparecem aqui conforme o time do Black publica.</p>') +
      '</div>';
  }

  /* ── Da sua clínica ───────────────────────────────────────────────────── */

  function linhaClinica(m) {
    return '<button type="button" class="mx-arquivo" data-mx="abrir" data-id="' + esc(m.id) + '">' +
      '<span class="mx-arq-ico" aria-hidden="true">' + esc(extensao(m.arquivo_nome)) + '</span>' +
      '<span class="mx-arq-info"><span class="mx-tit">' + esc(m.titulo) + '</span>' + (m.descricao ? '<span class="mx-meta">' + esc(m.descricao) + '</span>' : '') + '</span>' +
      '<span class="mx-arq-detalhes">' + chip(m.categoria) +
        '<span class="mx-arq-data">' + esc(dataCurta(m.publicado_em)) + '</span>' +
        '<span class="mx-arq-tam">' + esc(bytes(m.arquivo_bytes)) + '</span>' +
        '<span class="mx-arq-acao">' + ICO.baixar + (abertos[m.id] ? 'Aberto' : 'Abrir') + '</span>' +
      '</span>' +
    '</button>';
  }
  function listaClinica() {
    var itens = clinica.filter(function (m) { return est.filtroC === 'todos' || m.categoria === est.filtroC; });
    return '<div class="mx-arquivos">' + itens.map(linhaClinica).join('') + '</div>';
  }
  function vClinica() {
    var cats = categoriasPresentes(clinica, (C.MAT_CATEGORIAS || []).concat(clinica.map(function (m) { return m.categoria; }))
      .filter(function (c, i, l) { return l.indexOf(c) === i; }));
    return faixa({ img:D.imagens.clinica, rotulo:'Materiais específicos', svg:D.faixas.clinica,
        chips:[plural(clinica.length, 'arquivo', 'arquivos'), 'Só a sua clínica vê'],
        texto:'Roteiros, relatórios, tutoriais e análises que o time do Black desenvolve para a operação da sua clínica. Não são materiais para todo o Black: cada clínica vê só os seus.' }) +
      '<div class="mx-wrap mx-corpo">' +
        (clinica.length
          ? filtros('clinica', cats, clinica, est.filtroC) +
            secao('Mais recentes primeiro', '', '<div data-mx-lista="clinica">' + listaClinica() + '</div>')
          : '<p class="mx-vazio">Seu acervo ainda está vazio. Os materiais da sua clínica aparecem aqui conforme o time do Black entrega.</p>') +
      '</div>';
  }

  /* ── curso e aula ─────────────────────────────────────────────────────── */

  function episodio(a) {
    var visto = !!vistos[a.k];
    return '<button type="button" class="mx-ep" data-mx="aula" data-k="' + esc(a.k) + '">' +
      '<span class="mx-n">' + a.pos + '</span>' + miniatura(a) +
      '<span class="mx-info"><span class="mx-tit">' + esc(a.p.tema) + '</span><span class="mx-meta">' + esc(chapeu(a)) + ' · ' + dur(a.s) + '</span></span>' +
      '<span class="mx-estado' + (visto ? ' mx-ok' : '') + '">' + (visto ? '✓' : ICO.play) + '</span>' +
    '</button>';
  }
  function vCurso(c) {
    var f = feitas(c);
    var prox = c.lista.filter(function (a) { return !vistos[a.k]; })[0] || c.lista[0];
    var mats = matsDoCurso[String(c.id)] || matsDoCurso[c.id] || [];
    var h = '<section class="mx-palco mx-pcurso">' + fundoFaixa(c.banner, true) +
      '<div class="mx-wrap"><div class="mx-conteudo">' +
        '<button type="button" class="mx-link" data-mx="voltar">‹ Voltar</button>' +
        '<span class="mx-rotulo">' + esc(c.chapeu) + '</span>' +
        '<h1 class="mx-titulo-palco">' + c.svgTitulo + '</h1>' +
        '<div class="mx-chips">' + chip(plural(c.lista.length, 'aula', 'aulas')) + chip(dur(c.seg)) + chip(plural(c.modulos.length, 'módulo', 'módulos')) +
          (mats.length ? chip(plural(mats.length, 'material', 'materiais')) : '') + (f ? chip(f + ' de ' + c.lista.length + ' assistidas') : '') + '</div>' +
        (f ? '<span style="display:block;width:min(420px,100%)">' + barra(Math.round(f / c.lista.length * 100)) + '</span>' : '') +
        '<div class="mx-acoes">' +
          '<button type="button" class="mx-botao mx-ouro-cheio" data-mx="aula" data-k="' + esc(prox.k) + '">' + ICO.play + (f ? 'Continuar' : 'Começar') + '</button>' +
          (mats.length ? '<button type="button" class="mx-botao mx-vidro" data-mx="modulo" data-i="mat">' + ICO.doc + 'Materiais do curso</button>' : '') +
        '</div>' +
        '<p class="mx-nota">' + (f ? 'Próxima' : 'Primeira') + ': ' + esc(prox.p.tema) + '</p>' +
      '</div></div>' +
    '</section><div class="mx-wrap mx-corpo">';
    var marcadores = c.modulos.map(function (m, i) { return '<button type="button" data-mx="modulo" data-i="' + i + '">' + esc(m.nome) + '</button>'; });
    if (mats.length) marcadores.push('<button type="button" data-mx="modulo" data-i="mat">Materiais</button>');
    if (marcadores.length > 1) h += '<nav class="mx-indice" aria-label="Módulos">' + marcadores.join('') + '</nav>';
    c.modulos.forEach(function (m, i) {
      h += '<section class="mx-secao mx-modulo" id="mx-mod-' + i + '"><div class="mx-secao-topo"><h2>' + esc(m.nome) +
        '<span class="mx-sub">' + plural(m.aulas.length, 'aula', 'aulas') + ' · ' + dur(m.seg) + '</span></h2></div>' +
        '<div class="mx-episodios">' + m.aulas.map(episodio).join('') + '</div></section>';
    });
    if (mats.length) h += '<section class="mx-secao mx-modulo" id="mx-mod-mat"><div class="mx-secao-topo"><h2>Materiais do curso<span class="mx-sub">' +
      plural(mats.length, 'arquivo', 'arquivos') + '</span></h2><button type="button" class="mx-link" data-mx-secao="gerais">Todos os materiais gerais ›</button></div>' +
      '<div class="mx-docs">' + mats.map(docCartao).join('') + '</div></section>';
    return h + '</div>';
  }
  function linhaLista(b, atual) {
    return '<button type="button" class="mx-mini-ep" data-mx="aula" data-trocar="1" data-k="' + esc(b.k) + '"' + (b === atual ? ' aria-current="true"' : '') + '>' +
      miniatura(b) +
      '<span class="mx-info"><span class="mx-tit">' + esc(b.p.tema) + '</span><span class="mx-meta">' +
        (vistos[b.k] ? '<b class="mx-ok">✓ Assistida</b>' : b.v ? dur(b.s) : 'Em gravação') + '</span></span>' +
    '</button>';
  }
  function botaoMarcar(a) {
    var v = !!vistos[a.k];
    return '<button type="button" class="mx-botao ' + (v ? 'mx-feito' : 'mx-ouro-cheio') + '" data-mx="marcar" data-k="' + esc(a.k) + '" aria-pressed="' + v + '">' +
      (v ? '✓ Assistida' : 'Marcar como assistida') + '</button>';
  }
  function vAula(a) {
    var c = a.curso, i = c.lista.indexOf(a);
    var prox = c.lista.slice(i + 1).filter(function (b) { return b.v; })[0];
    var d = dataDe(a.p), mats = matsDaAula[a.k] || [];
    var seguintes = c.lista.slice(i + 1, i + 9);
    return '<div class="mx-wrap mx-sala">' +
      '<div class="mx-principal">' +
        '<button type="button" class="mx-link" data-mx="voltar">‹ Voltar</button>' +
        '<div class="mx-player"><iframe src="' + PLAYER + encodeURIComponent(a.v) + '" title="' + esc(a.t) + '" ' +
          'allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>' +
        '<span class="mx-rotulo">' + esc(c.curto) + ' · ' + esc(a.modulo.nome) + '</span>' +
        '<h1 class="mx-titulo-aula">' + realce(a.p.tema) + '</h1>' +
        '<div class="mx-chips">' + (a.novo ? chip('Novo', 'mx-novo') : '') + (a.p.chapeu ? chip(a.p.chapeu) : '') + (d ? chip(d) : '') + (a.s ? chip(dur(a.s)) : '') + '</div>' +
        '<div class="mx-acoes">' + botaoMarcar(a) +
          (prox ? '<button type="button" class="mx-botao mx-vidro" data-mx="aula" data-trocar="1" data-k="' + esc(prox.k) + '">Próxima aula ›</button>' : '') +
        '</div>' +
        (mats.length ? '<section class="mx-materiais-aula" aria-label="Materiais de apoio"><h2>Materiais de apoio</h2>' + mats.map(linhaMat).join('') + '</section>' : '') +
      '</div>' +
      '<aside class="mx-lateral">' +
        '<h2>' + (seguintes.length ? 'A seguir' : 'Deste curso') + '</h2>' +
        '<div class="mx-lista">' + (seguintes.length ? seguintes : c.lista.slice(0, 8)).map(function (b) { return linhaLista(b, a); }).join('') + '</div>' +
        (c === D.comece ? '' : '<button type="button" class="mx-link" data-mx="curso" data-id="' + esc(c.id) + '">Ver todas as aulas do curso ›</button>') +
      '</aside>' +
    '</div>';
  }

  /* ── busca ────────────────────────────────────────────────────────────── */

  function vBusca(texto) {
    var termo = semAcento(texto.trim());
    function tem(s) { return semAcento(s).indexOf(termo) !== -1; }
    var achadas = aulas.filter(function (a) { return tem(a.t + ' ' + a.modulo.nome + ' ' + a.curso.curto); });
    var mats = gerais.filter(function (m) { return tem(m.titulo + ' ' + m.categoria + ' ' + (m.descricao || '')); });
    var arqs = clinica.filter(function (m) { return tem(m.titulo + ' ' + m.categoria + ' ' + (m.descricao || '')); });
    var partesAchadas = [mats.length && plural(mats.length, 'material geral', 'materiais gerais'),
      arqs.length && plural(arqs.length, 'arquivo da clínica', 'arquivos da clínica'),
      achadas.length && plural(achadas.length, 'aula', 'aulas')].filter(Boolean);
    var h = '<div class="mx-wrap mx-resultado"><div class="mx-cabeca">' +
      '<button type="button" class="mx-link" data-mx="limpar">‹ Voltar</button>' +
      '<span class="mx-rotulo">Busca</span>' +
      '<h1><span class="mx-ouro">' + esc(texto.trim()) + '</span></h1>' +
      '<p class="mx-nota">' + (partesAchadas.length ? esc(partesAchadas.join(' · ')) : 'Nada encontrado') + '</p>' +
    '</div>';
    if (mats.length) h += secao('Materiais gerais', '', '<div class="mx-docs">' + mats.map(docCartao).join('') + '</div>');
    if (arqs.length) h += secao('Da sua clínica', '', '<div class="mx-arquivos">' + arqs.map(linhaClinica).join('') + '</div>');
    if (achadas.length) h += secao('Aulas', achadas.length > 120 ? 'mostrando as 120 primeiras' : '',
      '<div class="mx-grade">' + achadas.slice(0, 120).map(function (a) { return cartao(a); }).join('') + '</div>');
    if (!partesAchadas.length) h += '<p class="mx-vazio">Nada com esse nome. Tente uma palavra do tema, como “biometria”, “tráfego” ou “consentimento”.</p>';
    return h + '</div>';
  }

  /* ── navegação ────────────────────────────────────────────────────────── */

  function lembrada() {
    try { var s = localStorage.getItem('cerebro-materiais-secao'); return SECOES.indexOf(s) !== -1 ? s : 'comece'; }
    catch (e) { return 'comece'; }
  }
  function lembrar(s) { try { localStorage.setItem('cerebro-materiais-secao', s); } catch (e) { /* sem armazenamento */ } }

  /* #materials, #materials/<seção>, #materials/curso/<id> ou #materials/aula/<chave> */
  function rotaDoHash() {
    var p = location.hash.replace(/^#/, '').split('/');
    if (p[0] !== 'materials') return null;
    if (p[1] === 'curso' && cursoPorId[p[2]] && p[2] !== 'comece') return { tipo:'curso', id:p[2] };
    if (p[1] === 'aula') {
      var k = decodeURIComponent(p[2] || '');
      if (porChave[k] && porChave[k].v) return { tipo:'aula', k:k };
    }
    if (SECOES.indexOf(p[1]) !== -1) return { tipo:p[1] };
    return { tipo:lembrada() };
  }
  function abaDe(r) {
    if (SECOES.indexOf(r.tipo) !== -1) return r.tipo;
    if (r.tipo === 'curso' && r.id === 'comece') return 'comece';
    if (r.tipo === 'aula' && porChave[r.k] && porChave[r.k].curso === D.comece) return 'comece';
    return 'aulas';
  }
  function ir(caminho) {
    var novo = '#materials/' + caminho;
    if (location.hash === novo) { desenhar(); return; }
    est.navegou++;
    location.hash = novo;
  }
  /* Trocar de aula na mesma página não empilha no "voltar". */
  function trocarPara(caminho) {
    history.replaceState(null, '', location.pathname + location.search + '#materials/' + caminho);
    route();
  }
  function voltar() {
    if (est.navegou > 0) { est.navegou--; history.back(); }
    else location.hash = '#materials/' + abaDe(est.rota || { tipo:'aulas' });
  }

  function desenhar() {
    clearInterval(relogio);
    var r = est.rota, buscando = est.busca.trim().length >= 2, h;
    if (buscando) h = vBusca(est.busca);
    else if (r.tipo === 'curso') h = vCurso(cursoPorId[r.id]);
    else if (r.tipo === 'aula') h = vAula(porChave[r.k]);
    else if (r.tipo === 'aulas') h = vAulas();
    else if (r.tipo === 'gerais') h = vGerais();
    else if (r.tipo === 'clinica') h = vClinica();
    else h = vComece();
    app.innerHTML = h;
    var aba = buscando ? '' : abaDe(r);
    Array.prototype.forEach.call(raiz.querySelectorAll('.mx-abas [data-mx-secao]'), function (b) {
      if (b.dataset.mxSecao === aba) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (!buscando && r.tipo === 'aulas') { slideAtual = 0; iniciarCarrossel(); }
  }

  function route() {
    if (!D || !app) return;
    /* sem #materials no endereço (a área montou por trás de outra aba), prepara a seção de sempre */
    var r = rotaDoHash() || (est.rota ? null : { tipo:lembrada() });
    if (!r) return;
    var antes = est.rota;
    var mudou = !antes || r.tipo !== antes.tipo || r.id !== antes.id || r.k !== antes.k;
    est.rota = r;
    if (SECOES.indexOf(r.tipo) !== -1) lembrar(r.tipo);
    if (mudou) { est.busca = ''; if (campo) campo.value = ''; }
    desenhar();
    if (mudou && raiz.offsetParent) window.scrollTo({ top:0, behavior:'instant' });
  }

  /* ── carrossel do destaque ────────────────────────────────────────────── */

  function irSlide(i, entrou) {
    var fundos = app.querySelectorAll('.mx-palco .mx-slide'), textos = app.querySelectorAll('.mx-slide-texto'),
        pontos = app.querySelectorAll('.mx-pontos button');
    if (!textos.length) return;
    slideAtual = (i + textos.length) % textos.length;
    Array.prototype.forEach.call(fundos, function (f, j) { f.classList.toggle('mx-ativo', j === slideAtual); });
    Array.prototype.forEach.call(textos, function (t, j) { t.hidden = j !== slideAtual; t.classList.toggle('mx-entrou', !!entrou && j === slideAtual); });
    Array.prototype.forEach.call(pontos, function (p, j) { p.setAttribute('aria-current', String(j === slideAtual)); });
  }
  function iniciarCarrossel() {
    clearInterval(relogio);
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    relogio = setInterval(function () {
      if (!pausado && !document.hidden && raiz && raiz.offsetParent) irSlide(slideAtual + 1, true);
    }, 7000);
  }

  /* ── ações ────────────────────────────────────────────────────────────── */

  function marcar(k) {
    if (vistos[k]) delete vistos[k]; else vistos[k] = Date.now();
    gravar(chaveVistos, vistos);
    if (est.rota.tipo !== 'aula') { var y = window.scrollY; desenhar(); window.scrollTo(0, y); return; }
    /* na aula, troca só o botão e a linha da lista, para o player não recarregar */
    var a = porChave[k];
    var botao = app.querySelector('[data-mx="marcar"]');
    if (botao) botao.outerHTML = botaoMarcar(a);
    var linha = app.querySelector('.mx-lista [data-k="' + k + '"]');
    if (linha) linha.outerHTML = linhaLista(a, porChave[est.rota.k]);
  }

  /* PDF abre numa aba nova pela URL assinada do acervo (a janela abre já, no
     clique, para o bloqueador de pop-up não barrar); o resto baixa como hoje. */
  function abrir(id) {
    var m = matPorId[id];
    if (!m) return;
    if (/\.pdf$/i.test(m.arquivo_nome || '')) {
      var janela = window.open('', '_blank');
      C.sb.storage.from('materiais').createSignedUrl(m.arquivo_path, 3600).then(function (res) {
        if (res.error || !res.data) throw new Error('Não foi possível abrir o arquivo.');
        if (janela) { janela.opener = null; janela.location.href = res.data.signedUrl; }
        else location.href = res.data.signedUrl;
      }).catch(function (err) {
        if (janela) janela.close();
        avisar(err.message || 'Não foi possível abrir o arquivo.', 'alert');
      });
    } else {
      avisar('Baixando…', 'download');
      C.data.materials.baixar(m.arquivo_path, m.arquivo_nome).catch(function (err) {
        avisar(err.message || 'Não foi possível abrir o arquivo.', 'alert');
      });
    }
    abertos[id] = Date.now();
    gravar(chaveAbertos, abertos);
    setTimeout(function () {
      if (est.rota.tipo === 'aula') {
        Array.prototype.forEach.call(app.querySelectorAll('.mx-mat-linha[data-id="' + id + '"]'), function (l) { l.outerHTML = linhaMat(m); });
        return;
      }
      var y = window.scrollY; desenhar(); window.scrollTo(0, y);
    }, 0);
  }

  function filtrar(grupo, v) {
    if (grupo === 'gerais') est.filtroG = v; else est.filtroC = v;
    var alvo = app.querySelector('[data-mx-lista="' + grupo + '"]');
    if (alvo) alvo.innerHTML = grupo === 'gerais' ? listaGerais() : listaClinica();
    Array.prototype.forEach.call(app.querySelectorAll('[data-mx="filtro"][data-grupo="' + grupo + '"]'), function (x) {
      x.setAttribute('aria-pressed', String(x.dataset.v === v));
    });
  }

  function aoClicar(e) {
    var s = e.target.closest('[data-mx-secao]');
    if (s && raiz.contains(s)) { est.busca = ''; if (campo) campo.value = ''; ir(s.dataset.mxSecao); return; }
    var b = e.target.closest('[data-mx]');
    if (!b || !raiz.contains(b)) return;
    var acao = b.dataset.mx;
    if (acao === 'aula') {
      var caminho = 'aula/' + encodeURIComponent(b.dataset.k);
      if (est.rota.tipo === 'aula' && b.dataset.trocar === '1' && !est.busca) trocarPara(caminho); else ir(caminho);
    }
    else if (acao === 'curso') ir('curso/' + b.dataset.id);
    else if (acao === 'voltar') voltar();
    else if (acao === 'limpar') { est.busca = ''; campo.value = ''; desenhar(); }
    else if (acao === 'marcar') marcar(b.dataset.k);
    else if (acao === 'abrir') abrir(b.dataset.id);
    else if (acao === 'filtro') filtrar(b.dataset.grupo, b.dataset.v);
    else if (acao === 'slide') { irSlide(+b.dataset.i, true); iniciarCarrossel(); }
    else if (acao === 'rolar') {
      var t = b.parentElement.querySelector('.mx-trilho');
      t.scrollBy({ left:+b.dataset.dir * t.clientWidth * 0.85, behavior:'smooth' });
    }
    else if (acao === 'modulo') {
      var alvo = document.getElementById('mx-mod-' + b.dataset.i);
      if (alvo) alvo.scrollIntoView({ behavior:'smooth', block:'start' });
    }
  }

  /* ── montagem ─────────────────────────────────────────────────────────── */

  function mount(el, o) {
    ctx = o; D = o.catalogo;
    chaveVistos = 'cerebro-aulas-v1:' + o.membro.id;
    chaveAbertos = 'cerebro-materiais-abertos-v1:' + o.membro.id;
    vistos = ler(chaveVistos); abertos = ler(chaveAbertos);
    indexar();
    el.innerHTML = '<div class="mx">' +
      '<div class="mx-nav">' +
        '<nav class="mx-abas" aria-label="Seções de Materiais">' + SECOES.map(function (s) {
          return '<button type="button" data-mx-secao="' + s + '" aria-label="' + NOME_SECAO[s] + '">' + ICO[s] +
            '<span class="mx-rot-longo">' + NOME_SECAO[s] + '</span><span class="mx-rot-curto" aria-hidden="true">' + NOME_CURTO[s] + '</span></button>';
        }).join('') + '</nav>' +
        '<label class="mx-busca"><span class="mx-sr">Buscar aulas e materiais</span>' + ICO.busca +
          '<input type="search" data-mx-busca placeholder="Buscar aulas e materiais" autocomplete="off"></label>' +
      '</div>' +
      (o.admin && !D.liberado ? '<p class="mx-previa"><b>Prévia da equipe.</b> Os mestres ainda veem o Materiais antigo; esta área abre para eles quando o catálogo de aulas for publicado como liberado.</p>' : '') +
      '<div data-mx-app></div>' +
    '</div>';
    raiz = el.querySelector('.mx');
    app = raiz.querySelector('[data-mx-app]');
    campo = raiz.querySelector('[data-mx-busca]');
    Object.keys(D.fotos || {}).forEach(function (k) { raiz.style.setProperty('--img-' + k, 'url("' + D.fotos[k] + '")'); });
    Object.keys(D.capas || {}).forEach(function (k) { raiz.style.setProperty('--img-capa-' + k, 'url("' + D.capas[k] + '")'); });
    raiz.addEventListener('click', aoClicar);
    raiz.addEventListener('mouseover', function (e) { pausado = !!e.target.closest('.mx-palco'); });
    raiz.addEventListener('focusin', function (e) { pausado = !!e.target.closest('.mx-palco'); });
    campo.addEventListener('input', function () {
      est.busca = campo.value;
      desenhar();
      window.scrollTo({ top:0, behavior:'instant' });
    });
    if (!ouvindo) {
      ouvindo = true;
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || !raiz || !raiz.offsetParent || document.activeElement === campo) return;
        if (est.rota && (est.rota.tipo === 'curso' || est.rota.tipo === 'aula')) voltar();
      });
    }
    C.materiais.ativo = true;
    est.rota = null;
    route();
  }

  C.materiais = {
    ativo: false,
    /* a linha do catálogo entre os materiais que o membro enxerga */
    catalogoDe: function (rows) {
      return (rows || []).filter(function (r) { return r.categoria === CAT_SISTEMA && r.arquivo_nome === ARQ_CATALOGO; })[0] || null;
    },
    carregar: function (linha) {
      return C.sb.storage.from('materiais').download(linha.arquivo_path).then(function (res) {
        if (res.error) throw new Error(res.error.message || 'Não foi possível ler o catálogo de aulas.');
        return res.data.text();
      }).then(function (txt) { return JSON.parse(txt); });
    },
    mount: mount,
    route: route,
    leave: function () { clearInterval(relogio); }
  };
})();
