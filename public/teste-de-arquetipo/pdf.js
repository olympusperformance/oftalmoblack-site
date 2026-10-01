/* Teste de Arquétipo · PDF do resultado.
   Gerado no próprio navegador com pdfmake (texto vetorial, fontes embutidas),
   sem caixa de impressão: o botão baixa o arquivo direto. A biblioteca, as
   fontes e as imagens só carregam quando o resultado aparece. */
(function () {
  'use strict';

  var BASE = (document.currentScript && document.currentScript.src)
    ? new URL('.', document.currentScript.src).href
    : '/teste-de-arquetipo/';

  var LIB = BASE + 'vendor/pdfmake-0.2.20.min.js';
  var FONTES = ['cinzel-500.ttf', 'cinzel-600.ttf', 'inter-400.ttf', 'inter-400i.ttf', 'inter-500.ttf', 'inter-600.ttf'];
  var IMAGENS = { logo: ['logo.png', 'image/png'], fundo: ['fundo.jpg', 'image/jpeg'] };

  var COR = {
    fundo: '#000000', ouro: '#d89d4d', ouroClaro: '#e6bd74', champanhe: '#fdf3b5',
    creme: '#f5f0e6', texto: '#d3cdc3', suave: '#a39d93', apagado: '#6f6a62',
    fio: '#3d2d17', cartao: '#0e0b07', trilho: '#1f1a12', barra: '#a8783a'
  };
  var A4 = { w: 595.28, h: 841.89 };
  var MARGEM = 52;
  var LARG = A4.w - MARGEM * 2;

  var pronto = null;

  function carregarScript(src) {
    return new Promise(function (ok, falha) {
      if (window.pdfMake && window.pdfMake.createPdf) return ok();
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { ok(); };
      s.onerror = function () { falha(new Error('falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
  }

  function base64(buf) {
    var bytes = new Uint8Array(buf), partes = [], passo = 0x8000;
    for (var i = 0; i < bytes.length; i += passo) {
      partes.push(String.fromCharCode.apply(null, bytes.subarray(i, i + passo)));
    }
    return btoa(partes.join(''));
  }

  function baixarBinario(nome) {
    return fetch(BASE + 'pdf/' + nome).then(function (r) {
      if (!r.ok) throw new Error(nome + ': HTTP ' + r.status);
      return r.arrayBuffer();
    }).then(base64);
  }

  /* carrega tudo uma vez só; chamado quando o resultado aparece */
  function preparar() {
    if (pronto) return pronto;
    var vfs = {}, imagens = {};
    pronto = Promise.all([
      carregarScript(LIB),
      Promise.all(FONTES.map(function (f) {
        return baixarBinario(f).then(function (b) { vfs[f] = b; });
      })),
      Promise.all(Object.keys(IMAGENS).map(function (k) {
        return baixarBinario(IMAGENS[k][0]).then(function (b) {
          imagens[k] = 'data:' + IMAGENS[k][1] + ';base64,' + b;
        });
      }))
    ]).then(function () {
      return { vfs: vfs, imagens: imagens };
    });
    pronto.catch(function () { pronto = null; }); // deixa tentar de novo
    return pronto;
  }

  var FONTS = {
    Inter: { normal: 'inter-400.ttf', bold: 'inter-600.ttf', italics: 'inter-400i.ttf', bolditalics: 'inter-600.ttf' },
    InterMedio: { normal: 'inter-500.ttf', bold: 'inter-600.ttf', italics: 'inter-400i.ttf', bolditalics: 'inter-600.ttf' },
    Cinzel: { normal: 'cinzel-500.ttf', bold: 'cinzel-600.ttf', italics: 'cinzel-500.ttf', bolditalics: 'cinzel-600.ttf' }
  };

  /* ── peças do layout ── */
  function fioCurto() {
    return { width: 26, canvas: [{ type: 'line', x1: 0, y1: 5.5, x2: 26, y2: 5.5, lineWidth: 0.7, lineColor: COR.ouro }] };
  }
  function sobrancelha(txt, margem) {
    return {
      columns: [
        { width: '*', text: '' }, fioCurto(),
        { width: 'auto', text: txt, fontSize: 8, bold: true, characterSpacing: 2.8, color: COR.ouro, margin: [11, 0, 8, 0] },
        fioCurto(), { width: '*', text: '' }
      ],
      columnGap: 0, margin: margem || [0, 0, 0, 0]
    };
  }
  function rotulo(txt, cor, extra) {
    var o = { text: txt.toUpperCase(), fontSize: 6.8, bold: true, characterSpacing: 1.9, color: cor || COR.ouro };
    for (var k in extra) o[k] = extra[k];
    return o;
  }
  function cabecalhoSecao(num, titulo) {
    return [
      {
        columns: [
          { width: 'auto', text: num, font: 'Cinzel', bold: true, fontSize: 12, color: COR.ouro, margin: [0, 2.5, 0, 0] },
          { width: '*', text: titulo, font: 'InterMedio', bold: true, fontSize: 15.5, color: COR.creme }
        ],
        columnGap: 12
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: LARG, y2: 0, lineWidth: 0.6, lineColor: COR.fio }], margin: [0, 10, 0, 14] }
    ];
  }
  function secao(num, titulo, corpo, resto) {
    var bloco = { stack: cabecalhoSecao(num, titulo).concat(corpo), unbreakable: true };
    if (!resto) { bloco.margin = [0, 28, 0, 0]; return bloco; }
    // resto: parte que pode cair na página seguinte sem separar título e texto
    return { stack: [bloco].concat(resto.map(function (n) { n.unbreakable = true; return n; })), margin: [0, 28, 0, 0] };
  }
  /* cartão com filete dourado à esquerda */
  function cartaoFilete(stack, margem) {
    return {
      table: { widths: ['*'], body: [[{ stack: stack, fillColor: COR.cartao }]] },
      layout: {
        hLineWidth: function () { return 0; },
        vLineWidth: function (i) { return i === 0 ? 2 : 0; },
        vLineColor: function () { return COR.ouro; },
        paddingLeft: function () { return 17; }, paddingRight: function () { return 17; },
        paddingTop: function () { return 13; }, paddingBottom: function () { return 14; }
      },
      margin: margem || [0, 0, 0, 0]
    };
  }
  /* cartão com borda fina em volta */
  function cartaoBorda(stack, margem) {
    return {
      table: { widths: ['*'], body: [[{ stack: stack, fillColor: COR.cartao }]] },
      layout: {
        hLineWidth: function () { return 0.7; }, vLineWidth: function () { return 0.7; },
        hLineColor: function () { return COR.fio; }, vLineColor: function () { return COR.fio; },
        paddingLeft: function () { return 20; }, paddingRight: function () { return 20; },
        paddingTop: function () { return 17; }, paddingBottom: function () { return 18; }
      },
      margin: margem || [0, 0, 0, 0]
    };
  }

  /* <strong> do texto da essência vira trecho em dourado */
  function textoRico(html) {
    var partes = [], re = /<strong>(.*?)<\/strong>/g, ult = 0, m;
    while ((m = re.exec(html))) {
      if (m.index > ult) partes.push(html.slice(ult, m.index));
      partes.push({ text: m[1], bold: true, color: COR.ouroClaro });
      ult = re.lastIndex;
    }
    if (ult < html.length) partes.push(html.slice(ult));
    return partes;
  }

  function dataBR(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }
  function agoraBR() {
    var d = new Date();
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() +
      ' às ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function documento(r) {
    var P = r.principal, B = r.apoio, u = r.usuario || {};
    var nome = u.nome || 'Membro do Black';

    var ident = {
      table: {
        widths: ['*', '*', 92],
        body: [
          [rotulo('Nome'), rotulo('Cidade'), rotulo('Data')],
          [
            { text: nome, fontSize: 11, color: COR.creme, font: 'InterMedio' },
            { text: u.cidade || 'Não informada', fontSize: 11, color: u.cidade ? COR.creme : COR.apagado, font: 'InterMedio' },
            { text: dataBR(u.data) || 'Não informada', fontSize: 11, color: COR.creme, font: 'InterMedio' }
          ]
        ]
      },
      layout: {
        hLineWidth: function (i, node) { return (i === 0 || i === node.table.body.length) ? 0.6 : 0; },
        vLineWidth: function () { return 0; },
        hLineColor: function () { return COR.fio; },
        paddingLeft: function () { return 0; }, paddingRight: function () { return 12; },
        paddingTop: function (i) { return i === 0 ? 11 : 3; },
        paddingBottom: function (i) { return i === 1 ? 11 : 0; }
      }
    };

    var hero = [
      rotulo('Seu arquétipo principal', COR.suave, { alignment: 'center', margin: [0, 26, 0, 9], characterSpacing: 2.4 }),
      { text: P.nome, font: 'Cinzel', bold: true, fontSize: 40, color: COR.ouroClaro, alignment: 'center', characterSpacing: 0.4, lineHeight: 1 },
      {
        text: P.variacao ? 'VARIAÇÃO · ' + P.variacao.nome.toUpperCase() : 'ARQUÉTIPO PRINCIPAL',
        fontSize: 8.6, bold: true, characterSpacing: 2.6, color: COR.ouro, alignment: 'center', margin: [0, 9, 0, 13]
      },
      { text: P.desc, fontSize: 11, lineHeight: 1.42, color: COR.texto, alignment: 'center', margin: [30, 0, 30, 0] }
    ];

    var essencia = [{ text: textoRico(P.essencia), fontSize: 10.4, lineHeight: 1.5, color: COR.texto }];
    var essenciaResto = [];
    if (P.variacao) {
      essenciaResto.push(cartaoFilete([
        rotulo('Sua variação'),
        { text: P.variacao.nome, font: 'Cinzel', bold: true, fontSize: 14, color: COR.creme, margin: [0, 5, 0, 4] },
        { text: P.variacao.desc, fontSize: 10, lineHeight: 1.45, color: COR.texto }
      ], [0, 14, 0, 0]));
    }

    var ig = P.ig.map(function (c, i) {
      return cartaoFilete([{
        columns: [
          { width: 24, text: String(i + 1).padStart(2, '0'), font: 'Cinzel', bold: true, fontSize: 14, color: COR.ouro, margin: [0, 1, 0, 0] },
          {
            width: '*', stack: [
              { text: c.t, font: 'InterMedio', bold: true, fontSize: 11.4, color: COR.ouroClaro },
              { text: c.d, fontSize: 10, lineHeight: 1.42, color: COR.texto, margin: [0, 3, 0, 0] }
            ]
          }
        ],
        columnGap: 10
      }], [0, 0, 0, i < P.ig.length - 1 ? 8 : 0]);
    });

    var apoio = [cartaoBorda([
      rotulo('Sombra complementar'),
      { text: B.nome, font: 'Cinzel', bold: true, fontSize: 19, color: COR.creme, margin: [0, 6, 0, 4] },
      rotulo(B.variacao ? 'Variação · ' + B.variacao.nome : 'Arquétipo de apoio', COR.ouroClaro, { margin: [0, 0, 0, 10] }),
      { text: B.desc, fontSize: 10.2, lineHeight: 1.45, color: COR.texto }
    ])];

    var LN = 112, LV = 26, PAD = 8;
    var barraW = LARG - LN - LV - PAD * 3;
    var placar = [{
      table: {
        widths: [LN, '*', LV],
        body: r.ranking.map(function (row, i) {
          var top = i === 0;
          return [
            { text: row.nome.toUpperCase(), fontSize: 7.4, bold: true, characterSpacing: 1.3, color: top ? COR.ouroClaro : COR.suave },
            {
              canvas: [
                { type: 'rect', x: 0, y: 2.6, w: barraW, h: 4.2, r: 2.1, color: COR.trilho },
                { type: 'rect', x: 0, y: 2.6, w: Math.max(4.2, barraW * row.pct / 100), h: 4.2, r: 2.1, color: top ? COR.ouroClaro : COR.barra }
              ]
            },
            { text: String(row.total), font: 'Cinzel', bold: true, fontSize: 10, color: COR.ouro, alignment: 'right' }
          ];
        })
      },
      layout: {
        hLineWidth: function () { return 0; }, vLineWidth: function () { return 0; },
        paddingLeft: function (i) { return i === 0 ? 0 : PAD; }, paddingRight: function (i) { return i === 2 ? 0 : PAD / 2; },
        paddingTop: function () { return 4.2; }, paddingBottom: function () { return 4.2; }
      }
    }];

    var passos = [
      { text: 'O coordenador de marketing do Black vai usar este resultado para construir o seu plano de posicionamento. Guarde este PDF e anexe ao seu onboarding.', fontSize: 10.4, lineHeight: 1.5, color: COR.texto },
      { text: 'Gerado em ' + agoraBR() + ' · oftalmoblack.com.br/teste-de-arquetipo', fontSize: 7.6, color: COR.apagado, margin: [0, 12, 0, 0] }
    ];

    return {
      pageSize: 'A4',
      pageMargins: [MARGEM, 76, MARGEM, 66],
      info: {
        title: 'Teste de Arquétipo · ' + nome,
        author: 'Club OftalmoBlack',
        subject: 'Resultado do Teste de Arquétipo: ' + P.nome + (P.variacao ? ' (' + P.variacao.nome + ')' : ''),
        creator: 'oftalmoblack.com.br'
      },
      defaultStyle: { font: 'Inter', fontSize: 10, color: COR.texto, lineHeight: 1.3 },
      images: { logo: '', fundo: '' }, // preenchido em gerar()
      background: function (pagina, tam) {
        var fundo = [{ canvas: [{ type: 'rect', x: 0, y: 0, w: tam.width, h: tam.height, color: COR.fundo }] }];
        if (pagina === 1) fundo.push({ image: 'fundo', width: tam.width, absolutePosition: { x: 0, y: 0 } });
        return fundo;
      },
      header: function (pagina) {
        if (pagina === 1) return null;
        return {
          margin: [MARGEM, 26, MARGEM, 0],
          stack: [
            {
              columns: [
                { width: '*', text: 'TESTE DE ARQUÉTIPO · ' + nome.toUpperCase(), fontSize: 6.6, bold: true, characterSpacing: 1.8, color: COR.ouro },
                { width: 'auto', text: 'CLUB OFTALMOBLACK', alignment: 'right', fontSize: 6.6, bold: true, characterSpacing: 1.8, color: COR.apagado }
              ]
            },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: LARG, y2: 0, lineWidth: 0.5, lineColor: COR.fio }], margin: [0, 7, 0, 0] }
          ]
        };
      },
      footer: function (pagina, total) {
        return {
          margin: [MARGEM, 26, MARGEM, 0],
          columns: [
            { text: 'CONFIDENCIAL · USO INTERNO · CLUB OFTALMOBLACK', fontSize: 6.4, bold: true, characterSpacing: 1.7, color: COR.apagado },
            { text: pagina + ' / ' + total, alignment: 'right', font: 'Cinzel', bold: true, fontSize: 8, color: COR.ouro }
          ]
        };
      },
      content: [
        { image: 'logo', width: 150, alignment: 'center', margin: [0, -26, 0, 20] },
        sobrancelha('TESTE DE ARQUÉTIPO'),
        { text: 'POSICIONAMENTO DE MARCA PESSOAL · 60 PERGUNTAS', alignment: 'center', fontSize: 6.8, bold: true, characterSpacing: 2, color: COR.suave, margin: [0, 8, 0, 20] },
        ident,
        { stack: hero },
        secao('01', 'Sua essência', essencia, essenciaResto),
        secao('02', 'Como o seu Instagram deve soar', ig),
        secao('03', 'Arquétipo de apoio', apoio),
        secao('04', 'Pontuação dos 12 arquétipos', placar),
        secao('05', 'Próximos passos', passos)
      ]
    };
  }

  function criar(r) {
    return preparar().then(function (a) {
      var doc = documento(r);
      doc.images = a.imagens;
      return window.pdfMake.createPdf(doc, null, FONTS, a.vfs);
    });
  }

  function nomeArquivo(r) {
    var n = ((r.usuario && r.usuario.nome) || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
    return 'Teste de Arquétipo' + (n ? ' - ' + n : '') + '.pdf';
  }

  function salvarBlob(blob, nome) {
    if (window.navigator && window.navigator.msSaveOrOpenBlob) { window.navigator.msSaveOrOpenBlob(blob, nome); return; }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  window.ArquetipoPDF = {
    preparar: function () { preparar().catch(function () {}); },
    baixar: function (r) {
      return criar(r).then(function (pdf) {
        return new Promise(function (ok) { pdf.getBlob(ok); });
      }).then(function (blob) { salvarBlob(blob, nomeArquivo(r)); });
    },
    base64: function (r) { // usado na conferência automática
      return criar(r).then(function (pdf) {
        return new Promise(function (ok) { pdf.getBase64(ok); });
      });
    }
  };
})();
