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

  var st = { membro:null, tasks:[], events:[], artifacts:[], materials:[],
             steps:[], progress:[],
             status:'pending', categoria:'', matCategoria:'' };

  var NAV = [
    { key:'home',      label:'Início',    icon:'home' },
    { key:'tasks',     label:'Tarefas',   icon:'check-square' },
    { key:'artifacts', label:'Artefatos', icon:'box' },
    { key:'materials', label:'Materiais', icon:'folder' },
    { key:'agenda',    label:'Agenda',    icon:'calendar' },
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

    return Club.data.members.list().then(function (todos) {
      var pedido = new URLSearchParams(location.search).get('membro');
      return todos.filter(function (m) { return m.id === pedido; })[0] || todos[0] || null;
    });
  }

  function carregar() {
    return alvo().then(function (m) {
      if (!m) throw new Error('Nenhum membro cadastrado ainda.');
      st.membro = m;
      return Promise.all([
        Club.data.tasks.list({ memberId: m.id }),
        Club.data.events.list({ memberId: m.id }),
        Club.data.artifacts.list({ memberId: m.id }),
        Club.data.materials.list({ memberId: m.id }),
        Club.data.steps.list(),
        Club.data.progress.list({ memberId: m.id })
      ]);
    }).then(function (r) {
      st.tasks = r[0]; st.events = r[1]; st.artifacts = r[2]; st.materials = r[3];
      st.steps = r[4]; st.progress = r[5];
    });
  }

  /* ── cabeçalho ────────────────────────────────────────────────────────── */

  /* O grupo de Operação é onde a mentoria acontece no dia a dia; a área é o
     lugar de onde ele chega lá sem procurar conversa antiga no WhatsApp. */
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
    $('turmaFase').textContent = m.turma + ' · ' + m.fase;
    $('tierNome').textContent = m.tier || 'BLACK';
    $('greeting').innerHTML = Club.greeting() + ', <b>' +
      esc(m.nome.replace(/^(Dr|Dra)\.?\s+/i, '').split(' ')[0]) + '</b>';
    document.title = 'Área do Mentorado — ' + m.nome;
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
        '<select class="inp" id="trocaMembro" style="max-width:230px;font-size:12.5px;padding:7px 10px">' +
        todos.map(function (m) {
          return '<option value="' + esc(m.id) + '"' +
            (m.id === st.membro.id ? ' selected' : '') + '>' + esc(m.nome) + '</option>';
        }).join('') + '</select>' +
        '<a class="btn btn-sm" href="/admin/">' + ico('arrow-left') + 'Painel</a>';

      var main = document.querySelector('.main');
      main.insertBefore(barra, main.firstChild);
      $('trocaMembro').addEventListener('change', function () {
        location.search = '?membro=' + this.value;
      });
    });
  }

  /* ── tarefas ──────────────────────────────────────────────────────────── */

  function cartaoTarefa(t) {
    var done = t.status === 'done';
    var tint = Club.TINT[t.categoria] || 'var(--muted)';
    var prog = '';
    if (t.progresso_total > 0) {
      var w = Math.min(100, (t.progresso_atual / t.progresso_total) * 100);
      prog = '<span class="task-p"><span class="track"><span class="fill" style="width:' + w +
        '%"></span></span><span class="n">' + t.progresso_atual + '/' + t.progresso_total + '</span></span>';
    }
    return '<button class="task' + (done ? ' done' : '') + '" data-id="' + t.id +
      '" aria-pressed="' + done + '">' +
      '<span class="task-in">' +
        '<span class="check">' + ico('check') + '</span>' +
        '<span class="task-b">' +
          '<span class="tagrow">' +
            '<span class="tag" style="color:' + tint + ';border-color:' + tint +
              '55;background:' + tint + '14"><span class="dot"></span>' + esc(t.categoria) + '</span>' +
            '<span class="cad">' + esc(t.cadencia) + '</span>' +
          '</span>' +
          '<span class="task-t" style="display:block">' + esc(t.titulo) + '</span>' +
          '<span class="task-d" style="display:block">' + esc(t.descricao) + '</span>' +
          prog +
          '<span class="task-f">' +
            '<span class="f-open"' + (Club.isLate(t) ? ' style="color:#F08A8A"' : '') + '>' +
              ico('clock') + esc(Club.fmtDue(t.vence_em)) + '</span>' +
            '<span class="f-done">' + ico('check-circle') + 'Concluída</span>' +
          '</span>' +
        '</span>' +
      '</span></button>';
  }

  function renderTasks() {
    var abertas = st.tasks.filter(function (t) { return t.status !== 'done'; });
    $('taskList').innerHTML = st.tasks.length
      ? st.tasks.slice(0, 4).map(cartaoTarefa).join('')
      : Club.empty('check-square', 'Nenhuma tarefa por enquanto. Aproveite.');

    var cats = ['Todas as categorias'].concat(Club.CATEGORIAS);
    $('filtroCategoria').innerHTML = cats.map(function (c, i) {
      var v = i === 0 ? '' : c;
      return '<option value="' + esc(v) + '"' + (v === st.categoria ? ' selected' : '') +
        '>' + esc(c) + '</option>';
    }).join('');

    Array.prototype.forEach.call($('filtroStatus').children, function (b) {
      b.setAttribute('aria-selected', String(b.dataset.st === st.status));
    });

    var rows = st.tasks.filter(function (t) {
      if (st.categoria && t.categoria !== st.categoria) return false;
      if (st.status === 'pending') return t.status !== 'done';
      if (st.status === 'done') return t.status === 'done';
      return true;
    });

    $('taskListFull').innerHTML = rows.length
      ? rows.map(cartaoTarefa).join('')
      : Club.empty('check-square', st.status === 'done'
          ? 'Você ainda não concluiu nenhuma tarefa com este filtro.'
          : 'Nada em aberto com este filtro.');

    return abertas;
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

  function checklist(a, detalhado) {
    var etapas = etapasDe(a.id);
    if (!etapas.length) return '';
    var feitas = etapas.filter(function (e) { return feita(e.id); }).length;
    var pct = Math.round((feitas / etapas.length) * 100);

    var barra = '<div class="art-ck">' +
      '<span class="track"><span class="fill" style="width:' + pct + '%"></span></span>' +
      '<span class="n">' + feitas + '/' + etapas.length + '</span></div>';

    if (!detalhado) return barra;

    return barra + '<ul class="art-st-list">' + etapas.map(function (e) {
      var ok = feita(e.id);
      return '<li' + (ok ? ' class="ok"' : '') + '>' +
        ico(ok ? 'check-circle' : 'clock') + '<span>' + esc(e.titulo) + '</span></li>';
    }).join('') + '</ul>';
  }

  function cartaoArtefato(a, detalhado) {
    var s = Club.ART_ST[a.status] || Club.ART_ST['Bloqueado'];
    var locked = a.status === 'Bloqueado';
    var corpo =
      '<div class="art-i">' + ico(a.icone || 'box') + '</div>' +
      '<p class="art-n">' + esc(a.nome) + '</p>' +
      '<p class="art-s">' + esc(a.subtitulo) + '</p>' +
      checklist(a, detalhado) +
      '<div class="art-st" style="color:' + s.color + '">' + ico(s.icon) + esc(a.status) + '</div>' +
      '<p class="art-m">' + esc(a.meta) + '</p>';

    /* Só vira link quando há para onde ir e o artefato não está bloqueado. */
    return (a.url && !locked)
      ? '<a class="art" href="' + esc(a.url) + '" style="text-decoration:none;color:inherit">' +
        corpo + '</a>'
      : '<div class="art' + (locked ? ' locked' : '') + '">' + corpo + '</div>';
  }

  function renderArtifacts() {
    var vazio = Club.empty('box', 'Nenhum artefato liberado ainda.');
    /* Na aba cheia cabe o checklist inteiro; no resumo da capa só a barra. */
    $('artList').innerHTML = st.artifacts.length
      ? st.artifacts.map(function (a) { return cartaoArtefato(a, false); }).join('') : vazio;
    $('artListFull').innerHTML = st.artifacts.length
      ? st.artifacts.map(function (a) { return cartaoArtefato(a, true); }).join('') : vazio;
    return st.artifacts.filter(function (a) { return a.status === 'Disponível'; }).length;
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
    var cats = ['Todas as categorias'].concat(Club.MAT_CATEGORIAS);
    $('filtroCategoriaMat').innerHTML = cats.map(function (c, i) {
      var v = i === 0 ? '' : c;
      return '<option value="' + esc(v) + '"' + (v === st.matCategoria ? ' selected' : '') +
        '>' + esc(c) + '</option>';
    }).join('');

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

  function renderStats(disponiveis, proxima) {
    var feitas = st.tasks.filter(function (t) { return t.status === 'done'; }).length;
    var pct = st.tasks.length === 0 ? 0 : Math.round((feitas / st.tasks.length) * 100);
    $('pct').textContent = pct;
    $('weekFill').style.width = Math.max(pct, 3) + '%';
    $('statTasks').textContent = feitas + '/' + st.tasks.length;
    $('statArt').textContent = disponiveis;
    $('statNext').textContent = proxima ? Club.fmtDate(proxima.inicia_em) : '—';
  }

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
      esc((m.turma + ' · ' + m.fase).toUpperCase()) + '</div>' +
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
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ── render geral ─────────────────────────────────────────────────────── */

  function render() {
    renderIdentidade();
    renderGrupo();
    renderTasks();
    var disponiveis = renderArtifacts();
    var proxima = renderAgenda();
    renderMateriais();
    renderPerfil();
    renderStats(disponiveis, proxima);
  }

  /* ── eventos ──────────────────────────────────────────────────────────── */

  document.addEventListener('click', function (e) {
    if (e.target.closest('#sair')) { Club.auth.logout(); return; }

    var nav = e.target.closest('[data-nav]');
    if (nav) { go(nav.dataset.nav); return; }

    var stat = e.target.closest('#filtroStatus button');
    if (stat) { st.status = stat.dataset.st; renderTasks(); return; }

    var down = e.target.closest('[data-baixar]');
    if (down) { baixar(down.dataset.baixar); return; }

    var tarefa = e.target.closest('.task');
    if (tarefa) {
      /* Marcar concluída grava de verdade; a lista é recarregada porque a
         ordenação muda quando o status muda. */
      Club.data.tasks.toggle(tarefa.dataset.id).catch(function (err) {
        Club.toast(err.message || 'Não foi possível atualizar a tarefa.', 'alert');
        throw err;
      }).then(function () {
        return Club.data.tasks.list({ memberId: st.membro.id });
      }).then(function (rows) {
        st.tasks = rows;
        renderTasks();
        renderStats(
          st.artifacts.filter(function (a) { return a.status === 'Disponível'; }).length,
          st.events.filter(function (x) { return Club.parseDate(x.inicia_em) >= new Date(); })[0]
        );
      }).catch(function () { /* já avisado acima */ });
    }
  });

  $('filtroCategoria').addEventListener('change', function () {
    st.categoria = this.value;
    renderTasks();
  });

  $('filtroCategoriaMat').addEventListener('change', function () {
    st.matCategoria = this.value;
    renderMateriais();
  });

  /* ── partida ──────────────────────────────────────────────────────────── */

  Club.auth.require().then(function (s) {
    if (!s) return;                 // a guarda já redirecionou
    sessao = s;
    admin = s.role === 'admin';
    return carregar().then(function () {
      render();
      renderAvisoAdmin();
      go('home');
    });
  }).catch(function (err) {
    document.querySelector('.main').innerHTML =
      '<div class="placeholder">' + ico('alert') + '<h2>Não foi possível abrir sua área</h2>' +
      '<p>' + esc(err.message) + '</p>' +
      '<button class="btn" id="sair" style="margin-top:18px">Sair</button></div>';
  });
})();
