/* ============================================================================
   Club OftalmoBlack — painel do administrador

   Cadastra membros, tarefas, agenda e artefatos. Tudo passa por Club.data, que
   na Etapa 2 troca o localStorage pelo Supabase sem mexer neste arquivo.
   ========================================================================= */
(function () {
  'use strict';

  var sessao = null;

  var st = { members: [], tasks: [], events: [], artifacts: [],
             view: 'overview', membro: '', status: 'all' };

  var NAV = [
    { key:'overview',  label:'Visão geral', icon:'home' },
    { key:'members',   label:'Membros',     icon:'users' },
    { key:'tasks',     label:'Tarefas',     icon:'check-square' },
    { key:'agenda',    label:'Agenda',      icon:'calendar' },
    { key:'artifacts', label:'Artefatos',   icon:'box' }
  ];

  var esc = Club.esc, ico = Club.icon;
  var $ = function (id) { return document.getElementById(id); };

  /* ── identidade ───────────────────────────────────────────────────────── */

  function aplicarIdentidade() {
    $('quemNome').textContent = sessao.name || sessao.email;
    $('avatar').textContent = sessao.initials || Club.initials(sessao.name || sessao.email);
    $('saudacao').innerHTML = Club.greeting() + ', <b>' +
      esc((sessao.name || '').split(' ')[0] || 'admin') + '</b>';
  }

  $('sair').addEventListener('click', function () { Club.auth.logout(); });

  /* ── dados ────────────────────────────────────────────────────────────── */

  function carregar() {
    return Promise.all([
      Club.data.members.list(),
      Club.data.tasks.list(),
      Club.data.events.list(),
      Club.data.artifacts.list()
    ]).then(function (r) {
      st.members = r[0]; st.tasks = r[1]; st.events = r[2]; st.artifacts = r[3];
    });
  }

  function membro(id) {
    var m = st.members.filter(function (x) { return x.id === id; })[0];
    return m ? m.nome : null;
  }

  /* Rótulo de escopo: sem member_id o item vale para a turma inteira. */
  function escopo(id) { return id ? (membro(id) || 'Membro removido') : 'Turma inteira'; }

  function opcoesMembro(incluirTurma) {
    var base = incluirTurma ? [{ value:'', label:'Turma inteira' }] : [];
    return base.concat(st.members.map(function (m) {
      return { value: m.id, label: m.nome + (m.ativo ? '' : ' (inativo)') };
    }));
  }

  function recarregar(msg) {
    return carregar().then(function () {
      render();
      if (msg) Club.toast(msg);
    });
  }

  /* Sem isto, uma escrita barrada pelo RLS ou uma queda de rede falharia em
     silêncio e o admin acharia que salvou. */
  function aviso(err) {
    Club.modal.close();
    Club.toast(err.message || 'Não foi possível salvar.', 'alert');
  }

  /* ── navegação ────────────────────────────────────────────────────────── */

  function renderNav() {
    $('rail').innerHTML =
      '<div class="rail-lbl">ADMINISTRAÇÃO</div>' +
      NAV.map(function (n) {
        return '<button class="nav" role="tab" data-nav="' + n.key + '" aria-selected="' +
          (n.key === st.view) + '">' + ico(n.icon) + '<span>' + n.label + '</span></button>';
      }).join('') +
      '<div class="rail-foot"><div class="k">' + st.members.length + ' MEMBROS</div>' +
      '<div class="v">' + st.tasks.filter(function (t) { return t.status !== 'done'; }).length +
      ' tarefas em aberto agora.</div></div>';

    $('navm').innerHTML = NAV.map(function (n) {
      return '<button class="chip" role="tab" data-nav="' + n.key + '" aria-selected="' +
        (n.key === st.view) + '">' + ico(n.icon) + n.label + '</button>';
    }).join('');
  }

  function go(key) {
    st.view = key;
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (v) {
      v.hidden = v.dataset.view !== key;
    });
    renderNav();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ── visão geral ──────────────────────────────────────────────────────── */

  function renderOverview() {
    var ativos = st.members.filter(function (m) { return m.ativo; }).length;
    var abertas = st.tasks.filter(function (t) { return t.status !== 'done'; }).length;
    var atrasadas = st.tasks.filter(Club.isLate);
    var futuros = st.events.filter(function (e) {
      return Club.parseDate(e.inicia_em) >= new Date();
    });
    var prox = futuros[0];
    var producao = st.artifacts.filter(function (a) { return a.status === 'Em produção'; }).length;

    $('stats').innerHTML =
      cardStat('MEMBROS ATIVOS', ativos, st.members.length - ativos + ' inativos') +
      cardStat('TAREFAS EM ABERTO', abertas, atrasadas.length + ' atrasadas') +
      cardStat('PRÓXIMO ENCONTRO', prox ? Club.fmtDate(prox.inicia_em) : '—',
               prox ? prox.titulo : 'Nada agendado') +
      cardStat('ARTEFATOS EM PRODUÇÃO', producao, st.artifacts.length + ' cadastrados no total');

    $('atrasadas').innerHTML = atrasadas.length
      ? atrasadas.map(function (t) { return linhaTarefa(t, true); }).join('')
      : Club.empty('check-circle', 'Nenhuma tarefa atrasada. A turma está em dia.');
  }

  function cardStat(k, v, d) {
    return '<div class="stat"><div class="k">' + esc(k) + '</div>' +
      '<div class="v">' + esc(v) + '</div><div class="d">' + esc(d) + '</div></div>';
  }

  /* ── membros ──────────────────────────────────────────────────────────── */

  function renderMembers() {
    $('listaMembros').innerHTML = st.members.length
      ? st.members.map(function (m) {
          var abertas = st.tasks.filter(function (t) {
            return t.member_id === m.id && t.status !== 'done';
          }).length;
          return '<div class="row' + (m.ativo ? '' : ' off') + '">' +
            '<span class="avatar">' + esc(m.iniciais || Club.initials(m.nome)) + '</span>' +
            '<div class="row-b">' +
              '<div class="row-t">' + esc(m.nome) + '</div>' +
              '<div class="row-s">' + esc(m.email) + '</div>' +
              '<div class="row-meta">' +
                '<span class="pill" style="color:var(--gold);border-color:var(--border)">' +
                  esc(m.tier || 'BLACK') + '</span>' +
                '<span>' + esc(m.turma) + ' · ' + esc(m.fase) + '</span>' +
                '<span>' + abertas + ' tarefa' + (abertas === 1 ? '' : 's') + ' em aberto</span>' +
                (m.ativo ? '' : '<span class="pill">inativo</span>') +
              '</div>' +
            '</div>' +
            acoes('member', m.id) +
          '</div>';
        }).join('')
      : Club.empty('users', 'Nenhum membro cadastrado ainda.');
  }

  function acoes(tipo, id) {
    return '<div class="row-acts">' +
      '<button class="btn btn-sm btn-ghost" data-edit="' + tipo + '" data-id="' + id +
        '" aria-label="Editar">' + ico('edit') + '</button>' +
      '<button class="btn btn-sm btn-ghost" data-del="' + tipo + '" data-id="' + id +
        '" aria-label="Remover">' + ico('trash') + '</button>' +
    '</div>';
  }

  function modalMembro(m) {
    m = m || { nome:'', email:'', iniciais:'', turma:'Turma 03', fase:'Fase 1',
               tier:'BLACK', instagram:'', ativo:true };
    Club.modal.open({
      title: m.id ? 'Editar membro' : 'Novo membro',
      sub: m.id ? m.nome : 'O e-mail é o login dele na área do mentorado.',
      body:
        Club.field('Nome completo', 'nome', { value:m.nome, required:true,
          placeholder:'Dra. Cintia Santini' }) +
        Club.field('E-mail', 'email', { value:m.email, type:'email', required:true,
          placeholder:'cintia@oftalmoblack.com.br' }) +
        '<div class="fld-row">' +
          Club.field('Turma', 'turma', { value:m.turma, placeholder:'Turma 03' }) +
          Club.field('Fase', 'fase', { value:m.fase, placeholder:'Fase 1' }) +
        '</div>' +
        '<div class="fld-row">' +
          Club.select('Tier', 'tier', ['BLACK', 'PRIME', 'START'], m.tier) +
          Club.field('Iniciais do avatar', 'iniciais', { value:m.iniciais,
            placeholder:'automático', hint:'Deixe em branco para calcular do nome.' }) +
        '</div>' +
        Club.field('Instagram', 'instagram', { value:m.instagram, placeholder:'@perfil' }) +
        Club.checkbox('Acesso ativo', 'ativo', m.ativo),
      onSubmit: function (d) {
        if (!d.nome || !d.email) { Club.toast('Nome e e-mail são obrigatórios.', 'alert'); return; }
        d.id = m.id;
        d.iniciais = d.iniciais || Club.initials(d.nome);
        Club.data.members.save(d).then(function () {
          Club.modal.close();
          recarregar(m.id ? 'Membro atualizado.' : 'Membro cadastrado.');
        }).catch(aviso);
      }
    });
  }

  /* ── tarefas ──────────────────────────────────────────────────────────── */

  function tarefasVisiveis() {
    return st.tasks.filter(function (t) {
      if (st.membro && t.member_id !== st.membro) return false;
      if (st.status === 'pending') return t.status !== 'done';
      if (st.status === 'done') return t.status === 'done';
      return true;
    });
  }

  function renderTasks() {
    var sel = $('filtroMembro');
    sel.innerHTML = '<option value="">Todos os membros</option>' +
      st.members.map(function (m) {
        return '<option value="' + esc(m.id) + '"' + (m.id === st.membro ? ' selected' : '') +
          '>' + esc(m.nome) + '</option>';
      }).join('');

    Array.prototype.forEach.call($('filtroStatus').children, function (b) {
      b.setAttribute('aria-selected', String(b.dataset.st === st.status));
    });

    var rows = tarefasVisiveis();
    /* Sem filtro de membro a lista mistura todo mundo, então cada linha precisa
       dizer de quem é — várias tarefas têm o mesmo título entre mentorados. */
    var comNome = !st.membro;
    $('listaTarefas').innerHTML = rows.length
      ? rows.map(function (t) { return linhaTarefa(t, comNome); }).join('')
      : Club.empty('check-square', st.membro
          ? 'Nenhuma tarefa para este membro com o filtro atual.'
          : 'Nenhuma tarefa cadastrada ainda.');
  }

  function linhaTarefa(t, comNome) {
    var tint = Club.TINT[t.categoria] || 'var(--muted)';
    var atrasada = Club.isLate(t);
    var progresso = t.progresso_total > 0
      ? '<span>' + t.progresso_atual + '/' + t.progresso_total + ' entregues</span>' : '';
    return '<div class="row' + (t.status === 'done' ? ' off' : '') + '">' +
      '<div class="row-b">' +
        '<div class="row-meta" style="margin:0 0 7px">' +
          '<span class="pill" style="color:' + tint + ';border-color:' + tint + '55;background:' +
            tint + '14"><span class="dot"></span>' + esc(t.categoria) + '</span>' +
          '<span>' + esc(t.cadencia) + '</span>' +
          (comNome ? '<span class="pill">' + esc(membro(t.member_id) || '—') + '</span>' : '') +
        '</div>' +
        '<div class="row-t">' + esc(t.titulo) + '</div>' +
        '<div class="row-s">' + esc(t.descricao) + '</div>' +
        '<div class="row-meta">' +
          '<span style="color:' + (atrasada ? '#F08A8A' : 'inherit') + '">' +
            ico(t.status === 'done' ? 'check-circle' : 'clock') +
            (t.status === 'done' ? 'Concluída' : Club.fmtDue(t.vence_em)) + '</span>' +
          progresso +
        '</div>' +
      '</div>' +
      acoes('task', t.id) +
    '</div>';
  }

  function modalTarefa(t) {
    var novo = !t;
    t = t || { member_id:st.membro || (st.members[0] || {}).id, titulo:'', descricao:'',
               categoria:'Conteúdo', cadencia:'Semanal', vence_em:'',
               progresso_atual:0, progresso_total:0, status:'pending' };

    if (!st.members.length) {
      Club.toast('Cadastre um membro antes de criar tarefas.', 'alert');
      return;
    }

    /* Ao criar, dá para mandar a mesma tarefa para vários mentorados de uma vez;
       ao editar, a tarefa pertence a um só. */
    var campoMembro = novo
      ? Club.select('Para quem', 'membros', opcoesMembro(false), t.member_id,
          { multiple:true, hint:'Segure Ctrl (ou Cmd) para escolher mais de um.' })
      : Club.select('Para quem', 'member_id', opcoesMembro(false), t.member_id);

    Club.modal.open({
      title: novo ? 'Nova tarefa' : 'Editar tarefa',
      sub: novo ? 'Ela aparece na área do mentorado assim que você salvar.' : t.titulo,
      body:
        campoMembro +
        Club.field('Título', 'titulo', { value:t.titulo, required:true,
          placeholder:'Gravar 1 vídeo para o Instagram' }) +
        Club.field('Descrição', 'descricao', { value:t.descricao, textarea:true,
          placeholder:'O que exatamente precisa ser feito.' }) +
        '<div class="fld-row">' +
          Club.select('Categoria', 'categoria', Club.CATEGORIAS, t.categoria) +
          Club.select('Cadência', 'cadencia', Club.CADENCIAS, t.cadencia) +
        '</div>' +
        '<div class="fld-row">' +
          Club.field('Vence em', 'vence_em', { value:t.vence_em, type:'date' }) +
          Club.field('Meta de entregas', 'progresso_total', { value:t.progresso_total,
            type:'number', min:0, hint:'0 esconde a barra de progresso.' }) +
        '</div>' +
        (novo ? '' : '<div class="fld-row">' +
          Club.field('Já entregues', 'progresso_atual', { value:t.progresso_atual,
            type:'number', min:0 }) +
          Club.select('Situação', 'status',
            [{ value:'pending', label:'Em aberto' }, { value:'done', label:'Concluída' }],
            t.status) +
        '</div>'),
      onSubmit: function (d) {
        if (!d.titulo) { Club.toast('A tarefa precisa de um título.', 'alert'); return; }

        var alvos = novo ? (d.membros || []) : [d.member_id];
        if (!alvos.length) { Club.toast('Escolha ao menos um membro.', 'alert'); return; }

        var base = {
          titulo:d.titulo, descricao:d.descricao, categoria:d.categoria,
          cadencia:d.cadencia, vence_em:d.vence_em,
          progresso_total: Number(d.progresso_total) || 0,
          progresso_atual: novo ? 0 : Number(d.progresso_atual) || 0,
          status: novo ? 'pending' : d.status
        };

        Promise.all(alvos.map(function (id) {
          return Club.data.tasks.save(Object.assign({}, base,
            { id: novo ? undefined : t.id, member_id: id }));
        })).then(function () {
          Club.modal.close();
          recarregar(novo
            ? (alvos.length > 1 ? 'Tarefa criada para ' + alvos.length + ' membros.' : 'Tarefa criada.')
            : 'Tarefa atualizada.');
        }).catch(aviso);
      }
    });
  }

  /* ── agenda ───────────────────────────────────────────────────────────── */

  function renderAgenda() {
    $('listaAgenda').innerHTML = st.events.length
      ? st.events.map(function (e) {
          var p = Club.dateParts(e.inicia_em);
          var passou = Club.parseDate(e.inicia_em) < new Date();
          return '<div class="row' + (passou ? ' off' : '') + '">' +
            '<div class="les-d" style="flex-shrink:0">' +
              '<div class="les-day">' + esc(p.day) + '</div>' +
              '<div class="les-mo">' + esc(p.month) + '</div></div>' +
            '<div class="row-b">' +
              '<div class="row-t">' + esc(e.titulo) + '</div>' +
              '<div class="row-s">com ' + esc(e.mentor || '—') + '</div>' +
              '<div class="row-meta">' +
                '<span>' + ico('calendar') + esc(p.weekday) + ', ' + esc(p.time) + '</span>' +
                '<span>' + ico(e.formato === 'Gravada' ? 'play' : 'video') + esc(e.formato) + '</span>' +
                '<span class="pill">' + esc(escopo(e.member_id)) + '</span>' +
                (e.link ? '<span>' + ico('link') + 'com link</span>' : '') +
              '</div>' +
            '</div>' +
            acoes('event', e.id) +
          '</div>';
        }).join('')
      : Club.empty('calendar', 'Nenhum encontro agendado ainda.');
  }

  function modalEvento(e) {
    e = e || { titulo:'', mentor:'', inicia_em:'', formato:'Ao vivo', link:'', member_id:null };
    Club.modal.open({
      title: e.id ? 'Editar evento' : 'Novo evento',
      sub: e.id ? e.titulo : 'Aparece na agenda de quem você escolher abaixo.',
      body:
        Club.field('Título', 'titulo', { value:e.titulo, required:true,
          placeholder:'Mesa de pares — diagnóstico de funil' }) +
        Club.field('Quem conduz', 'mentor', { value:e.mentor, placeholder:'Ítalo Monte' }) +
        '<div class="fld-row">' +
          Club.field('Data e hora', 'inicia_em', { value:e.inicia_em, type:'datetime-local',
            required:true }) +
          Club.select('Formato', 'formato', Club.FORMATOS, e.formato) +
        '</div>' +
        Club.select('Para quem', 'member_id', opcoesMembro(true), e.member_id || '',
          { hint:'"Turma inteira" aparece para todos os membros.' }) +
        Club.field('Link da sala ou da gravação', 'link', { value:e.link,
          placeholder:'https://…' }),
      onSubmit: function (d) {
        if (!d.titulo || !d.inicia_em) {
          Club.toast('Título e data são obrigatórios.', 'alert'); return;
        }
        d.id = e.id;
        d.member_id = d.member_id || null;
        Club.data.events.save(d).then(function () {
          Club.modal.close();
          recarregar(e.id ? 'Evento atualizado.' : 'Evento criado.');
        }).catch(aviso);
      }
    });
  }

  /* ── artefatos ────────────────────────────────────────────────────────── */

  function renderArtifacts() {
    $('listaArtefatos').innerHTML = st.artifacts.length
      ? st.artifacts.map(function (a) {
          var s = Club.ART_ST[a.status] || Club.ART_ST['Bloqueado'];
          return '<div class="row">' +
            '<div class="art-i" style="flex-shrink:0;margin:0">' + ico(a.icone || 'box') + '</div>' +
            '<div class="row-b">' +
              '<div class="row-t">' + esc(a.nome) + '</div>' +
              '<div class="row-s">' + esc(a.subtitulo) + '</div>' +
              '<div class="row-meta">' +
                '<span style="color:' + s.color + '">' + ico(s.icon) + esc(a.status) + '</span>' +
                (a.meta ? '<span>' + esc(a.meta) + '</span>' : '') +
                '<span class="pill">' + esc(escopo(a.member_id)) + '</span>' +
                (a.url ? '<span>' + ico('link') + 'com link</span>' : '') +
              '</div>' +
            '</div>' +
            acoes('artifact', a.id) +
          '</div>';
        }).join('')
      : Club.empty('box', 'Nenhum artefato cadastrado ainda.');
  }

  function modalArtefato(a) {
    a = a || { nome:'', subtitulo:'', icone:'box', status:'Em produção', meta:'',
               url:'', member_id:null };
    Club.modal.open({
      title: a.id ? 'Editar artefato' : 'Novo artefato',
      sub: a.id ? a.nome : 'O que o Club entrega para o mentorado.',
      body:
        Club.field('Nome', 'nome', { value:a.nome, required:true,
          placeholder:'Landing Page VSL' }) +
        Club.field('Descrição curta', 'subtitulo', { value:a.subtitulo,
          placeholder:'Página de vídeo de vendas' }) +
        '<div class="fld-row">' +
          Club.select('Situação', 'status', Club.ART_STATUS, a.status) +
          Club.select('Ícone', 'icone', Club.ART_ICONES, a.icone) +
        '</div>' +
        Club.field('Observação', 'meta', { value:a.meta,
          placeholder:'Entrega em 6 dias', hint:'Linha pequena que aparece embaixo do status.' }) +
        Club.select('Para quem', 'member_id', opcoesMembro(true), a.member_id || '',
          { hint:'"Turma inteira" aparece para todos os membros.' }) +
        Club.field('Link', 'url', { value:a.url, placeholder:'/mentorados/…  ou  https://…',
          hint:'Com link preenchido, o cartão vira clicável na área do mentorado.' }),
      onSubmit: function (d) {
        if (!d.nome) { Club.toast('O artefato precisa de um nome.', 'alert'); return; }
        d.id = a.id;
        d.member_id = d.member_id || null;
        Club.data.artifacts.save(d).then(function () {
          Club.modal.close();
          recarregar(a.id ? 'Artefato atualizado.' : 'Artefato criado.');
        }).catch(aviso);
      }
    });
  }

  /* ── remoção ──────────────────────────────────────────────────────────── */

  var TIPOS = {
    member:   { store:'members',   nome:function (r) { return r.nome; },
                aviso:'As tarefas e os artefatos que eram só dele saem junto.' },
    task:     { store:'tasks',     nome:function (r) { return r.titulo; }, aviso:'' },
    event:    { store:'events',    nome:function (r) { return r.titulo; }, aviso:'' },
    artifact: { store:'artifacts', nome:function (r) { return r.nome; }, aviso:'' }
  };

  function achar(tipo, id) {
    return st[TIPOS[tipo].store].filter(function (r) { return r.id === id; })[0];
  }

  function remover(tipo, id) {
    var reg = achar(tipo, id);
    if (!reg) return;
    var t = TIPOS[tipo];
    Club.modal.confirm('Remover?',
      ['"' + t.nome(reg) + '" será apagado.', t.aviso, 'Não dá para desfazer.']
        .filter(Boolean).join(' '),
      function () {
        Club.data[t.store].remove(id)
          .then(function () { recarregar('Removido.'); })
          .catch(aviso);
      });
  }

  var MODAIS = { member:modalMembro, task:modalTarefa, event:modalEvento, artifact:modalArtefato };

  /* ── eventos ──────────────────────────────────────────────────────────── */

  document.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-nav]');
    if (nav) { go(nav.dataset.nav); return; }

    var novo = e.target.closest('[data-new]');
    if (novo) { MODAIS[novo.dataset.new](); return; }

    var editar = e.target.closest('[data-edit]');
    if (editar) { MODAIS[editar.dataset.edit](achar(editar.dataset.edit, editar.dataset.id)); return; }

    var apagar = e.target.closest('[data-del]');
    if (apagar) { remover(apagar.dataset.del, apagar.dataset.id); return; }

    var stat = e.target.closest('#filtroStatus button');
    if (stat) { st.status = stat.dataset.st; renderTasks(); return; }
  });

  $('filtroMembro').addEventListener('change', function () {
    st.membro = this.value;
    renderTasks();
  });

  /* ── partida ──────────────────────────────────────────────────────────── */

  function render() {
    renderNav();
    renderOverview();
    renderMembers();
    renderTasks();
    renderAgenda();
    renderArtifacts();
  }

  function falhou(err) {
    document.querySelector('.main').innerHTML =
      '<div class="placeholder">' + ico('alert') + '<h2>Não foi possível abrir o painel</h2>' +
      '<p>' + esc(err.message) + '</p></div>';
  }

  Club.auth.require('admin').then(function (s) {
    if (!s) return;                 // a guarda já redirecionou
    sessao = s;
    aplicarIdentidade();
    return carregar().then(function () { render(); go('overview'); });
  }).catch(falhou);
})();
