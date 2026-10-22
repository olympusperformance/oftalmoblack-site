/* Teste DISC · PDF do resultado.
   Gerado no próprio navegador com pdfmake (texto vetorial, fontes embutidas),
   no mesmo molde do Teste de Arquétipo. A biblioteca, as fontes e as imagens
   só carregam quando o resultado aparece. */
(function () {
  'use strict';

  var BASE = (document.currentScript && document.currentScript.src)
    ? new URL('.', document.currentScript.src).href
    : '/teste-disc/';

  var LIB = BASE + 'vendor/pdfmake-0.2.20.min.js';
  var FONTES = ['cinzel-500.ttf', 'cinzel-600.ttf', 'inter-400.ttf', 'inter-400i.ttf', 'inter-500.ttf', 'inter-600.ttf'];
  var IMAGENS = { logo: ['logo.png', 'image/png'], fundo: ['fundo.jpg', 'image/jpeg'] };

  var COR = {
    fundo: '#000000', ouro: '#d89d4d', ouroClaro: '#e6bd74', champanhe: '#fdf3b5',
    creme: '#f5f0e6', texto: '#d3cdc3', suave: '#a39d93', apagado: '#6f6a62',
    fio: '#3d2d17', cartao: '#0e0b07', trilho: '#1f1a12'
  };
  var A4 = { w: 595.28, h: 841.89 };
  var MARGEM = 52;
  var LARG = A4.w - MARGEM * 2;
  var GAP = 12;
  var MEIA = (LARG - GAP) / 2;

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
  function paragrafo(txt, extra) {
    var o = { text: txt, fontSize: 10.4, lineHeight: 1.5, color: COR.texto };
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
    if (!resto || !resto.length) { bloco.margin = [0, 28, 0, 0]; return bloco; }
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
        paddingLeft: function () { return 15; }, paddingRight: function () { return 15; },
        paddingTop: function () { return 12; }, paddingBottom: function () { return 13; }
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
        paddingLeft: function () { return 15; }, paddingRight: function () { return 15; },
        paddingTop: function () { return 12; }, paddingBottom: function () { return 13; }
      },
      margin: margem || [0, 0, 0, 0]
    };
  }
  function lado(a, b, margem) {
    return { columns: [{ width: '*', stack: [a] }, { width: '*', stack: [b] }], columnGap: GAP, margin: margem || [0, 0, 0, 0] };
  }
  function listaPdf(itens, extra) {
    var o = { ul: itens.map(function (t) { return { text: t, margin: [0, 0, 0, 3.5] }; }), fontSize: 10, lineHeight: 1.38, color: COR.texto, markerColor: COR.ouro };
    for (var k in extra) o[k] = extra[k];
    return o;
  }
  function rico(partes) {
    return partes.map(function (p) {
      return typeof p === 'string' ? p : { text: p.b, bold: true, color: COR.ouroClaro };
    });
  }
  function maiuscula(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  function dataBR(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }
  function agoraBR() {
    var d = new Date();
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() +
      ' às ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* gráfico de barras de um perfil (Adaptado ou Natural) */
  function grafico(titulo, sub, valores) {
    var F = window.DISC.FATORES, ORDEM = window.DISC.ORDEM;
    var max = Math.max(valores.D, valores.I, valores.S, valores.C, 8);
    var H = 84, BW = 20;
    var colunas = ORDEM.map(function (k) {
      var h = Math.max(3, Math.round(valores[k] / max * H));
      return {
        width: '*',
        stack: [
          { text: String(valores[k]), font: 'InterMedio', bold: true, fontSize: 10, color: COR.creme, alignment: 'center', margin: [0, 0, 0, 4] },
          {
            columns: [
              { width: '*', text: '' },
              { width: BW, canvas: [
                { type: 'rect', x: 0, y: 0, w: BW, h: H, r: 2, color: COR.trilho },
                { type: 'rect', x: 0, y: H - h, w: BW, h: h, r: 2, color: F[k].cor }
              ] },
              { width: '*', text: '' }
            ],
            columnGap: 0
          },
          { text: k, font: 'Cinzel', bold: true, fontSize: 11, color: F[k].cor, alignment: 'center', margin: [0, 5, 0, 0] },
          { text: F[k].fator.toUpperCase(), fontSize: 5.4, bold: true, characterSpacing: 0.6, color: COR.suave, alignment: 'center', margin: [0, 1, 0, 0] }
        ]
      };
    });
    return cartaoBorda([
      { text: [{ text: 'Perfil ', color: COR.creme }, { text: titulo, color: COR.ouroClaro }], font: 'InterMedio', bold: true, fontSize: 12 },
      rotulo(sub, COR.suave, { margin: [0, 4, 0, 12], fontSize: 6.2, characterSpacing: 1.4 }),
      { columns: colunas, columnGap: 4 }
    ]);
  }

  function matrizPdf(m) {
    var F = window.DISC.FATORES, ORDEM = window.DISC.ORDEM;
    var cartoes = ORDEM.map(function (k) {
      return cartaoBorda([
        { text: [{ text: k + '  ', font: 'Cinzel', bold: true, color: F[k].cor, fontSize: 11 }, { text: F[k].paciente.toUpperCase(), fontSize: 7, bold: true, characterSpacing: 1.5, color: COR.ouroClaro }] },
        { text: [{ text: 'Risco: ', bold: true, color: COR.creme }, m[k][0]], fontSize: 9.4, lineHeight: 1.38, color: COR.texto, margin: [0, 7, 0, 4] },
        { text: [{ text: 'Ajuste: ', bold: true, color: COR.creme }, m[k][1]], fontSize: 9.4, lineHeight: 1.38, color: COR.texto }
      ]);
    });
    return [
      lado(cartoes[0], cartoes[1], [0, 0, 0, GAP]),
      lado(cartoes[2], cartoes[3])
    ];
  }

  function documento(r) {
    var DISC = window.DISC, F = DISC.FATORES, ORDEM = DISC.ORDEM;
    var P = DISC.PUBLICOS[r.publico], A = r.principal, B = r.secundario, pt = r.pontos, u = r.usuario || {};
    var medico = r.publico === 'medico';
    var nome = u.nome || (medico ? 'Membro do Black' : 'Membro da equipe');
    var c = 0;
    var n = function () { c++; return String(c).padStart(2, '0'); };

    /* identificação */
    var cols = medico
      ? [['Nome', nome, true], ['Cidade', u.cidade], ['Data', dataBR(u.data)]]
      : [['Nome', nome, true], ['Cargo ou função', u.cargo], ['Clínica', u.clinica], ['Data', dataBR(u.data)]];
    var ident = {
      table: {
        widths: cols.map(function (col, i) { return i === cols.length - 1 ? 66 : '*'; }),
        body: [
          cols.map(function (col) { return rotulo(col[0]); }),
          cols.map(function (col) {
            return { text: col[1] || 'Não informado', fontSize: 10.6, color: col[1] ? COR.creme : COR.apagado, font: 'InterMedio' };
          })
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
      rotulo('Seu perfil predominante', COR.suave, { alignment: 'center', margin: [0, 26, 0, 9], characterSpacing: 2.4 }),
      { text: A.fator, font: 'Cinzel', bold: true, fontSize: 40, color: COR.ouroClaro, alignment: 'center', characterSpacing: 0.4, lineHeight: 1 },
      { text: 'PERFIL ' + A.letra + ' · TEMPERAMENTO ' + A.temperamento.toUpperCase(), fontSize: 8.6, bold: true, characterSpacing: 2.6, color: COR.ouro, alignment: 'center', margin: [0, 9, 0, 11] },
      { text: A.tracos, fontSize: 11, color: COR.texto, alignment: 'center' }
    ];

    var essencia = [paragrafo(A.essencia)];
    var essenciaResto = [lado(
      cartaoFilete([
        rotulo(r.combo ? 'Combinação ' + A.letra + ' + ' + B.letra : 'Perfil secundário'),
        { text: r.combo ? r.combo[0] : B.fator, font: 'Cinzel', bold: true, fontSize: 13.5, color: COR.creme, margin: [0, 5, 0, 4] },
        { text: r.combo ? r.combo[1] : B.tracos, fontSize: 9.6, lineHeight: 1.42, color: COR.texto }
      ]),
      cartaoFilete([
        rotulo('Temperamento'),
        { text: A.temperamento, font: 'Cinzel', bold: true, fontSize: 13.5, color: COR.creme, margin: [0, 5, 0, 4] },
        { text: 'Com ' + B.temperamento + ' como secundário. O que te move: ' + A.move + '.', fontSize: 9.6, lineHeight: 1.42, color: COR.texto }
      ]),
      [0, 14, 0, 0]
    )];

    var graficos = [paragrafo(DISC.GRAFICOS, { fontSize: 10 })];
    var graficosResto = [{
      stack: [
        lado(
          grafico('Adaptado', 'No trabalho hoje · a “máscara”', pt.adaptado),
          grafico('Natural', 'Sob pressão · o “núcleo”', pt.natural)
        ),
        {
          columns: [ORDEM.slice(0, 2), ORDEM.slice(2)].map(function (par) {
            return {
              width: '*',
              stack: par.map(function (k) {
                return { text: [{ text: k + '  ', font: 'Cinzel', bold: true, color: F[k].cor }, { text: F[k].fator + '. ', bold: true, color: COR.creme }, F[k].eixo + '.'], fontSize: 8.6, color: COR.suave, margin: [0, 0, 0, 4] };
              })
            };
          }),
          columnGap: GAP, margin: [0, 12, 0, 0]
        }
      ],
      margin: [0, 14, 0, 0]
    }];

    var comunica = [paragrafo(A.comunicacao)];

    var forcas = [lado(
      cartaoBorda([rotulo('Forças naturais', COR.ouro, { margin: [0, 0, 0, 8] }), listaPdf(A.forcas)]),
      cartaoBorda([rotulo('Pontos de atenção', COR.ouro, { margin: [0, 0, 0, 8] }), listaPdf(A.atencao)])
    )];

    // a numeração segue a ordem de criação: seções comuns, as do público e as finais
    var comuns = [
      secao(n(), 'Sua essência', essencia, essenciaResto),
      secao(n(), 'Seus dois perfis', graficos, graficosResto),
      secao(n(), 'Como você se comunica', comunica),
      secao(n(), 'Forças e pontos de atenção', forcas)
    ];
    var especificas = [];
    if (medico) {
      var M = A.medico;
      especificas.push(secao(n(), 'Você na liderança da clínica', [paragrafo(M.lideranca.texto)],
        M.lideranca.praticas.map(function (t, i) {
          return cartaoFilete([{
            columns: [
              { width: 22, text: String(i + 1).padStart(2, '0'), font: 'Cinzel', bold: true, fontSize: 12.5, color: COR.ouro, margin: [0, 0.5, 0, 0] },
              { width: '*', text: t, fontSize: 10, lineHeight: 1.4, color: COR.texto }
            ],
            columnGap: 10
          }], [0, i === 0 ? 14 : 7, 0, 0]);
        })));
      especificas.push(secao(n(), 'Você na consulta', [cartaoFilete([
        rotulo('Como você conduz naturalmente'),
        paragrafo(M.conduz.forca, { fontSize: 10, margin: [0, 5, 0, 4] }),
        { text: [{ text: 'Risco: ', bold: true, color: COR.creme }, M.conduz.risco], fontSize: 10, lineHeight: 1.45, color: COR.texto }
      ])], [rotulo('Com cada tipo de paciente', COR.suave, { margin: [0, 16, 0, 9] })].concat(matrizPdf(M.matriz))));
      especificas.push(secao(n(), 'Quem completa o seu perfil na equipe', [paragrafo(M.complemento.texto)], [
        {
          columns: M.complemento.perfis.map(function (p) {
            return {
              width: '*', stack: [cartaoBorda([
                { text: [{ text: p[0] + '  ', font: 'Cinzel', bold: true, color: F[p[0]].cor, fontSize: 11 }, { text: F[p[0]].temperamento.toUpperCase(), fontSize: 7, bold: true, characterSpacing: 1.5, color: COR.ouroClaro }] },
                { text: maiuscula(p[1]) + '.', fontSize: 9.4, lineHeight: 1.38, color: COR.texto, margin: [0, 6, 0, 0] }
              ])]
            };
          }),
          columnGap: 10, margin: [0, 14, 0, 0]
        },
        paragrafo(P.contratar, { fontSize: 9, color: COR.suave, margin: [0, 12, 0, 0] })
      ]));
    } else {
      var E = A.equipe;
      especificas.push(secao(n(), 'Onde você rende mais na clínica',
        [paragrafo('Funções em que esse perfil costuma render mais:', { margin: [0, 0, 0, 6] }), listaPdf(E.funcoes)],
        [
          cartaoFilete([
            rotulo('Ambiente ideal'),
            paragrafo(A.ambiente, { fontSize: 10, margin: [0, 5, 0, 4] }),
            { text: [{ text: 'Rende pouco em: ', bold: true, color: COR.creme }, E.poucoRende.charAt(0).toLowerCase() + E.poucoRende.slice(1)], fontSize: 10, lineHeight: 1.45, color: COR.texto }
          ], [0, 12, 0, 0]),
          paragrafo(P.ressalva, { fontSize: 9, color: COR.suave, margin: [0, 12, 0, 0] })
        ]));
      especificas.push(secao(n(), 'No atendimento ao paciente',
        [paragrafo(rico([P.apostila + ' O seu é ', { b: A.temperamento }, ', com ', { b: B.temperamento }, ' como secundário.']))],
        [cartaoFilete([
          rotulo('Como você atende naturalmente'),
          paragrafo(E.atende.forca, { fontSize: 10, margin: [0, 5, 0, 4] }),
          { text: [{ text: 'Risco: ', bold: true, color: COR.creme }, E.atende.risco], fontSize: 10, lineHeight: 1.45, color: COR.texto }
        ], [0, 14, 0, 0]),
        rotulo('Com cada tipo de paciente', COR.suave, { margin: [0, 16, 0, 9] })].concat(matrizPdf(E.matriz))));
      especificas.push(secao(n(), 'Como liderar este perfil', [paragrafo(A.liderar)]));
    }

    var publicoTxt = medico ? 'PERFIL COMPORTAMENTAL DO MÉDICO' : 'PERFIL COMPORTAMENTAL DA EQUIPE';
    var endereco = 'oftalmoblack.com.br/teste-disc/' + r.publico;

    return {
      pageSize: 'A4',
      pageMargins: [MARGEM, 76, MARGEM, 66],
      info: {
        title: 'Teste DISC · ' + nome,
        author: 'Club OftalmoBlack',
        subject: 'Resultado do Teste DISC: ' + A.fator + ' (' + A.temperamento + ')',
        creator: 'oftalmoblack.com.br'
      },
      defaultStyle: { font: 'Inter', fontSize: 10, color: COR.texto, lineHeight: 1.3 },
      images: { logo: '', fundo: '' }, // preenchido em criar()
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
                { width: '*', text: 'TESTE DISC · ' + nome.toUpperCase(), fontSize: 6.6, bold: true, characterSpacing: 1.8, color: COR.ouro },
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
        sobrancelha('TESTE DISC'),
        { text: publicoTxt + ' · 24 GRUPOS', alignment: 'center', fontSize: 6.8, bold: true, characterSpacing: 2, color: COR.suave, margin: [0, 8, 0, 20] },
        ident,
        { stack: hero }
      ].concat(comuns).concat(especificas).concat([
        secao(n(), 'Plano de desenvolvimento', [listaPdf(A.desenvolver)]),
        secao(n(), 'Próximos passos', [
          paragrafo(P.proximos),
          { text: 'Gerado em ' + agoraBR() + ' · ' + endereco, fontSize: 7.6, color: COR.apagado, margin: [0, 12, 0, 0] }
        ])
      ])
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
    return 'Teste DISC' + (n ? ' - ' + n : '') + '.pdf';
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

  window.DiscPDF = {
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
