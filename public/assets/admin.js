/* ============================================================================
   Club OftalmoBlack — painel do administrador

   Cadastra membros, tarefas, agenda e artefatos. Tudo passa por Club.data, que
   na Etapa 2 troca o localStorage pelo Supabase sem mexer neste arquivo.
   ========================================================================= */
(function () {
  'use strict';

  var sessao = null;

  var st = { members: [], tasks: [], events: [], artifacts: [], materials: [],
             demands: [], staff: [],
             view: 'overview', membro: '', status: 'all',
             matCategoria: '', matMembro: '',
             demResp: '', demMembro: '', demAbertas: 'open' };

  var NAV = [
    { key:'overview',  label:'Visão geral', icon:'home' },
    { key:'demands',   label:'Demandas',    icon:'check-circle' },
    { key:'members',   label:'Membros',     icon:'users' },
    { key:'tasks',     label:'Tarefas',     icon:'check-square' },
    { key:'agenda',    label:'Agenda',      icon:'calendar' },
    { key:'materials', label:'Materiais',   icon:'folder' },
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
      Club.data.artifacts.list(),
      Club.data.materials.list(),
      Club.data.demands.list(),
      Club.data.staff.list()
    ]).then(function (r) {
      st.members = r[0]; st.tasks = r[1]; st.events = r[2];
      st.artifacts = r[3]; st.materials = r[4];
      st.demands = r[5]; st.staff = r[6];
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

  /* ── demandas ─────────────────────────────────────────────────────────── */

  function pessoa(id) {
    var p = st.staff.filter(function (x) { return x.id === id; })[0];
    return p ? p.nome : null;
  }

  function responsaveisDe(d) {
    if (!d.responsaveis || !d.responsaveis.length) return 'Sem responsável';
    return d.responsaveis.map(function (id) { return pessoa(id) || '—'; }).join(', ');
  }

  function demandasVisiveis() {
    return st.demands.filter(function (d) {
      if (st.demAbertas === 'open' && Club.DEM_ABERTOS.indexOf(d.status) === -1) return false;
      if (st.demResp && (!d.responsaveis || d.responsaveis.indexOf(st.demResp) === -1)) return false;
      if (st.demMembro && d.member_id !== st.demMembro) return false;
      return true;
    });
  }

  function renderDemandas() {
    if (Club.faltaMigracao) {
      $('statsDemandas').innerHTML = '';
      $('listaDemandas').innerHTML = '<div class="notice">' + ico('alert') +
        '<div>' + esc(Club.faltaMigracao) + '</div></div>';
      return;
    }

    $('filtroResponsavel').innerHTML = '<option value="">Todos os responsáveis</option>' +
      st.staff.map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (p.id === st.demResp ? ' selected' : '') +
          '>' + esc(p.nome) + '</option>';
      }).join('');

    $('filtroMembroDem').innerHTML = '<option value="">Qualquer mentorado</option>' +
      st.members.map(function (m) {
        return '<option value="' + esc(m.id) + '"' + (m.id === st.demMembro ? ' selected' : '') +
          '>' + esc(m.nome) + '</option>';
      }).join('');

    Array.prototype.forEach.call($('filtroAbertas').children, function (b) {
      b.setAttribute('aria-selected', String(b.dataset.ab === st.demAbertas));
    });

    var abertas = st.demands.filter(function (d) {
      return Club.DEM_ABERTOS.indexOf(d.status) !== -1;
    });
    var atrasadas = abertas.filter(function (d) {
      var n = Club.diffDays(d.vence_em);
      return n !== null && n < 0;
    });
    var risco = st.demands.filter(function (d) {
      return d.status === 'Em risco' || d.status === 'Aguardando retorno';
    });
    var semDono = abertas.filter(function (d) {
      return !d.responsaveis || !d.responsaveis.length;
    });

    $('statsDemandas').innerHTML =
      cardStat('EM ABERTO', abertas.length, st.demands.length + ' no total') +
      cardStat('ATRASADAS', atrasadas.length, atrasadas.length ? 'passaram do prazo' : 'tudo dentro do prazo') +
      cardStat('PEDINDO ATENÇÃO', risco.length, 'em risco ou aguardando retorno') +
      cardStat('SEM RESPONSÁVEL', semDono.length, semDono.length ? 'ninguém tocando' : 'todas com dono');

    var rows = demandasVisiveis();
    if (!rows.length) {
      $('listaDemandas').innerHTML = Club.empty('check-circle',
        st.demResp || st.demMembro ? 'Nenhuma demanda com este filtro.'
                                   : 'Nenhuma demanda em aberto. Aproveite.');
      return;
    }

    var grupos = {};
    rows.forEach(function (d) { (grupos[d.status] = grupos[d.status] || []).push(d); });

    $('listaDemandas').innerHTML = Club.DEM_STATUS
      .filter(function (k) { return grupos[k]; })
      .map(function (k) {
        var cor = Club.DEM_COR[k];
        return '<div class="sec" style="margin-top:26px"><div class="sec-g">' +
            '<div class="sec-eb"><span class="sec-dash" style="background:' + cor + '"></span>' +
            '<span style="color:' + cor + '">' + esc(k.toUpperCase()) + '</span></div>' +
            '<h2 class="sec-t">' + grupos[k].length +
              (grupos[k].length === 1 ? ' demanda' : ' demandas') + '</h2></div></div>' +
          grupos[k].map(linhaDemanda).join('');
      }).join('');
  }

  function linhaDemanda(d) {
    var prio = Club.DEM_PRIO_COR[d.prioridade] || 'var(--muted)';
    var cor = Club.DEM_COR[d.status];
    var n = Club.diffDays(d.vence_em);
    var atrasada = n !== null && n < 0 && Club.DEM_ABERTOS.indexOf(d.status) !== -1;
    var fechada = d.status === 'Concluída' || d.status === 'Cancelada';

    return '<div class="row' + (fechada ? ' off' : '') + '"' +
      ' style="border-left:3px solid ' + cor + '">' +
      '<div class="row-b">' +
        '<div class="row-meta" style="margin:0 0 7px">' +
          '<span class="pill" style="color:' + prio + ';border-color:' + prio + '55;background:' +
            prio + '14"><span class="dot"></span>' + esc(d.prioridade) + '</span>' +
          (d.origem ? '<span>' + esc(d.origem) + '</span>' : '') +
          (d.member_id ? '<span class="pill">' + esc(membro(d.member_id) || '—') + '</span>' : '') +
        '</div>' +
        '<div class="row-t">' + esc(d.titulo) + '</div>' +
        (d.descricao ? '<div class="row-s">' + esc(d.descricao) + '</div>' : '') +
        '<div class="row-meta">' +
          '<span>' + ico('user') + esc(responsaveisDe(d)) + '</span>' +
          (d.vence_em
            ? '<span style="color:' + (atrasada ? '#F08A8A' : 'inherit') + '">' +
              ico('clock') + esc(Club.fmtDue(d.vence_em)) + '</span>'
            : '') +
        '</div>' +
      '</div>' +
      '<div class="row-acts">' +
        (fechada
          ? '<button class="btn btn-sm btn-ghost" data-reabrir="' + d.id +
            '" aria-label="Reabrir">' + ico('refresh') + '</button>'
          : '<button class="btn btn-sm btn-ghost" data-concluir="' + d.id +
            '" aria-label="Concluir">' + ico('check') + '</button>') +
        '<button class="btn btn-sm btn-ghost" data-edit="demand" data-id="' + d.id +
          '" aria-label="Editar">' + ico('edit') + '</button>' +
        '<button class="btn btn-sm btn-ghost" data-del="demand" data-id="' + d.id +
          '" aria-label="Remover">' + ico('trash') + '</button>' +
      '</div>' +
    '</div>';
  }

  function modalDemanda(d) {
    var novo = !d;
    d = d || { titulo:'', descricao:'', status:'A fazer', prioridade:'Média',
               responsaveis:[], member_id:null, origem:'', vence_em:'' };

    var opcoesEquipe = st.staff.filter(function (p) { return p.ativo; })
      .map(function (p) { return { value:p.id, label:p.nome }; });

    Club.modal.open({
      title: novo ? 'Nova demanda' : 'Editar demanda',
      sub: novo ? 'Operação interna — o mentorado não enxerga isto.' : d.titulo,
      body:
        Club.field('O que precisa ser feito', 'titulo', { value:d.titulo, required:true,
          placeholder:'Conectar o WhatsApp da clínica do Arthur' }) +
        Club.field('Detalhe', 'descricao', { value:d.descricao, textarea:true,
          placeholder:'Contexto, links, o que já foi tentado.' }) +
        '<div class="fld-row">' +
          Club.select('Situação', 'status', Club.DEM_STATUS, d.status) +
          Club.select('Prioridade', 'prioridade', Club.DEM_PRIORIDADES, d.prioridade) +
        '</div>' +
        '<div class="fld-row">' +
          Club.field('Origem', 'origem', { value:d.origem,
            placeholder:'Reunião 30/07', hint:'De onde a demanda nasceu.' }) +
          Club.field('Prazo', 'vence_em', { value:d.vence_em, type:'date' }) +
        '</div>' +
        (opcoesEquipe.length
          ? Club.select('Responsáveis', 'responsaveis', opcoesEquipe,
              (d.responsaveis || [])[0], { multiple:true,
                hint:'Segure Ctrl (ou Cmd) para escolher mais de um.' })
          : '<div class="notice">' + ico('alert') +
            '<div>Nenhuma pessoa na equipe ainda. Use o botão Equipe para cadastrar.</div></div>') +
        Club.select('Sobre qual mentorado', 'member_id',
          [{ value:'', label:'Nenhum — demanda interna' }].concat(
            st.members.map(function (m) { return { value:m.id, label:m.nome }; })),
          d.member_id || ''),

      onSubmit: function (dados) {
        if (!dados.titulo) { Club.toast('A demanda precisa de um título.', 'alert'); return; }
        dados.id = d.id;
        dados.member_id = dados.member_id || null;
        dados.responsaveis = dados.responsaveis || [];
        Club.data.demands.save(dados).then(function () {
          Club.modal.close();
          recarregar(novo ? 'Demanda criada.' : 'Demanda atualizada.');
        }).catch(aviso);
      }
    });

    /* O select múltiplo só reflete o array inteiro depois de estar no DOM. */
    if ((d.responsaveis || []).length > 1) {
      var campo = document.querySelector('#modalForm [name="responsaveis"]');
      if (campo) {
        Array.prototype.forEach.call(campo.options, function (o) {
          o.selected = d.responsaveis.indexOf(o.value) !== -1;
        });
      }
    }
  }

  function mudarStatus(id, status) {
    Club.data.demands.save({ id: id, status: status })
      .then(function () { recarregar(status === 'Concluída' ? 'Demanda concluída.' : 'Demanda reaberta.'); })
      .catch(aviso);
  }

  /* ── equipe ───────────────────────────────────────────────────────────── */

  function modalEquipe() {
    var linhas = st.staff.length
      ? st.staff.map(function (p) {
          return '<div class="row" style="margin-bottom:8px">' +
            '<span class="avatar">' + esc(p.apelido || Club.initials(p.nome)) + '</span>' +
            '<div class="row-b"><div class="row-t">' + esc(p.nome) + '</div>' +
            (p.ativo ? '' : '<div class="row-meta"><span class="pill">inativo</span></div>') +
            '</div>' +
            '<div class="row-acts"><button type="button" class="btn btn-sm btn-ghost" ' +
              'data-del="staff" data-id="' + p.id + '" aria-label="Remover">' +
              ico('trash') + '</button></div>' +
          '</div>';
        }).join('')
      : '<p style="color:var(--faint);font-size:13.5px;margin:0 0 18px">Ninguém cadastrado ainda.</p>';

    Club.modal.open({
      title: 'Equipe',
      sub: 'Quem pode ser responsável por uma demanda.',
      body: linhas +
        '<div style="margin-top:20px;padding-top:18px;border-top:1px solid var(--border-soft)">' +
        Club.field('Adicionar pessoa', 'nome', { placeholder:'Nome completo' }) + '</div>',
      submitLabel: 'Adicionar',
      onSubmit: function (dados) {
        if (!dados.nome) { Club.modal.close(); return; }
        Club.data.staff.save({ nome: dados.nome, apelido: Club.initials(dados.nome), ativo: true })
          .then(function () { Club.modal.close(); recarregar('Pessoa adicionada.'); })
          .catch(aviso);
      }
    });
  }

  /* ── materiais ────────────────────────────────────────────────────────── */

  function materiaisVisiveis() {
    return st.materials.filter(function (m) {
      if (st.matCategoria && m.categoria !== st.matCategoria) return false;
      if (st.matMembro) {
        return !m.visivel_para || m.visivel_para.indexOf(st.matMembro) !== -1;
      }
      return true;
    });
  }

  function alcance(m) {
    if (!m.visivel_para || !m.visivel_para.length) return 'Turma inteira';
    if (m.visivel_para.length === 1) return membro(m.visivel_para[0]) || 'Membro removido';
    return m.visivel_para.length + ' mentorados';
  }

  function renderMaterials() {
    $('filtroCategoriaMat').innerHTML =
      '<option value="">Todas as categorias</option>' +
      Club.MAT_CATEGORIAS.map(function (c) {
        return '<option value="' + esc(c) + '"' + (c === st.matCategoria ? ' selected' : '') +
          '>' + esc(c) + '</option>';
      }).join('');

    $('filtroMembroMat').innerHTML =
      '<option value="">Todos os mentorados</option>' +
      st.members.map(function (m) {
        return '<option value="' + esc(m.id) + '"' + (m.id === st.matMembro ? ' selected' : '') +
          '>' + esc(m.nome) + '</option>';
      }).join('');

    if (Club.acervoIndisponivel) {
      $('listaMateriais').innerHTML = '<div class="notice">' + ico('alert') +
        '<div>' + esc(Club.acervoIndisponivel) + '</div></div>';
      return;
    }

    var rows = materiaisVisiveis();
    $('listaMateriais').innerHTML = rows.length
      ? rows.map(function (m) {
          return '<div class="row">' +
            '<div class="art-i" style="flex-shrink:0;margin:0">' +
              ico(Club.MAT_ICONE[m.categoria] || 'file-text') + '</div>' +
            '<div class="row-b">' +
              '<div class="row-t">' + esc(m.titulo) + '</div>' +
              (m.descricao ? '<div class="row-s">' + esc(m.descricao) + '</div>' : '') +
              '<div class="row-meta">' +
                '<span class="pill">' + esc(m.categoria) + '</span>' +
                '<span>' + esc(Club.fmtExt(m.arquivo_nome)) + ' · ' +
                  esc(Club.fmtBytes(m.arquivo_bytes)) + '</span>' +
                '<span>' + ico('calendar') + esc(Club.fmtDataCurta(m.publicado_em)) + '</span>' +
                '<span class="pill">' + esc(alcance(m)) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="row-acts">' +
              '<button class="btn btn-sm btn-ghost" data-baixar="' + m.id +
                '" aria-label="Baixar">' + ico('download') + '</button>' +
              '<button class="btn btn-sm btn-ghost" data-edit="material" data-id="' + m.id +
                '" aria-label="Editar">' + ico('edit') + '</button>' +
              '<button class="btn btn-sm btn-ghost" data-del="material" data-id="' + m.id +
                '" aria-label="Remover">' + ico('trash') + '</button>' +
            '</div>' +
          '</div>';
        }).join('')
      : Club.empty('folder', st.matCategoria || st.matMembro
          ? 'Nenhum material com este filtro.'
          : 'O acervo está vazio. Suba o primeiro arquivo.');
  }

  /* O arquivo só é escolhido na criação: trocar o arquivo de um material que já
     foi divulgado confunde mais do que ajuda — melhor subir um novo. */
  function modalMaterial(m) {
    var novo = !m;
    m = m || { titulo:'', descricao:'', categoria:'Análises', visivel_para:null,
               publicado_em: new Date().toISOString().slice(0, 10) };

    var campoArquivo = novo
      ? '<div class="fld"><label for="arquivo">Arquivo</label>' +
        '<input type="file" name="arquivo" id="arquivo" class="inp" required>' +
        '<span class="hint">Até 50 MB. PDF, imagem, planilha, apresentação.</span></div>'
      : '<div class="notice" style="margin-bottom:18px">' + ico('file-text') +
        '<div><b>' + esc(m.arquivo_nome) + '</b><br>' +
        esc(Club.fmtExt(m.arquivo_nome)) + ' · ' + esc(Club.fmtBytes(m.arquivo_bytes)) +
        ' · o arquivo não muda ao editar.</div></div>';

    var selecionados = m.visivel_para || [];
    var opcoesVisibilidade = st.members.map(function (x) {
      return { value: x.id, label: x.nome };
    });

    Club.modal.open({
      title: novo ? 'Subir material' : 'Editar material',
      sub: novo ? 'Fica no acervo de quem você escolher abaixo.' : m.titulo,
      body:
        campoArquivo +
        Club.field('Título', 'titulo', { value:m.titulo, required:true,
          placeholder:'Análise de tráfego — julho' }) +
        Club.field('Descrição', 'descricao', { value:m.descricao, textarea:true,
          placeholder:'O que a pessoa vai encontrar aqui dentro.' }) +
        '<div class="fld-row">' +
          Club.select('Categoria', 'categoria', Club.MAT_CATEGORIAS, m.categoria) +
          Club.field('Publicado em', 'publicado_em', { value:m.publicado_em, type:'date' }) +
        '</div>' +
        Club.checkbox('Liberar para a turma inteira', 'todos', !selecionados.length) +
        Club.select('Ou só para estes mentorados', 'visivel_para', opcoesVisibilidade,
          selecionados[0], { multiple:true,
            hint:'Segure Ctrl (ou Cmd) para marcar mais de um. Ignorado se a turma inteira estiver marcada.' }),

      onSubmit: function (d) {
        if (!d.titulo) { Club.toast('O material precisa de um título.', 'alert'); return; }

        var alvos = d.todos ? null : (d.visivel_para || []);
        if (alvos && !alvos.length) {
          Club.toast('Escolha os mentorados ou marque a turma inteira.', 'alert');
          return;
        }

        var base = {
          titulo: d.titulo, descricao: d.descricao, categoria: d.categoria,
          publicado_em: d.publicado_em, visivel_para: alvos
        };

        if (!novo) {
          Club.data.materials.save(Object.assign({ id: m.id }, base)).then(function () {
            Club.modal.close();
            recarregar('Material atualizado.');
          }).catch(aviso);
          return;
        }

        var input = document.getElementById('arquivo');
        var file = input && input.files && input.files[0];
        if (!file) { Club.toast('Escolha o arquivo.', 'alert'); return; }
        if (file.size > 52428800) {
          Club.toast('Arquivo grande demais. O limite é 50 MB.', 'alert'); return;
        }

        enviando(true);
        Club.data.materials.upload(file).then(function (path) {
          return Club.data.materials.save(Object.assign({}, base, {
            arquivo_path: path,
            arquivo_nome: file.name,
            arquivo_tipo: file.type || null,
            arquivo_bytes: file.size
          })).catch(function (err) {
            /* A linha é que torna o arquivo alcançável; sem ela o upload vira
               lixo invisível ocupando espaço. */
            return Club.data.materials.removerArquivo(path).catch(function () {})
              .then(function () { throw err; });
          });
        }).then(function () {
          Club.modal.close();
          recarregar('Material publicado.');
        }).catch(function (err) {
          enviando(false);
          Club.toast(err.message || 'Não foi possível subir o material.', 'alert');
        });
      }
    });
  }

  /* Upload demora, e um botão que não responde parece quebrado. */
  function enviando(on) {
    var b = document.querySelector('.modal-f .btn-primary');
    if (!b) return;
    b.disabled = on;
    b.textContent = on ? 'Enviando…' : 'Salvar';
  }

  function baixar(id) {
    var m = achar('material', id);
    if (!m) return;
    Club.toast('Baixando…', 'download');
    Club.data.materials.baixar(m.arquivo_path, m.arquivo_nome).catch(function (err) {
      Club.toast(err.message || 'Não foi possível abrir o arquivo.', 'alert');
    });
  }

  /* ── remoção ──────────────────────────────────────────────────────────── */

  var TIPOS = {
    member:   { store:'members',   nome:function (r) { return r.nome; },
                aviso:'As tarefas e os artefatos que eram só dele saem junto.' },
    task:     { store:'tasks',     nome:function (r) { return r.titulo; }, aviso:'' },
    event:    { store:'events',    nome:function (r) { return r.titulo; }, aviso:'' },
    artifact: { store:'artifacts', nome:function (r) { return r.nome; }, aviso:'' },
    material:  { store:'materials',  nome:function (r) { return r.titulo; },
                 aviso:'O arquivo sai do servidor junto.' },
    demand:    { store:'demands',    nome:function (r) { return r.titulo; }, aviso:'' },
    staff:     { store:'staff',      nome:function (r) { return r.nome; },
                 aviso:'As demandas dele continuam, sem responsável.' }
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

  var MODAIS = { member:modalMembro, task:modalTarefa, event:modalEvento,
                 artifact:modalArtefato, material:modalMaterial, demand:modalDemanda };

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

    var down = e.target.closest('[data-baixar]');
    if (down) { baixar(down.dataset.baixar); return; }

    var conc = e.target.closest('[data-concluir]');
    if (conc) { mudarStatus(conc.dataset.concluir, 'Concluída'); return; }

    var reab = e.target.closest('[data-reabrir]');
    if (reab) { mudarStatus(reab.dataset.reabrir, 'A fazer'); return; }

    var eq = e.target.closest('[data-equipe]');
    if (eq) { modalEquipe(); return; }

    var ab = e.target.closest('#filtroAbertas button');
    if (ab) { st.demAbertas = ab.dataset.ab; renderDemandas(); return; }
  });

  $('filtroResponsavel').addEventListener('change', function () {
    st.demResp = this.value;
    renderDemandas();
  });

  $('filtroMembroDem').addEventListener('change', function () {
    st.demMembro = this.value;
    renderDemandas();
  });

  $('filtroCategoriaMat').addEventListener('change', function () {
    st.matCategoria = this.value;
    renderMaterials();
  });

  $('filtroMembroMat').addEventListener('change', function () {
    st.matMembro = this.value;
    renderMaterials();
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
    renderMaterials();
    renderDemandas();
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
