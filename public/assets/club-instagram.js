/* Instagram do mentorado: mesmas views e graficos do painel administrativo. */
(function () {
  'use strict';
  var C = window.Club, esc = C.esc;
  var st = { host:null, igGrafs:{} };
  function numeroCurto(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
    return String(n);
  }

  function cardStat(k, v, d, dica) {
    return '<div class="stat' + (dica ? ' tem-dica' : '') + '"' +
      (dica ? ' data-dica="' + esc(dica) + '"' : '') + '>' +
      '<div class="k">' + esc(k) + '</div>' +
      '<div class="v">' + esc(v) + '</div><div class="d">' + esc(d) + '</div></div>';
  }

  function grafico(pontos, campo, cor, altura, rotulo) {
    var H = altura || 150, W = 900, PB = 22;
    var vals = pontos.map(function (p) { return p[campo]; });
    var validos = vals.filter(function (v) { return v !== null && v !== undefined; });
    if (validos.length < 2) {
      return '<div class="ig-vazio">Ainda não há série suficiente para desenhar.</div>';
    }
    var max = Math.max.apply(null, validos), min = Math.min.apply(null, validos);
    var span = (max - min) || 1;
    var passo = W / (pontos.length - 1 || 1);
    var y = function (v) { return PB + (H - PB * 2) * (1 - (v - min) / span); };

    var d = '', area = '', aberto = false;
    pontos.forEach(function (p, i) {
      var v = p[campo];
      if (v === null || v === undefined) { aberto = false; return; }
      var px = i * passo, py = y(v);
      d += (aberto ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
      area += (aberto ? 'L' : 'M' + px.toFixed(1) + ' ' + H + 'L') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
      aberto = true;
    });
    var ultimo = pontos.length - 1;
    area += 'L' + (ultimo * passo).toFixed(1) + ' ' + H + 'Z';

    var id = 'g' + Math.random().toString(36).slice(2, 8);
    var meio = pontos[Math.floor(pontos.length / 2)];

    /* A série fica guardada para o rastreador do mouse: percorrer o DOM do SVG
       a cada movimento seria caro e nem devolveria o valor original. */
    st.igGrafs = st.igGrafs || {};
    st.igGrafs[id] = { pontos: pontos, campo: campo, rotulo: rotulo || campo, cor: cor, H: H, PB: PB };

    return '<div class="ig-graf-wrap" data-graf="' + id + '">' +
      '<svg class="ig-graf" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" ' +
      'role="img" aria-label="série de ' + esc(campo) + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" x2="0" y1="0" y2="1">' +
      '<stop offset="0%" stop-color="' + cor + '" stop-opacity=".28"/>' +
      '<stop offset="100%" stop-color="' + cor + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + id + ')"/>' +
      '<path d="' + d + '" fill="none" stroke="' + cor + '" stroke-width="2" ' +
      'stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '</svg>' +
      '<span class="ig-cursor" hidden></span>' +
      '<span class="ig-ponto" hidden style="background:' + cor + '"></span>' +
      '</div>' +
      '<div class="ig-eixo"><span>' + esc(Club.fmtDataCurta(pontos[0].dia)) + '</span>' +
      '<span>' + esc(meio ? Club.fmtDataCurta(meio.dia) : '') + '</span>' +
      '<span>' + esc(Club.fmtDataCurta(pontos[ultimo].dia)) + '</span></div>';
  }

  function barras(pontos, campo, altura) {
    var H = altura || 96;
    var vals = pontos.map(function (p) { return p[campo] || 0; });
    if (!vals.length) return '<div class="ig-vazio">Sem dados no período.</div>';
    var teto = Math.max.apply(null, vals.map(Math.abs)) || 1;
    var temNeg = vals.some(function (v) { return v < 0; });
    var util = temNeg ? H / 2 : H;
    return '<div class="ig-barras' + (temNeg ? ' tem-neg' : '') + '" style="height:' + H + 'px">' +
      pontos.map(function (p, i) {
        var v = vals[i];
        var h = Math.max(2, Math.abs(v) / teto * util * 0.94);
        var cor = v < 0 ? 'var(--danger)' : 'var(--success)';
        return '<span class="ig-col' + (v < 0 ? ' neg' : '') +
          '" data-dia="' + esc(Club.fmtDataCurta(p.dia)) +
          '" data-valor="' + (v > 0 ? '+' : '') + v + ' seguidores">' +
          '<i style="height:' + h.toFixed(1) + 'px;background:' + cor + '"></i></span>';
      }).join('') + '</div>';
  }

  function curvaSeguidores(pontos, totalHoje) {
    var acc = totalHoje, saida = [];
    for (var i = pontos.length - 1; i >= 0; i--) {
      saida.unshift({ dia: pontos[i].dia, seguidores: acc });
      acc -= (pontos[i].seguidores_ganhos || 0);
    }
    return saida;
  }

  function dica() {
    var el = document.getElementById('igTip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'igTip';
      el.className = 'ig-tip';
      el.hidden = true;
      document.body.appendChild(el);
    }
    return el;
  }

  function mostrarDica(html, x, y) {
    var el = dica();
    el.innerHTML = html;
    el.hidden = false;
    /* Perto da borda direita o balão viraria para dentro da tela sozinho — sem
       isto ele sai da janela e o número fica ilegível justamente no último dia,
       que é o que mais se olha. */
    var larg = el.offsetWidth, alt = el.offsetHeight;
    var px = Math.min(Math.max(8, x - larg / 2), window.innerWidth - larg - 8);
    var py = y - alt - 12;
    if (py < 8) py = y + 18;
    el.style.left = px + 'px';
    el.style.top = py + 'px';
  }

  function esconderDica() {
    var el = document.getElementById('igTip');
    if (el) el.hidden = true;
    Array.prototype.forEach.call(document.querySelectorAll('.ig-cursor,.ig-ponto'), function (n) {
      n.hidden = true;
    });
  }

  function rastrear(e) {
    var wrap = e.target.closest ? e.target.closest('.ig-graf-wrap') : null;
    if (wrap) {
      var g = (st.igGrafs || {})[wrap.dataset.graf];
      if (!g || !g.pontos.length) return;
      var r = wrap.getBoundingClientRect();
      var frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      var i = Math.round(frac * (g.pontos.length - 1));
      var p = g.pontos[i];
      var v = p[g.campo];
      if (v === null || v === undefined) { esconderDica(); return; }

      /* O y do ponto é recalculado a partir da série, não lido do path: o SVG
         é esticado por preserveAspectRatio e as coordenadas dele não
         correspondem a pixels da tela. */
      var vals = g.pontos.map(function (q) { return q[g.campo]; })
                         .filter(function (q) { return q !== null && q !== undefined; });
      var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
      var span = (max - min) || 1;
      /* O respiro de cima e de baixo está em unidades do viewBox; converter
         para pixels exige a altura do próprio gráfico, não um número fixo —
         com 150 chumbado, o ponto saía do traço nos gráficos de outra altura. */
      var PB = g.PB * (r.height / g.H);
      var y = PB + (r.height - PB * 2) * (1 - (v - min) / span);
      var x = (i / (g.pontos.length - 1 || 1)) * r.width;

      var cur = wrap.querySelector('.ig-cursor'), pt = wrap.querySelector('.ig-ponto');
      if (cur) { cur.style.left = x + 'px'; cur.hidden = false; }
      if (pt) { pt.style.left = x + 'px'; pt.style.top = y + 'px'; pt.hidden = false; }

      mostrarDica('<b>' + numeroCurto(v) + '</b><span>' + esc(g.rotulo) + '</span>' +
                  '<i>' + esc(Club.fmtDate(p.dia)) + '</i>',
                  e.clientX, r.top + y);
      return;
    }

    var col = e.target.closest ? e.target.closest('.ig-col') : null;
    if (col) {
      var rc = col.getBoundingClientRect();
      mostrarDica('<b>' + esc(col.dataset.valor) + '</b><i>' + esc(col.dataset.dia) + '</i>',
                  rc.left + rc.width / 2, rc.top);
      return;
    }

    var stat = e.target.closest ? e.target.closest('.stat.tem-dica') : null;
    if (stat) {
      var rs = stat.getBoundingClientRect();
      mostrarDica('<span class="ig-tip-txt">' + esc(stat.dataset.dica) + '</span>',
                  rs.left + rs.width / 2, rs.top);
      return;
    }

    esconderDica();
  }

  function desenharDetalheIg(l, dias, todos) {
    var username = l.username;
    var corte = new Date(); corte.setDate(corte.getDate() - dias);
    var corte30 = new Date(); corte30.setDate(corte30.getDate() - 30);
    var serie = todos.filter(function (p) { return new Date(p.dia + 'T12:00') >= corte; });
    var serie30 = todos.filter(function (p) { return new Date(p.dia + 'T12:00') >= corte30; });

    var alc = serie.map(function (p) { return p.alcance_dia; })
                   .filter(function (v) { return v !== null && v !== undefined; });
    var media = alc.length ? Math.round(alc.reduce(function (a, b) { return a + b; }, 0) / alc.length) : null;
    var melhor = serie.filter(function (p) { return p.alcance_dia !== null; })
                      .sort(function (a, b) { return b.alcance_dia - a.alcance_dia; })[0];
    var ganhos30 = serie30.reduce(function (a, p) { return a + (p.seguidores_ganhos || 0); }, 0);
    var curva = curvaSeguidores(serie30, l.seguidores || 0);

    st.host.innerHTML =

        '<div class="ig-det">' +
          '<div class="ig-det-top">' +
            '<a class="ig-arroba" href="https://instagram.com/' + esc(username) + '" ' +
              'target="_blank" rel="noopener">@' + esc(username) + '</a>' +
            '<div class="seg ig-per" id="igPeriodo">' +
              [30, 90, 180].map(function (d) {
                return '<button data-igdias="' + d + '" aria-selected="' + (d === dias) + '">' +
                  d + ' dias</button>';
              }).join('') +
            '</div>' +
          '</div>' +

          '<div class="statgrid ig-det-stats">' +
            cardStat('SEGUIDORES', numeroCurto(l.seguidores), 'agora',
                     'Total de seguidores no último retrato. É o número que o próprio ' +
                     'Instagram mostra no perfil.') +
            cardStat('GANHOS EM 30 DIAS', (ganhos30 > 0 ? '+' : '') + numeroCurto(ganhos30),
                     'somando o que entrou por dia',
                     'Soma de quem seguiu a conta nos últimos 30 dias. O Instagram conta ' +
                     'quem chegou, não quem saiu — então isto é entrada bruta, não saldo.') +
            cardStat('ALCANCE MÉDIO/DIA', numeroCurto(media), 'nos últimos ' + dias + ' dias',
                     'Média de contas únicas que viram algum conteúdo por dia no período. ' +
                     'Diferente de visualizações: a mesma pessoa vendo três vezes conta uma.') +
            cardStat('MELHOR DIA', melhor ? numeroCurto(melhor.alcance_dia) : '—',
                     melhor ? Club.fmtDataCurta(melhor.dia) : 'sem série',
                     'O dia de maior alcance no período — em geral, o dia de um conteúdo ' +
                     'que rendeu. Vale abrir o perfil e ver o que foi publicado nesta data.') +
          '</div>' +

          '<div class="ig-bloco">' +
            '<div class="ig-bloco-h"><h3>Alcance por dia</h3>' +
            '<span class="tx-s">quantas contas viram seu conteudo naquele dia</span></div>' +
            grafico(serie, 'alcance_dia', 'var(--gold)', 170, 'contas alcançadas') +
          '</div>' +

          '<div class="ig-grid2">' +
            '<div class="ig-bloco">' +
              '<div class="ig-bloco-h"><h3>Seguidores que entraram</h3>' +
              '<span class="tx-s">por dia, últimos 30 — o teto que a API entrega</span></div>' +
              barras(serie30, 'seguidores_ganhos', 96) +
            '</div>' +
            '<div class="ig-bloco">' +
              '<div class="ig-bloco-h"><h3>Curva de seguidores</h3>' +
              '<span class="tx-s">reconstruída dos ganhos — estimativa, não medição</span></div>' +
              grafico(curva, 'seguidores', 'var(--info, #6aa9ff)', 96, 'seguidores no dia') +
            '</div>' +
          '</div>' +

          '<div class="ig-bloco">' +
            '<div class="ig-bloco-h"><h3>A semana que passou</h3>' +
            '<span class="tx-s">janela de 7 dias, do último retrato</span></div>' +
            '<div class="ig-semana">' +
              '<div><b>' + numeroCurto(l.visualizacoes) + '</b><span>visualizações</span></div>' +
              '<div><b>' + numeroCurto(l.alcance) + '</b><span>alcance</span></div>' +
              '<div><b>' + numeroCurto(l.interacoes) + '</b><span>interações</span></div>' +
              '<div><b>' + numeroCurto(l.visitas_perfil) + '</b><span>visitas ao perfil</span></div>' +
              '<div><b>' + numeroCurto(l.publicacoes) + '</b><span>publicações</span></div>' +
            '</div>' +
          '</div>' +
        '</div>'
;
  }

  C.instagramMember = {
    mount: function (host, member) {
      if (!host || !member || !member.id) return;
      var accounts = [], selected = null, history = [], days = 90, request = 0;
      host.innerHTML = '<p role="status">Carregando seus resultados do Instagram...</p>';
      function message(text, retry) {
        host.innerHTML = '<div class="ig-bloco"><p role="status">' + esc(text) + '</p>' +
          (retry ? '<button class="btn" data-ig-retry>Tentar novamente</button>' : '') + '</div>';
      }
      function draw() {
        esconderDica();
        st.igGrafs = {};
        host.innerHTML = '<div class="ig-det"><div id="igMemberAccount" class="pick" style="max-width:100%"></div>' +
          '<p class="tx-s" role="status">Ultima coleta: ' + esc(C.fmtDate(selected.dia)) + '</p>' +
          '<div data-ig-member-detail></div></div>';
        var accountHost = host.querySelector('#igMemberAccount');
        if (accounts.length > 1) {
          C.pick(accountHost, accounts.map(function (a) {
            return { value:a.username, label:'@' + a.username };
          }), selected.username, { titulo:'Sua conta', onPick: function (username) {
            loadAccount(accounts.filter(function (a) { return a.username === username; })[0]);
          } });
        } else accountHost.hidden = true;
        st.host = host.querySelector('[data-ig-member-detail]');
        desenharDetalheIg(selected, days, history);
      }
      function loadAccount(account) {
        if (!account) return;
        selected = account;
        var current = ++request;
        host.innerHTML = '<p role="status">Carregando o historico de @' + esc(account.username) + '...</p>';
        var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 180);
        C.sb.from('instagram_serie').select('*').eq('member_id', member.id)
          .eq('username', account.username).gte('dia', cutoff.toISOString().slice(0, 10))
          .order('dia').then(function (result) {
            if (current !== request) return;
            if (result.error) throw result.error;
            history = result.data || [];
            draw();
          }).catch(function () {
            if (current === request) message('Nao foi possivel carregar seu historico agora.', true);
          });
      }
      function load() {
        C.sb.from('instagram_resumo').select('*').eq('member_id', member.id)
          .order('username').then(function (result) {
            if (result.error) throw result.error;
            accounts = result.data || [];
            if (!accounts.length) {
              message('Seus resultados aparecerao aqui assim que sua conta estiver vinculada e a primeira coleta for concluida.');
              return;
            }
            loadAccount(accounts[0]);
          }).catch(function () {
            message('Nao foi possivel carregar seus resultados do Instagram agora.', true);
          });
      }
      host.onclick = function (event) {
        if (event.target.closest('[data-ig-retry]')) { load(); return; }
        var period = event.target.closest('[data-igdias]');
        if (!period || !selected) return;
        days = Number(period.dataset.igdias);
        if ([30, 90, 180].indexOf(days) !== -1) draw();
      };
      host.addEventListener('mousemove', rastrear);
      host.addEventListener('mouseleave', esconderDica);
      host.addEventListener('touchstart', function (event) {
        if (event.touches.length) rastrear({target:event.target, clientX:event.touches[0].clientX});
      }, { passive:true });
      window.addEventListener('scroll', esconderDica, true);
      load();
    }
  };
})();
