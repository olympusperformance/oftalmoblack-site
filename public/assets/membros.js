/* ============================================================================
   Club OftalmoBlack — área do mentorado

   Mesma interface do protótipo, agora alimentada pelo que o admin cadastrou.
   Um administrador logado pode abrir esta página para conferir como a área
   está para cada mentorado (?membro=<id>).
   ========================================================================= */
(function () {
  'use strict';

  var sessao = null;
  var admin = false;
  var esc = Club.esc, ico = Club.icon;
  var $ = function (id) { return document.getElementById(id); };

  var st = { membro:null, events:[], artifacts:[], materials:[],
             steps:[], progress:[], groups:[], igResumo:[], igSerie:[],
             baseLoading:true, igLoading:true, matCategoria:'' };

  var NAV = [
    { key:'farol',     label:'Farol',     icon:'eye' },
    { key:'home',      label:'Início',    icon:'home' },
    { key:'graduacao', label:'Graduação', icon:'award' },
    { key:'instagram', label:'Instagram', icon:'eye' },
    { key:'artifacts', label:'Artefatos', icon:'box' },
    { key:'materials', label:'Materiais', icon:'folder' },
    { key:'agenda',    label:'Agenda',    icon:'calendar' },
    { key:'cerebro',   label:'Cérebro',   icon:'brain' },
    { key:'profile',   label:'Perfil',    icon:'user' }
  ];

  /* ── de quem é a área ─────────────────────────────────────────────────── */

  function alvo() {
    /* O mentorado já vem resolvido na sessão — o RLS garante que members só
       devolve a linha dele mesmo. Uma consulta a menos. */
    if (!admin) {
      if (!sessao.member) {
        /* Login existe no Auth mas ninguém o ligou a um cadastro de mentorado. */
        return Promise.reject(new Error(
          'Seu login ainda não está ligado a um cadastro de mentorado. Fale com a equipe.'));
      }
      return Promise.resolve(sessao.member);
    }

    var pedido = new URLSearchParams(location.search).get('membro');
    if (pedido && /^[0-9a-f-]{36}$/i.test(pedido)) return Club.data.members.get(pedido);
    return Club.data.members.list().then(function (todos) { return todos[0] || null; });
  }

  function carregar() {
    return alvo().then(function (m) {
      if (!m) throw new Error('Nenhum membro cadastrado ainda.');
      st.membro = m;
      var inicial = location.hash.slice(1);
      if (!inicial || inicial.indexOf('farol/') === 0 || inicial === 'farol') {
        renderIdentidade();
        renderNav('farol');
        montarFarol();
        Club.farol.enter(location.hash.indexOf('#farol/') === 0 ? location.hash : '');
      }
      Promise.all([Club.data.instagram.resumo(), Club.data.instagram.serie(45)]).then(function (r) {
        st.igResumo = r[0]; st.igSerie = r[1];
      }).catch(function () {
        st.igResumo = []; st.igSerie = [];
      }).then(function () {
        st.igLoading = false;
        if (farolMontado) Club.farol.refresh();
      });
      return Promise.all([
        Club.data.events.list({ memberId: m.id }),
        Club.data.artifacts.list({ memberId: m.id }),
        Club.data.materials.list({ memberId: m.id }),
        Club.data.steps.list(),
        Club.data.progress.list({ memberId: m.id }),
        /* Áreas da jornada, para agrupar os cartões. O RLS só entrega as que
           não são da equipe (supabase/areas.sql). */
        Club.data.groups.list()
      ]);
    }).then(function (r) {
      st.events = r[0]; st.artifacts = r[1]; st.materials = r[2];
      st.steps = r[3]; st.progress = r[4]; st.groups = r[5] || [];
      st.baseLoading = false;
      if (farolMontado) Club.farol.refresh();
    });
  }

  /* ── cabeçalho ────────────────────────────────────────────────────────── */

  /* O grupo de Operação é onde a mentoria acontece no dia a dia; a área é o
     lugar de onde ele chega lá sem procurar conversa antiga no WhatsApp. */
  /* ── chat do Cérebro ──────────────────────────────────────────────────── */
  /* O histórico que o modelo recebe vem dele mesmo (a função devolve a versão
     que ela quer na próxima volta); a lista de bolhas é só o que a pessoa vê.
     Guardar os dois separados evita reconstruir uma coisa a partir da outra. */
  var chat = { falas: [], historico: [], pensando: false };

  /* O modelo responde em markdown — título, negrito, lista. Aqui vira HTML de
     verdade, mas só depois de escapar: o texto vem de fora e nada dele pode
     virar marcação por conta própria. Só três formas são reconhecidas, que são
     as que ele usa; o resto continua texto. */
  function formatar(txt) {
    var html = '', lista = false;
    esc(txt).split('\n').forEach(function (linha) {
      /* Negrito primeiro: se o itálico rodasse antes, comeria um dos dois
         asteriscos de **texto** e deixaria o outro na tela. */
      var l = linha.trim()
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
        .replace(/`([^`\n]+?)`/g, '<code>$1</code>');
      var item = l.match(/^[-–•]\s+(.*)$/);
      var cab  = l.match(/^#{1,4}\s+(.*)$/);

      if (item) {
        if (!lista) { html += '<ul>'; lista = true; }
        html += '<li>' + item[1] + '</li>';
        return;
      }
      if (lista) { html += '</ul>'; lista = false; }
      if (cab) { html += '<h4>' + cab[1] + '</h4>'; return; }
      if (l) html += '<p>' + l + '</p>';
    });
    if (lista) html += '</ul>';
    return html || '<p>' + esc(txt) + '</p>';
  }

  function bolha(quem, texto) {
    /* A fala de quem pergunta é texto puro: markdown ali seria ruído. */
    return '<div class="fala ' + quem + '">' +
      (quem === 'ele' ? '<span class="fala-de">CÉREBRO</span>' : '') +
      '<div class="fala-tx">' +
      (quem === 'eu' ? esc(texto) : formatar(texto)) + '</div></div>';
  }

  function renderChat() {
    var fluxo = $('chatFluxo');
    if (!chat.falas.length && !chat.pensando) {
      fluxo.innerHTML =
        '<div class="chat-vazio">' + ico('search') +
        '<p>O Cérebro guarda o que foi conversado no seu grupo de Operação e os números da sua clínica.</p>' +
        '<div class="chat-ideias">' +
          ['O que ficou combinado na última conversa?',
           'Quantos leads entraram nos últimos 30 dias?',
           'O que a equipe me pediu e eu não respondi?'].map(function (q) {
            return '<button class="chat-ideia" data-pergunta="' + esc(q) + '">' + esc(q) + '</button>';
          }).join('') +
        '</div></div>';
      return;
    }
    fluxo.innerHTML = chat.falas.map(function (f) { return bolha(f.quem, f.texto); }).join('') +
      (chat.pensando ? '<div class="fala ele"><span class="fala-de">CÉREBRO</span>' +
        '<div class="fala-tx pensando"><span class="pulso"><i></i><i></i><i></i></span>' +
        'procurando nas conversas</div></div>' : '');
    fluxo.scrollTop = fluxo.scrollHeight;
  }

  function perguntar(texto) {
    texto = (texto || '').trim();
    if (!texto || chat.pensando) return;
    chat.falas.push({ quem:'eu', texto:texto });
    chat.pensando = true;
    $('chatInput').value = '';
    $('chatInput').disabled = true;
    renderChat();

    Club.data.cerebro.perguntar(texto, chat.historico, admin ? st.membro.id : undefined).then(function (d) {
      chat.historico = d.historico || [];
      chat.falas.push({ quem:'ele', texto:d.resposta || 'Não achei nada sobre isso.' });
    }).catch(function (err) {
      /* O erro entra como fala do Cérebro: um toast desapareceria e a pessoa
         ficaria olhando a pergunta sem resposta, sem saber por quê. */
      chat.falas.push({ quem:'ele erro', texto: err.message || 'Não consegui responder agora.' });
    }).then(function () {
      chat.pensando = false;
      $('chatInput').disabled = false;
      renderChat();
      $('chatInput').focus();
    });
  }

  function renderGrupo() {
    var a = $('btnGrupo');
    var url = (st.membro && st.membro.whatsapp_url || '').trim();
    if (!url) { a.hidden = true; return; }
    a.href = url;
    a.hidden = false;
  }

  function renderIdentidade() {
    var m = st.membro;
    $('quemNome').textContent = m.nome;
    $('quemTier').textContent = 'MENTORADO ' + (m.tier || 'BLACK');
    $('avatar').textContent = m.iniciais || Club.initials(m.nome);
    /* Mentorado sem turma ou fase é caso comum (o cadastro entra antes da
       matrícula na turma), então o rótulo se adapta em vez de escrever null. */
    $('turmaFase').textContent = [m.turma, m.fase].filter(Boolean).join(' · ') || 'Mentoria';
    $('greeting').innerHTML = Club.greeting() + ', <b>' +
      esc(m.nome.replace(/^(Dr|Dra)\.?\s+/i, '').split(' ')[0]) + '</b>';
    document.title = 'Cérebro Black — ' + m.nome;
  }

  /* Quando é o admin espiando, deixar isso explícito e dar como trocar de membro. */
  function renderAvisoAdmin() {
    if (!admin) return;
    Club.data.members.list().then(function (todos) {
      var barra = document.createElement('div');
      barra.className = 'notice';
      barra.style.margin = '0 0 22px';
      barra.innerHTML = ico('eye') +
        '<div style="flex:1 1 220px"><b>Pré-visualização.</b> Você está vendo a área como ' +
        esc(st.membro.nome) + '.</div>' +
        '<div class="pick pick-sm" id="trocaMembro" style="max-width:230px"></div>' +
        '<a class="btn btn-sm" href="/admin/">' + ico('arrow-left') + 'Painel</a>';

      var main = document.querySelector('.main');
      main.insertBefore(barra, main.firstChild);
      /* Depois de estar no DOM: o seletor mede o próprio botão para alinhar a
         lista, e fora da página a medida sai zero. */
      Club.pick('trocaMembro', todos.map(function (m) {
        return { value: m.id, label: m.nome };
      }), st.membro.id, {
        titulo: 'Ver a área de',
        onPick: function (v) { location.search = '?membro=' + v; }
      });
    });
  }

  /* ── artefatos ────────────────────────────────────────────────────────── */

  /* O checklist é o mesmo que a administração acompanha no painel: as etapas
     são do artefato, o que está marcado é deste mentorado. */
  function etapasDe(artifactId) {
    return st.steps.filter(function (e) { return e.artifact_id === artifactId; });
  }

  function feita(stepId) {
    return st.progress.some(function (p) { return p.step_id === stepId && p.feito; });
  }

  /* Mesma régua do painel (Club.par): aceite e rotina fora da barra, opcional
     só quando marcada. O mentorado vê o que falta da implantação, e depois dos
     100% vê a rotina como acompanhamento, não como pendência. */
  function parDe(a) { return Club.par(etapasDe(a.id), feita); }

  function artefatosFarol() {
    return st.artifacts.filter(function (a) { return a.tipo !== 'interna'; }).map(function (a) {
      return { artifact:a, part:parDe(a), steps:etapasDe(a.id).map(function (e) {
        return Object.assign({}, e, { feito:feita(e.id) });
      }), demands:[] };
    });
  }

  function entregasFarol() {
    var r = { feitas:0, total:0, aceitos:0, definir:0, travados:0, equipe:0, noar:0, pcts:[], pct:0 };
    artefatosFarol().forEach(function (a) {
      var p = a.part;
      if (p.estado === 'definir') { r.definir++; return; }
      r.aceitos++; r.feitas += p.feitas; r.total += p.total;
      if (p.estado === 'travado') r.travados++;
      else if (Club.NO_AR[p.estado]) r.noar++;
      else r.equipe++;
      if (p.total || p.rotinas.length) r.pcts.push(p.completo ? 100 : p.pct);
    });
    r.pct = r.pcts.length ? Math.round(r.pcts.reduce(function (sum, pct) { return sum + pct; }, 0) / r.pcts.length) : 0;
    return r;
  }

  var farolMontado = false;
  function montarFarol() {
    if (farolMontado) return;
    farolMontado = true;
    Club.farol.mount($('farolMembro'), {
      memberMode:true,
      members:function () { return [st.membro]; },
      session:function () { return sessao; },
      instagram:function () { return { resumo:st.igResumo, serie:st.igSerie, loading:st.igLoading, indisponivel:Club.instagramIndisponivel }; },
      deliveriesLoading:function () { return st.baseLoading; },
      entregas:entregasFarol,
      artefatos:artefatosFarol,
      demandas:function () { return []; },
      abrirInstagram:function () { go('instagram'); },
      abrirProgressao:function () { go('artifacts'); },
      abrirDemandas:function () {}
    });
  }

  function checklist(a, detalhado) {
    var etapas = Club.ordenaEtapas(etapasDe(a.id));
    if (!etapas.length) return '';
    var r = parDe(a);
    var pct = r.total ? r.pct : (r.completo ? 100 : 0);

    var barra = '<div class="art-ck">' +
      '<span class="track"><span class="fill" style="width:' + pct + '%"></span></span>' +
      '<span class="n">' + r.feitas + '/' + r.total + '</span></div>';

    if (!detalhado) return barra;

    var itens = etapas.filter(function (e) {
      var t = Club.tipoEtapa(e);
      if (t === 'aceite') return false;
      if (t === 'opcional' && !feita(e.id)) return false;
      /* A rotina só aparece depois da implantação: antes disso não é pendência dele. */
      if (t === 'rotina' && !r.completo) return false;
      return true;
    }).map(function (e) {
      var ok = feita(e.id), t = Club.tipoEtapa(e);
      var icone = t === 'rotina' ? 'refresh' : ok ? 'check-circle' : 'clock';
      var sufixo = t === 'rotina'
        ? ' · ' + Club.cadenciaRotulo(e.cadencia_dias).toLowerCase()
        : (t === 'trava' && !ok ? ' · esperando você' : '');
      return '<li' + (ok || t === 'rotina' ? ' class="ok"' : '') + '>' +
        ico(icone) + '<span>' + esc(e.titulo + sufixo) + '</span></li>';
    });

    return barra + '<ul class="art-st-list">' + itens.join('') + '</ul>';
  }

  function cartaoArtefato(a, detalhado) {
    var s = Club.ART_ST[a.status] || Club.ART_ST['Bloqueado'];
    var locked = a.status === 'Bloqueado';
    var r = parDe(a);
    /* O chip diz o que importa pra ele: entregue, ativo com acompanhamento, ou
       esperando algo dele. Atraso e nota nunca chegam aqui. */
    var chip = r.estado === 'ativo'
      ? { color:'var(--success)', icon:'refresh',
          label:'Ativo · acompanhamento ' + (r.cadencia ? Club.cadenciaRotulo(r.cadencia).toLowerCase() : 'contínuo') }
      : r.estado === 'entregue' ? { color:'var(--success)', icon:'check-circle', label:'Entregue' }
      : r.estado === 'travado'  ? { color:'var(--orange)',  icon:'clock', label:'Esperando você' }
      : { color:s.color, icon:s.icon, label:a.status };
    var corpo =
      '<div class="art-i">' + ico(a.icone || 'box') + '</div>' +
      '<p class="art-n">' + esc(a.nome) + '</p>' +
      '<p class="art-s">' + esc(a.subtitulo) + '</p>' +
      checklist(a, detalhado) +
      '<div class="art-st" style="color:' + chip.color + '">' + ico(chip.icon) + esc(chip.label) + '</div>' +
      '<p class="art-m">' + esc(a.meta) + '</p>';

    /* Só vira link quando há para onde ir e o artefato não está bloqueado. */
    return (a.url && !locked)
      ? '<a class="art" href="' + esc(a.url) + '" style="text-decoration:none;color:inherit">' +
        corpo + '</a>'
      : '<div class="art' + (locked ? ' locked' : '') + '">' + corpo + '</div>';
  }

  /* ── artefatos por área ───────────────────────────────────────────────── */
  /* Uma seção por área, na ordem das áreas; artefato sem área vai por último.
     Frente interna (tipo 'interna') nunca chega aqui: o RLS a segura, e o
     filtro repete a regra por garantia. Área sem artefato visível não vira
     seção vazia. */
  function agruparPorArea(artefatos, grupos) {
    var porNome = function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); };
    var visiveis = artefatos.filter(function (a) { return a.tipo !== 'interna'; });
    var secoes = grupos.slice()
      .sort(function (a, b) { return ((a.ordem || 0) - (b.ordem || 0)) || porNome(a, b); })
      .map(function (g) {
        return { grupo:g, itens: visiveis
          .filter(function (a) { return a.group_id === g.id; })
          .sort(function (a, b) { return ((a.ordem || 0) - (b.ordem || 0)) || porNome(a, b); }) };
      });
    var soltos = visiveis.filter(function (a) {
      return !grupos.some(function (g) { return g.id === a.group_id; });
    }).sort(porNome);
    if (soltos.length) secoes.push({ grupo:null, itens:soltos });
    return secoes.filter(function (s) { return s.itens.length; });
  }

  function renderArtifacts() {
    var vazio = Club.empty('box', 'Nenhum artefato liberado ainda.');
    /* Disponibilidade independe de progresso: um artefato liberado aparece
       mesmo sem aceite ou etapas marcadas para este mentorado. Frente interna
       é da equipe e nunca aparece. */
    var meus = st.artifacts.filter(function (a) {
      return a.tipo !== 'interna' &&
        (a.status === 'Disponível' || !etapasDe(a.id).length || parDe(a).estado !== 'definir');
    });
    var secoes = agruparPorArea(meus, st.groups);
    var ordenados = secoes.reduce(function (acc, s) { return acc.concat(s.itens); }, []);

    /* Na capa cabe uma grade só, na ordem das áreas; na aba cheia, uma seção
       por área com o checklist inteiro. */
    $('artList').innerHTML = ordenados.length
      ? ordenados.map(function (a) { return cartaoArtefato(a, false); }).join('') : vazio;
    $('artListFull').innerHTML = secoes.length
      ? secoes.map(function (s) {
          return '<section class="art-area">' +
            '<div class="sec"><div class="sec-g">' +
              '<div class="sec-eb"><span class="sec-dash"></span><span>ÁREA</span></div>' +
              '<h2 class="sec-t">' + esc(s.grupo ? s.grupo.nome : 'Outros') + '</h2>' +
            '</div></div>' +
            '<div class="artgrid">' +
              s.itens.map(function (a) { return cartaoArtefato(a, true); }).join('') +
            '</div>' +
          '</section>';
        }).join('')
      : vazio;
    return ordenados.filter(function (a) { return a.status === 'Disponível'; }).length;
  }

  /* ── agenda ───────────────────────────────────────────────────────────── */

  function cartaoAula(e, proxima) {
    var p = Club.dateParts(e.inicia_em);
    var corpo =
      '<div class="les-d"><div class="les-day">' + esc(p.day) + '</div>' +
        '<div class="les-mo">' + esc(p.month) + '</div></div>' +
      '<div class="les-v"></div>' +
      '<div class="les-b">' +
        (proxima ? '<div class="livebadge"><span class="livedot"></span><span>PRÓXIMA</span></div>' : '') +
        '<p class="les-t">' + esc(e.titulo) + '</p>' +
        '<p class="les-m">com ' + esc(e.mentor || 'Equipe Black') + '</p>' +
        '<div class="les-meta">' + ico('calendar') + esc(p.weekday) + ', ' + esc(p.time) +
          '<span class="les-sep"></span>' +
          ico(e.formato === 'Gravada' ? 'play' : 'video') + esc(e.formato) +
        '</div>' +
      '</div>' +
      '<span class="les-c">' + ico('chevron-right') + '</span>';

    return e.link
      ? '<a class="lesson' + (proxima ? ' live' : '') + '" href="' + esc(e.link) +
        '" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">' + corpo + '</a>'
      : '<div class="lesson' + (proxima ? ' live' : '') + '">' + corpo + '</div>';
  }

  function renderAgenda() {
    var agora = new Date();
    var futuros = st.events.filter(function (e) { return Club.parseDate(e.inicia_em) >= agora; });
    var passados = st.events.filter(function (e) { return Club.parseDate(e.inicia_em) < agora; });

    function lista(arr) {
      return arr.map(function (e, i) {
        return cartaoAula(e, arr === futuros && i === 0);
      }).join('');
    }

    $('lessonList').innerHTML = futuros.length
      ? lista(futuros.slice(0, 3))
      : Club.empty('calendar', 'Nada agendado no momento.');

    $('agendaFull').innerHTML = (futuros.length ? lista(futuros) : '') +
      (passados.length
        ? '<div class="sec" style="margin-top:30px"><div class="sec-g">' +
          '<div class="sec-eb"><span class="sec-dash"></span><span>JÁ ACONTECEU</span></div>' +
          '<h2 class="sec-t">Encontros anteriores</h2></div></div>' +
          '<div style="opacity:.55">' + lista(passados) + '</div>'
        : '') ||
      Club.empty('calendar', 'Sua agenda ainda está vazia.');

    return futuros[0] || null;
  }

  /* ── materiais ────────────────────────────────────────────────────────── */

  function cartaoMaterial(m) {
    return '<button class="row" data-baixar="' + m.id + '" ' +
      'style="width:100%;text-align:left;border:1px solid var(--border-soft);cursor:pointer">' +
      '<div class="art-i" style="flex-shrink:0;margin:0">' +
        ico(Club.MAT_ICONE[m.categoria] || 'file-text') + '</div>' +
      '<div class="row-b">' +
        '<div class="row-t">' + esc(m.titulo) + '</div>' +
        (m.descricao ? '<div class="row-s">' + esc(m.descricao) + '</div>' : '') +
        '<div class="row-meta">' +
          '<span>' + esc(Club.fmtExt(m.arquivo_nome)) + ' · ' +
            esc(Club.fmtBytes(m.arquivo_bytes)) + '</span>' +
          '<span>' + ico('calendar') + esc(Club.fmtDataCurta(m.publicado_em)) + '</span>' +
        '</div>' +
      '</div>' +
      '<span class="les-c" style="color:var(--gold)">' + ico('download') + '</span>' +
    '</button>';
  }

  function renderMateriais() {
    Club.pick('filtroCategoriaMat', Club.MAT_CATEGORIAS, st.matCategoria, {
      vazio: 'Todas as categorias',
      titulo: 'Categoria',
      onPick: function (v) { st.matCategoria = v; renderMateriais(); }
    });

    var rows = st.matCategoria
      ? st.materials.filter(function (m) { return m.categoria === st.matCategoria; })
      : st.materials;

    if (!rows.length) {
      $('listaMateriais').innerHTML = Club.empty('folder', st.matCategoria
        ? 'Nada nesta categoria por enquanto.'
        : 'Seu acervo ainda está vazio. Os materiais aparecem aqui conforme o Club entrega.');
      return;
    }

    /* Agrupado por categoria, mais novo primeiro dentro de cada uma — a lista
       cresce sem parar e uma pilha única fica impossível de varrer. */
    var grupos = {};
    rows.forEach(function (m) {
      (grupos[m.categoria] = grupos[m.categoria] || []).push(m);
    });

    $('listaMateriais').innerHTML = Club.MAT_CATEGORIAS
      .filter(function (c) { return grupos[c]; })
      .map(function (c) {
        return '<div class="sec" style="margin-top:26px"><div class="sec-g">' +
            '<div class="sec-eb"><span class="sec-dash"></span><span>' +
              esc(String(grupos[c].length) + (grupos[c].length === 1 ? ' ITEM' : ' ITENS')) +
            '</span></div>' +
            '<h2 class="sec-t">' + esc(c) + '</h2></div></div>' +
          grupos[c].map(cartaoMaterial).join('');
      }).join('');
  }

  function baixar(id) {
    var m = st.materials.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    Club.toast('Baixando…', 'download');
    Club.data.materials.baixar(m.arquivo_path, m.arquivo_nome).catch(function (err) {
      Club.toast(err.message || 'Não foi possível abrir o arquivo.', 'alert');
    });
  }

  /* ── perfil ───────────────────────────────────────────────────────────── */

  function renderPerfil() {
    var m = st.membro;
    /* Alguns valores são endereço, não texto: aqui vale poder clicar. */
    function linhaLink(k, url, rotulo) {
      if (!url) return linha(k, null);
      return '<div style="display:flex;justify-content:space-between;gap:18px;padding:13px 0;' +
        'border-bottom:1px solid var(--border-soft)">' +
        '<span style="color:var(--faint);font-size:12.5px;letter-spacing:.4px">' + esc(k) + '</span>' +
        '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" ' +
        'style="font-size:14px;text-align:right;color:var(--gold)">' + esc(rotulo) + '</a></div>';
    }
    function linha(k, v) {
      return '<div style="display:flex;justify-content:space-between;gap:18px;padding:13px 0;' +
        'border-bottom:1px solid var(--border-soft)">' +
        '<span style="color:var(--faint);font-size:12.5px;letter-spacing:.4px">' + esc(k) + '</span>' +
        '<span style="font-size:14px;text-align:right">' + esc(v || '—') + '</span></div>';
    }
    $('perfil').innerHTML =
      '<div class="card" style="max-width:560px">' +
        '<div style="display:flex;align-items:center;gap:15px;margin-bottom:18px">' +
          '<span class="avatar" style="width:52px;height:52px;border-radius:26px;font-size:16px">' +
            esc(m.iniciais || Club.initials(m.nome)) + '</span>' +
          '<div><div style="font-family:var(--display);font-size:20px;font-weight:600">' +
            esc(m.nome) + '</div>' +
          '<div style="color:var(--muted);font-size:13px;margin-top:3px">' + esc(m.email) + '</div></div>' +
        '</div>' +
        linha('Turma', m.turma) +
        linha('Fase', m.fase) +
        linha('Tier', m.tier) +
        linha('Instagram', m.instagram) +
        linhaLink('Grupo de Operação', m.whatsapp_url, 'abrir no WhatsApp') +
        linha('No Club desde', Club.fmtMesAno(String(m.criado_em || '').slice(0, 10))) +
        '<button class="btn btn-danger btn-block" id="sair" style="margin-top:20px">' +
          ico('log-out') + 'Sair da área</button>' +
      '</div>';
  }

  /* ── resumo da semana ─────────────────────────────────────────────────── */


  /* ── navegação ────────────────────────────────────────────────────────── */

  function renderNav(ativo) {
    var m = st.membro;
    $('rail').innerHTML =
      '<div class="rail-lbl">MENTORIA</div>' +
      NAV.map(function (n) {
        return '<button class="nav" role="tab" data-nav="' + n.key + '" aria-selected="' +
          (n.key === ativo) + '">' + ico(n.icon) + '<span>' + n.label + '</span></button>';
      }).join('') +
      '<div class="rail-foot"><div class="k">' +
      esc(([m.turma, m.fase].filter(Boolean).join(' · ') || 'Mentoria').toUpperCase()) + '</div>' +
      '<div class="v">Mentorado ' + esc(m.tier || 'Black') + ' desde ' +
      esc(Club.fmtMesAno(String(m.criado_em || '').slice(0, 10))) + '.</div></div>';

    $('navm').innerHTML = NAV.map(function (n) {
      return '<button class="chip" role="tab" data-nav="' + n.key + '" aria-selected="' +
        (n.key === ativo) + '">' + ico(n.icon) + n.label + '</button>';
    }).join('');
  }

  function go(key) {
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (v) {
      v.hidden = v.dataset.view !== key;
    });
    renderNav(key);
    if (key === 'farol') {
      montarFarol();
      Club.farol.enter(location.hash.indexOf('#farol/') === 0 ? location.hash : '');
    } else if (location.hash.indexOf('#farol/') === 0) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ── render geral ─────────────────────────────────────────────────────── */

  /* O campo do Início não tem conversa própria: manda a pergunta para a aba
     Cérebro, onde o fio já é guardado. Dois campos, uma conversa. */
  $('ceForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var texto = $('ceInput').value;
    if (!texto.trim()) return;
    $('ceInput').value = '';
    go('cerebro');
    perguntar(texto);
  });

  $('chatForm').addEventListener('submit', function (e) {
    e.preventDefault();
    perguntar($('chatInput').value);
  });

  $('chatFluxo').addEventListener('click', function (e) {
    var ideia = e.target.closest('[data-pergunta]');
    if (ideia) perguntar(ideia.dataset.pergunta);
  });

  function render() {
    renderIdentidade();
    renderGrupo();
    renderChat();
    var disponiveis = renderArtifacts();
    var proxima = renderAgenda();
    renderMateriais();
    renderPerfil();
    Club.graduacao.mountMember($('graduacaoMembro'), st.membro);
    Club.instagramMember.mount($('instagramMembro'), st.membro);
  }

  /* ── eventos ──────────────────────────────────────────────────────────── */

  document.addEventListener('click', function (e) {
    /* Dois lugares, um comportamento: o do cabeçalho está sempre à mão, o do
       Perfil é o que se procura quando se vai "mexer na conta". */
    if (e.target.closest('#sair, [data-sair]')) { Club.auth.logout(); return; }

    var nav = e.target.closest('[data-nav]');
    if (nav) { go(nav.dataset.nav); return; }

    var down = e.target.closest('[data-baixar]');
    if (down) { baixar(down.dataset.baixar); return; }

  });

  /* ── partida ──────────────────────────────────────────────────────────── */

  Club.auth.require().then(function (s) {
    if (!s) return;                 // a guarda já redirecionou
    sessao = s;
    admin = s.role === 'admin';
    return carregar().then(function () {
      render();
      renderAvisoAdmin();
      var alvoInicial = location.hash.slice(1);
      go(alvoInicial.indexOf('farol/') === 0 ? 'farol' : NAV.some(function (n) { return n.key === alvoInicial; }) ? alvoInicial : 'farol');
    });
  }).catch(function (err) {
    document.querySelector('.main').innerHTML =
      '<div class="placeholder">' + ico('alert') + '<h2>Não foi possível abrir sua área</h2>' +
      '<p>' + esc(err.message) + '</p>' +
      '<button class="btn" id="sair" style="margin-top:18px">Sair</button></div>';
  });

  window.addEventListener('hashchange', function () {
    if (!sessao) return;
    var h = location.hash.slice(1);
    if (h.indexOf('farol/') === 0) { go('farol'); return; }
    if (NAV.some(function (n) { return n.key === h; })) go(h);
  });
})();
