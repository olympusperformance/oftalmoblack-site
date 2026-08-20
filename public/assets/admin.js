/* ============================================================================
   Club OftalmoBlack — painel do administrador

   Cadastra membros, tarefas, agenda e artefatos. Tudo passa por Club.data, que
   na Etapa 2 troca o localStorage pelo Supabase sem mexer neste arquivo.
   ========================================================================= */
(function () {
  'use strict';

  var sessao = null;

  var st = { members: [], tasks: [], events: [], artifacts: [], materials: [],
             demands: [], staff: [], steps: [], progress: [], demandSteps: [],
             view: 'overview', membro: '', status: 'all',
             matCategoria: '', matMembro: '',
             demResp: '', demMembro: '', demAbertas: 'open',
             arvMembro: '', arvFiltro: 'all',
             /* Demanda que está com a linha de nova subtarefa aberta. */
             novaSub: null, zapEdit: null,
             /* Quais galhos das árvores (membros e demandas) estão abertos.
                Fica na tela, não no banco: é postura de leitura do momento. */
             abertos: {} };

  var NAV = [
    { key:'overview',  label:'Visão geral', icon:'home' },
    { key:'members',   label:'Membros',     icon:'users' },
    { key:'demands',   label:'Demandas',    icon:'check-circle' },
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
      Club.data.staff.list(),
      Club.data.steps.list(),
      Club.data.progress.list(),
      Club.data.demandSteps.list()
    ]).then(function (r) {
      st.members = r[0]; st.tasks = r[1]; st.events = r[2];
      st.artifacts = r[3]; st.materials = r[4];
      st.demands = r[5]; st.staff = r[6];
      st.steps = r[7]; st.progress = r[8]; st.demandSteps = r[9];
      indexar();
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

  /* Mapas para a árvore de progresso não varrer os arrays inteiros a cada
     linha desenhada — com 30 mentorados e 10 artefatos isso seria milhares de
     varreduras por render. */
  var porArtefato = {}, porEtapa = {}, porDemanda = {};

  function indexar() {
    porArtefato = {}; porEtapa = {}; porDemanda = {};
    st.steps.forEach(function (e) {
      (porArtefato[e.artifact_id] = porArtefato[e.artifact_id] || []).push(e);
    });
    st.progress.forEach(function (p) {
      if (p.feito) porEtapa[p.member_id + '|' + p.step_id] = p;
    });
    st.demandSteps.forEach(function (e) {
      (porDemanda[e.demand_id] = porDemanda[e.demand_id] || []).push(e);
    });
  }

  function etapasDe(artifactId) { return porArtefato[artifactId] || []; }
  function etapasDaDemanda(demandId) { return porDemanda[demandId] || []; }
  function etapa(id) {
    return st.demandSteps.filter(function (e) { return e.id === id; })[0];
  }
  function marcada(memberId, stepId) { return porEtapa[memberId + '|' + stepId]; }

  /* Artefato sem dono vale para a turma inteira — é a mesma regra que decide o
     que aparece na área do mentorado. */
  function artefatosDe(memberId) {
    return st.artifacts.filter(function (a) {
      return !a.member_id || a.member_id === memberId;
    });
  }

  /* ── tabela ───────────────────────────────────────────────────────────── */
  /* Cabeçalho e linhas dividem a mesma --cols; quem chama declara as colunas
     uma vez e as duas partes não têm como sair de alinhamento. */

  function tabela(cols, cabecalhos, linhas, vazio) {
    return '<div class="tblw"><div class="tbl" style="--cols:' + cols + '">' +
      '<div class="tbl-h">' + cabecalhos.map(function (h) {
        var fim = h.charAt(0) === '>';
        return '<div class="td' + (fim ? ' end' : '') + '">' +
          esc(fim ? h.slice(1) : h) + '</div>';
      }).join('') + '</div>' +
      (linhas || '<div class="tbl-empty">' + esc(vazio) + '</div>') +
    '</div></div>';
  }

  function td(conteudo, classe) {
    return '<div class="td ' + (classe || '') + '"><span class="tx">' + conteudo + '</span></div>';
  }

  /* A célula que abre menu não entra no .tx: a moldura dela é mais alta e mais
     larga que a linha de texto — de propósito, para o texto ficar alinhado com
     as outras colunas — e o overflow do .tx cortava a borda fora. Ela mesma
     encolhe o que não cabe. */
  function tdCel(conteudo, classe) {
    return '<div class="td cel ' + (classe || '') + '">' + conteudo + '</div>';
  }

  function status(cor, texto) {
    return '<span class="dotst" style="color:' + cor + '"><i></i>' + esc(texto) + '</span>';
  }

  /* n/total com barra. Sem total nenhum não há o que medir. */
  function barra(feitas, total) {
    if (!total) return '<span class="tx tx-s">sem checklist</span>';
    var pct = Math.round((feitas / total) * 100);
    return '<span class="bar' + (feitas === 0 ? ' zero' : feitas >= total ? ' full' : '') + '">' +
      '<span class="n">' + feitas + '/' + total + '</span>' +
      '<span class="track"><span class="fill" style="width:' + pct + '%"></span></span></span>';
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
      ? tabelaTarefas(atrasadas)
      : Club.empty('check-circle', 'Nenhuma tarefa atrasada. A turma está em dia.');
  }

  function cardStat(k, v, d) {
    return '<div class="stat"><div class="k">' + esc(k) + '</div>' +
      '<div class="v">' + esc(v) + '</div><div class="d">' + esc(d) + '</div></div>';
  }

  /* ── membros ──────────────────────────────────────────────────────────── */
  /* Uma tela só. O mentorado é a linha-mãe e abre no que está combinado com
     ele: os artefatos, que abrem no próprio checklist, e as tarefas. Cadastro
     e progresso eram a mesma pergunta — "como está fulano?" — feita em dois
     lugares diferentes, e responder exigia ir e voltar entre as duas abas.

     Três níveis, como no ClickUp:

       Mentorado
         └ Artefato → etapa do checklist (padrão do artefato)

     Tarefa não entra aqui: ela é assunto da aba Tarefas e tem outro ciclo — o
     mentorado é quem marca a dele, enquanto a etapa do artefato é entrega do
     Club. Misturar as duas na mesma árvore faria a mesma coluna significar
     coisas diferentes de linha para linha.

     As etapas do artefato são o modelo cadastrado na aba Artefatos; o que está
     marcado é deste mentorado. Ver supabase/progresso.sql. */

  var ARV_COLS = 'minmax(0,2.2fr) 148px 172px 204px 150px';
  var ARV_HEAD = ['Mentorado · artefato · etapa', 'Situação', 'Progresso',
                  'Detalhe', '>Ações'];

  function conta(memberId, artifactId) {
    var feitas = 0, total = 0;
    var artefatos = artifactId
      ? st.artifacts.filter(function (a) { return a.id === artifactId; })
      : artefatosDe(memberId);
    artefatos.forEach(function (a) {
      etapasDe(a.id).forEach(function (e) {
        total++;
        if (marcada(memberId, e.id)) feitas++;
      });
    });
    return { feitas: feitas, total: total };
  }

  /* Artefato sem checklist conta como em aberto: falta definir as etapas, e
     escondê-lo no filtro "concluídos" seria dizer que está pronto. */
  function passaFiltro(c) {
    if (st.arvFiltro === 'done') return c.total > 0 && c.feitas >= c.total;
    if (st.arvFiltro === 'open') return c.total === 0 || c.feitas < c.total;
    return true;
  }

  function ultimaMarcacao(memberId) {
    var datas = st.progress
      .filter(function (p) { return p.member_id === memberId && p.feito_em; })
      .map(function (p) { return p.feito_em; })
      .sort();
    return datas.length ? datas[datas.length - 1] : null;
  }

  /* Chevron de abrir e fechar. Ocupa a mesma caixa mesmo quando não há filho,
     para os títulos não dançarem de linha em linha. */
  function toggleTree(chave, temFilho) {
    if (!temFilho) return '<span class="tg void"></span>';
    return '<button class="tg" data-abrir="' + esc(chave) + '" aria-expanded="' +
      (!!st.abertos[chave]) + '" aria-label="Abrir ou fechar">' +
      ico('chevron-right') + '</button>';
  }

  function renderMembers() {
    $('filtroArvMembro').innerHTML = '<option value="">Todos os mentorados</option>' +
      st.members.map(function (m) {
        return '<option value="' + esc(m.id) + '"' + (m.id === st.arvMembro ? ' selected' : '') +
          '>' + esc(m.nome) + '</option>';
      }).join('');

    Array.prototype.forEach.call($('filtroArvSituacao').children, function (b) {
      b.setAttribute('aria-selected', String(b.dataset.sit === st.arvFiltro));
    });

    var membros = st.members.filter(function (m) {
      return !st.arvMembro || m.id === st.arvMembro;
    });

    /* O rótulo do botão diz o que o clique vai fazer, não o estado atual. */
    var algumFechado = membros.some(function (m) { return !st.abertos['m:' + m.id]; });
    $('btnExpandir').textContent = algumFechado ? 'Abrir tudo' : 'Fechar tudo';

    var geral = { feitas: 0, total: 0 };
    membros.forEach(function (m) {
      var c = conta(m.id);
      geral.feitas += c.feitas; geral.total += c.total;
    });
    var ativos = st.members.filter(function (m) { return m.ativo; }).length;
    var emDia = membros.filter(function (m) {
      var c = conta(m.id);
      return c.total > 0 && c.feitas >= c.total;
    }).length;
    var semChecklist = st.artifacts.filter(function (a) {
      return !etapasDe(a.id).length;
    }).length;

    $('statsMembros').innerHTML =
      cardStat('MEMBROS ATIVOS', ativos, st.members.length - ativos + ' inativos') +
      cardStat('ETAPAS ENTREGUES', geral.feitas + '/' + geral.total,
               geral.total ? Math.round((geral.feitas / geral.total) * 100) + '% do combinado'
                           : 'nenhuma etapa cadastrada') +
      cardStat('MENTORADOS EM DIA', emDia, membros.length + ' no quadro') +
      cardStat('ARTEFATOS SEM CHECKLIST', semChecklist,
               semChecklist ? 'defina as etapas na aba Artefatos' : 'todos com etapas');

    $('listaMembros').innerHTML = tabela(ARV_COLS, ARV_HEAD,
      membros.map(linhaMentorado).join(''),
      st.arvMembro ? 'Este mentorado não tem nada cadastrado.'
                   : 'Nenhum membro cadastrado ainda.');

    if (st.zapEdit) {
      var campo = $('listaMembros').querySelector('[data-zap-inp]');
      if (campo) { campo.focus(); campo.select(); }
    }
  }

  function linhaMentorado(m) {
    var chave = 'm:' + m.id;
    var aberto = !!st.abertos[chave];
    var arts = artefatosDe(m.id).filter(function (a) {
      return passaFiltro(conta(m.id, a.id));
    });
    var c = conta(m.id);
    var ultima = ultimaMarcacao(m.id);
    var completo = c.total > 0 && c.feitas >= c.total;
    var temFilho = arts.length > 0;

    var situacao = !m.ativo
      ? status('var(--faint)', 'Acesso inativo')
      : completo ? status('var(--success)', 'Tudo entregue')
      : c.total ? status('var(--warning)', 'Em andamento')
      : status('var(--faint)', 'Sem etapas');

    var linha = '<div class="tr lv0' + (m.ativo ? '' : ' off') + '">' +
      '<div class="td nm">' + toggleTree(chave, temFilho) +
        '<span class="avatar" style="width:26px;height:26px;font-size:10.5px">' +
          esc(m.iniciais || Club.initials(m.nome)) + '</span>' +
        '<div class="tx"><div class="tx tx-t" title="' + esc(m.nome) + '">' + esc(m.nome) + '</div>' +
        '<div class="tx tx-s">' + esc([m.turma, m.fase].filter(Boolean).join(' · ') ||
          m.email) + '</div></div></div>' +
      td(situacao) +
      td(barra(c.feitas, c.total)) +
      (st.zapEdit === m.id
        /* Enquanto cola o convite, o campo toma as duas últimas colunas: um
           input estreito na coluna de ações escreveria por cima do detalhe. */
        ? '<div class="td zap-cell"><input class="cell-date zap-inp" data-zap-inp="' + m.id +
          '" type="url" value="' + esc(m.whatsapp_url || '') +
          '" placeholder="Cole o convite do grupo — Enter salva, Esc fecha" autocomplete="off"></div>'
        : td('<span class="tx-s">' + esc(arts.length + ' artefato' + (arts.length === 1 ? '' : 's') +
            (c.total ? ' · ' + (c.total - c.feitas) + ' em aberto' : '') +
            (ultima ? ' · ' + Club.fmtDate(ultima) : '')) + '</span>') +
          '<div class="td end"><div class="row-acts">' +
        /* O ícone aparece sempre: verde e clicável quando há grupo, apagado
           quando não há. Assim a lacuna se vê na lista, sem abrir cadastro. */
        (m.whatsapp_url
          ? '<a class="btn btn-sm btn-ghost zap" href="' + esc(m.whatsapp_url) +
            '" target="_blank" rel="noopener noreferrer" title="Abrir o grupo de Operação"' +
            ' aria-label="Abrir o grupo no WhatsApp">' + ico('whatsapp') + '</a>'
          : '<button class="btn btn-sm btn-ghost sem-zap" data-zap="' + m.id +
            '" title="Colar o convite do grupo" aria-label="Cadastrar o grupo dele">' +
            ico('whatsapp') + '</button>') +
        '<a class="btn btn-sm btn-ghost" href="/membros/?membro=' + esc(m.id) +
          '" aria-label="Ver a área dele">' + ico('eye') + '</a>' +
        '<button class="btn btn-sm btn-ghost" data-edit="member" data-id="' + m.id +
          '" aria-label="Editar">' + ico('edit') + '</button>' +
        '<button class="btn btn-sm btn-ghost" data-del="member" data-id="' + m.id +
          '" aria-label="Remover">' + ico('trash') + '</button>' +
      '</div></div>') +
    '</div>';

    if (!aberto || !temFilho) return linha;
    return linha + arts.map(function (a) { return linhaArtefato(m, a); }).join('');
  }

  function linhaArtefato(m, a) {
    var chave = 'a:' + m.id + ':' + a.id;
    var aberto = !!st.abertos[chave];
    var etapas = etapasDe(a.id);
    var c = conta(m.id, a.id);
    var completo = c.total > 0 && c.feitas >= c.total;
    var sa = Club.ART_ST[a.status] || Club.ART_ST['Bloqueado'];

    var linha = '<div class="tr lv1">' +
      '<div class="td nm">' + toggleTree(chave, etapas.length) +
        '<span style="color:var(--gold);font-size:15px;flex-shrink:0">' +
          ico(a.icone || 'box') + '</span>' +
        '<div class="tx"><div class="tx tx-t" title="' + esc(a.nome) + '">' + esc(a.nome) + '</div>' +
        '<div class="tx tx-s">' + (a.member_id ? 'artefato dele' : 'artefato da turma') +
        '</div></div></div>' +
      td(completo ? status('var(--success)', 'Concluído') : status(sa.color, a.status)) +
      td(barra(c.feitas, c.total)) +
      td(etapas.length
        ? '<span class="tx-s">' + (completo
            ? 'nada pendente'
            : (c.total - c.feitas) + ' etapa' + (c.total - c.feitas === 1 ? '' : 's') +
              ' em aberto') + '</span>'
        /* Sem checklist não há o que marcar: o atalho leva direto a quem
           resolve isso, que é o cadastro do artefato. */
        : '<button class="btn btn-sm btn-ghost" data-edit="artifact" data-id="' + a.id +
          '" style="color:var(--gold)">' + ico('plus') + 'Definir etapas</button>') +
      '<div class="td end"><div class="row-acts">' +
        '<button class="btn btn-sm btn-ghost" data-edit="artifact" data-id="' + a.id +
          '" aria-label="Editar artefato e checklist">' + ico('edit') + '</button>' +
      '</div></div>' +
    '</div>';

    if (!aberto || !etapas.length) return linha;
    return linha + etapas.map(function (e) { return linhaEtapa(m, e); }).join('');
  }

  function linhaEtapa(m, e) {
    var p = marcada(m.id, e.id);
    return '<div class="tr lv2' + (p ? ' feito' : '') + '">' +
      '<div class="td nm"><span class="tg void"></span>' +
        '<button class="cbx" data-etapa="' + esc(m.id) + '|' + esc(e.id) + '" aria-pressed="' +
          (!!p) + '" aria-label="Marcar etapa">' + ico('check') + '</button>' +
        '<div class="tx"><div class="tx tx-t" title="' + esc(e.titulo) + '">' + esc(e.titulo) + '</div></div></div>' +
      td(p ? status('var(--success)', 'Entregue') : status('var(--faint)', 'Em aberto')) +
      td('') +
      td('<span class="tx-s">' + (p && p.feito_em
        ? esc('em ' + Club.fmtDataCurta(p.feito_em)) : '—') + '</span>') +
      '<div class="td end"></div>' +
    '</div>';
  }

  /* A marcação vale na tela antes de o banco confirmar: com o checklist aberto
     são muitos cliques seguidos, e esperar a ida e volta a cada um faria a
     coluna piscar. Se o banco recusar, o clique volta atrás e o admin ouve o
     porquê. */
  function marcarEtapa(memberId, stepId) {
    var antes = !!marcada(memberId, stepId);
    aplicaLocal(memberId, stepId, !antes);
    renderMembers();

    Club.data.progress.marcar(memberId, stepId, !antes).then(function (linha) {
      st.progress = st.progress.filter(function (p) {
        return !(p.member_id === memberId && p.step_id === stepId);
      }).concat([linha]);
      indexar();
      renderMembers();
      renderOverview();
    }).catch(function (err) {
      aplicaLocal(memberId, stepId, antes);
      renderMembers();
      Club.toast(err.message || 'Não foi possível marcar a etapa.', 'alert');
    });
  }

  function aplicaLocal(memberId, stepId, feito) {
    var linha = st.progress.filter(function (p) {
      return p.member_id === memberId && p.step_id === stepId;
    })[0];
    if (linha) {
      linha.feito = feito;
      linha.feito_em = feito ? (linha.feito_em || new Date().toISOString()) : null;
    } else {
      st.progress.push({ member_id:memberId, step_id:stepId, feito:feito,
                         feito_em: feito ? new Date().toISOString() : null });
    }
    indexar();
  }

  function abrirTudo(abrir) {
    /* Só mexe nos galhos desta árvore: as demandas têm a própria. */
    Object.keys(st.abertos).forEach(function (k) {
      if (k.charAt(0) !== 'd') delete st.abertos[k];
    });
    if (abrir) {
      st.members.forEach(function (m) {
        if (st.arvMembro && m.id !== st.arvMembro) return;
        st.abertos['m:' + m.id] = true;
        artefatosDe(m.id).forEach(function (a) { st.abertos['a:' + m.id + ':' + a.id] = true; });
      });
    }
    renderMembers();
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
               tier:'BLACK', instagram:'', whatsapp_url:'', ativo:true };
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
        /* O convite do grupo de Operação. A Evolution só entrega o link dos
           grupos em que o número dela é administrador; nos outros, alguém
           gera no WhatsApp e cola aqui. */
        Club.field('Grupo no WhatsApp', 'whatsapp_url', { value:m.whatsapp_url,
          placeholder:'https://chat.whatsapp.com/…',
          hint:'Link de convite do grupo de Operação dele. Aparece na área do mentorado.' }) +
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

    $('listaTarefas').innerHTML = tabelaTarefas(tarefasVisiveis(), st.membro
      ? 'Nenhuma tarefa para este membro com o filtro atual.'
      : 'Nenhuma tarefa cadastrada ainda.');
  }

  function tabelaTarefas(rows, vazio) {
    return tabela(
      'minmax(0,2.2fr) 146px 118px 100px 132px 104px 88px',
      ['Tarefa', 'Mentorado', 'Categoria', 'Cadência', 'Prazo', 'Entregas', '>Ações'],
      rows.map(linhaTarefa).join(''),
      vazio || 'Nada por aqui.');
  }

  function linhaTarefa(t) {
    var tint = Club.TINT[t.categoria] || 'var(--muted)';
    var atrasada = Club.isLate(t);
    var feita = t.status === 'done';
    return '<div class="tr' + (feita ? ' off feito' : '') + '">' +
      '<div class="td"><div class="tx">' +
        '<div class="tx tx-t" title="' + esc(t.titulo) + '">' + esc(t.titulo) + '</div>' +
        (t.descricao ? '<div class="tx tx-s">' + esc(t.descricao) + '</div>' : '') +
      '</div></div>' +
      td(esc(membro(t.member_id) || '—')) +
      td(status(tint, t.categoria || '—')) +
      td('<span class="tx-s">' + esc(t.cadencia || '—') + '</span>') +
      td(feita
        ? status('var(--success)', 'Concluída')
        : '<span style="color:' + (atrasada ? '#F08A8A' : 'inherit') + '">' +
          esc(Club.fmtDue(t.vence_em)) + '</span>') +
      td(t.progresso_total > 0
        ? barra(t.progresso_atual, t.progresso_total)
        : '<span class="tx-s">—</span>', 'num') +
      '<div class="td end">' + acoes('task', t.id) + '</div>' +
    '</div>';
  }

  function modalTarefa(t) {
    var novo = !t;
    t = t || { member_id:st.membro || (st.members[0] || {}).id,
               titulo:'', descricao:'',
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
    $('listaAgenda').innerHTML = tabela(
      'minmax(0,2fr) 146px 176px 112px 150px 88px',
      ['Encontro', 'Quem conduz', 'Quando', 'Formato', 'Para quem', '>Ações'],
      st.events.map(function (e) {
        var p = Club.dateParts(e.inicia_em);
        var passou = Club.parseDate(e.inicia_em) < new Date();
        return '<div class="tr' + (passou ? ' off' : '') + '">' +
          '<div class="td"><div class="tx">' +
            '<div class="tx tx-t" title="' + esc(e.titulo) + '">' + esc(e.titulo) + '</div>' +
            (e.link ? '<div class="tx tx-s">com link da sala</div>' : '') +
          '</div></div>' +
          td(esc(e.mentor || '—')) +
          td('<span style="color:var(--gold);font-weight:600">' + esc(p.day) + ' ' +
            esc(p.month) + '</span> <span class="tx-s">' + esc(p.weekday) + ', ' +
            esc(p.time) + '</span>') +
          td('<span class="tx-s">' + esc(e.formato) + '</span>') +
          td(esc(escopo(e.member_id))) +
          '<div class="td end">' + acoes('event', e.id) + '</div>' +
        '</div>';
      }).join(''),
      'Nenhum encontro agendado ainda.');
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
    $('listaArtefatos').innerHTML = tabela(
      'minmax(0,2fr) 132px 128px 150px minmax(0,1fr) 88px',
      ['Artefato', 'Situação', 'Checklist', 'Para quem', 'Observação', '>Ações'],
      st.artifacts.map(function (a) {
        var s = Club.ART_ST[a.status] || Club.ART_ST['Bloqueado'];
        var n = etapasDe(a.id).length;
        return '<div class="tr">' +
          '<div class="td"><span class="art-i" style="width:28px;height:28px;border-radius:8px;' +
            'font-size:14px;margin:0;flex-shrink:0">' + ico(a.icone || 'box') + '</span>' +
            '<div class="tx"><div class="tx tx-t" title="' + esc(a.nome) + '">' + esc(a.nome) + '</div>' +
            (a.subtitulo ? '<div class="tx tx-s">' + esc(a.subtitulo) + '</div>' : '') +
          '</div></div>' +
          td(status(s.color, a.status)) +
          td(n
            ? n + ' etapa' + (n === 1 ? '' : 's')
            : '<span class="tx-s">sem etapas</span>', 'num') +
          td(esc(escopo(a.member_id))) +
          td('<span class="tx-s">' + esc(a.meta || (a.url ? a.url : '—')) + '</span>') +
          '<div class="td end">' + acoes('artifact', a.id) + '</div>' +
        '</div>';
      }).join(''),
      'Nenhum artefato cadastrado ainda.');
  }

  function modalArtefato(a) {
    a = a || { nome:'', subtitulo:'', icone:'box', status:'Em produção', meta:'',
               url:'', member_id:null };
    var etapasAtuais = a.id ? etapasDe(a.id) : [];
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
          hint:'Com link preenchido, o cartão vira clicável na área do mentorado.' }) +
        Club.field('Etapas padrão', 'etapas', { value:etapasAtuais.map(function (e) {
            return e.titulo; }).join('\n'), textarea:true,
          placeholder:'Briefing aprovado\nCopy escrita\nLayout aprovado\nNo ar',
          hint:'Uma etapa por linha. É este o checklist que aparece em Progresso, ' +
               'para cada mentorado que recebe o artefato. Renomear uma linha mantém ' +
               'o que já estava marcado nela; apagar a linha apaga o progresso dela.' }),
      onSubmit: function (d) {
        if (!d.nome) { Club.toast('O artefato precisa de um nome.', 'alert'); return; }
        d.id = a.id;
        d.member_id = d.member_id || null;

        var titulos = String(d.etapas || '').split('\n')
          .map(function (l) { return l.trim(); })
          .filter(Boolean);

        Club.data.artifacts.save(d).then(function (salvo) {
          /* O artefato novo só ganha id ao ser gravado, e a etapa precisa dele
             para saber de quem é — daí o checklist ir na sequência, não junto. */
          return Club.data.steps.sync(salvo.id, titulos, etapasAtuais);
        }).then(function () {
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

    /* A migração do checklist é posterior ao resto do quadro: quem atualizou o
       site e ainda não rodou o SQL precisa saber por que a coluna está vazia. */
    var avisoCk = Club.faltaChecklistDemanda
      ? '<div class="notice">' + ico('alert') + '<div>' +
        esc(Club.faltaChecklistDemanda) + '</div></div>'
      : '';

    var comChecklist = rows.filter(function (d) { return etapasDaDemanda(d.id).length; });
    $('btnExpandirDem').hidden = !comChecklist.length;
    $('btnExpandirDem').textContent = comChecklist.some(function (d) {
      return !st.abertos['d:' + d.id];
    }) ? 'Abrir tudo' : 'Fechar tudo';

    if (!rows.length) {
      $('listaDemandas').innerHTML = avisoCk + Club.empty('check-circle',
        st.demResp || st.demMembro ? 'Nenhuma demanda com este filtro.'
                                   : 'Nenhuma demanda em aberto. Aproveite.');
      return;
    }

    /* Uma lista só, na mesma leitura da aba Membros: uma linha embaixo da
       outra, com a situação virando coluna. A ordenação já vem do banco por
       situação, prioridade e prazo (ver byDemanda em club-data.js), então as
       situações continuam juntas sem precisar de cabeçalho separando. */
    $('listaDemandas').innerHTML = avisoCk + tabela(
      'minmax(230px,2fr) 132px 96px 140px 124px 116px 116px 104px',
      ['Demanda', 'Situação', 'Prioridade', 'Responsáveis', 'Mentorado',
       'Checklist', 'Prazo', '>Ações'],
      rows.map(linhaDemanda).join(''), '');

    /* O campo de subtarefa é redesenhado a cada render: sem devolver o foco, o
       Enter que salvou uma subtarefa deixaria o time digitando no vazio. */
    if (st.novaSub) {
      var campo = $('listaDemandas').querySelector('[data-sub-inp]');
      if (campo) campo.focus();
    }
    Club.reancorarMenu();
  }

  function linhaDemanda(d) {
    var cor = Club.DEM_COR[d.status];
    var fechada = Club.DEM_ABERTOS.indexOf(d.status) === -1;

    var chave = 'd:' + d.id;
    var etapas = etapasDaDemanda(d.id);
    var feitas = etapas.filter(function (e) { return e.feito; }).length;
    /* De onde veio e o que é: as duas linhas curtas cabem juntas embaixo do
       título e liberam a coluna para o checklist. */
    var sub = [d.origem, d.descricao].filter(Boolean).join(' · ');

    var linha = '<div class="tr' + (fechada ? ' off' : '') + '"' +
      ' style="box-shadow:inset 3px 0 0 ' + cor + '">' +
      '<div class="td nm">' + toggleOuAdd(chave, etapas.length, d.id) +
        '<div class="tx"><div class="tx tx-t" title="' + esc(d.titulo) + '">' + esc(d.titulo) + '</div>' +
        (sub ? '<div class="tx tx-s">' + esc(sub) + '</div>' : '') +
      '</div></div>' +
      colunasDe(d, 'd') +
      td(etapas.length ? barra(feitas, etapas.length)
                       : '<span class="tx-s">sem checklist</span>') +
      celulaPrazo(d, 'd') +
      '<div class="td end"><div class="row-acts">' +
        (fechada
          ? '<button class="btn btn-sm btn-ghost" data-reabrir="' + d.id +
            '" aria-label="Reabrir">' + ico('refresh') + '</button>'
          : '<button class="btn btn-sm btn-ghost" data-concluir="' + d.id +
            '" aria-label="Concluir">' + ico('check') + '</button>') +
        '<button class="btn btn-sm btn-ghost" data-edit="demand" data-id="' + d.id +
          '" aria-label="Editar">' + ico('edit') + '</button>' +
        '<button class="btn btn-sm btn-ghost" data-del="demand" data-id="' + d.id +
          '" aria-label="Remover">' + ico('trash') + '</button>' +
      '</div></div>' +
    '</div>';

    /* A demanda sem checklist nenhum também precisa abrir: é do "+" dela que a
       primeira subtarefa nasce, e sem isto o campo não teria onde aparecer. */
    if (st.novaSub !== d.id && (!st.abertos[chave] || !etapas.length)) return linha;
    var filhos = st.abertos[chave] ? etapas.map(linhaSubtarefa).join('') : '';
    return linha + filhos + linhaNovaSub(d.id);
  }

  /* Célula que abre menu no clique. Fica invisível como controle até o mouse
     chegar: a tabela precisa continuar legível como tabela. A chave carrega o
     escopo — 'd' para a demanda, 's' para a subtarefa. */
  function celula(tipo, id, conteudo, vazia) {
    return '<button class="cell' + (vazia ? ' vazio' : '') + '" data-cell="' + tipo +
      '" data-id="' + id + '" data-menu-id="' + tipo + ':' + id +
      '" aria-haspopup="menu" aria-expanded="false">' + conteudo + '</button>';
  }

  /* As colunas do meio são as mesmas nas duas alturas: um pedaço de demanda
     também tem situação, dono, mentorado e prazo — dividir sem poder dizer quem
     toca cada pedaço só muda o problema de lugar. Um helper para as duas é o
     que impede a subtarefa de virar parente pobre quando uma coluna mudar. */
  function colunasDe(r, escopo) {
    var cor = Club.DEM_COR[r.status] || 'var(--faint)';
    var prio = Club.DEM_PRIO_COR[r.prioridade] || 'var(--muted)';

    return tdCel(celula(escopo + '.status', r.id, status(cor, r.status || '—'))) +
      tdCel(celula(escopo + '.prio', r.id, status(prio, r.prioridade || '—'))) +
      tdCel(celula(escopo + '.resp', r.id,
        '<span class="tx">' + esc(responsaveisDe(r)) + '</span>',
        !r.responsaveis || !r.responsaveis.length)) +
      tdCel(celula(escopo + '.membro', r.id, '<span class="tx">' +
        (r.member_id ? esc(membro(r.member_id) || '—') : 'interna') + '</span>',
        !r.member_id));
  }

  /* O prazo é o único sem lista fechada, então não é menu: a célula vira o
     calendário do navegador. Vermelho só vale para quem ainda está em aberto —
     prazo passado de coisa concluída não é atraso, é história. */
  function celulaPrazo(r, escopo) {
    var n = Club.diffDays(r.vence_em);
    var atrasada = n !== null && n < 0 && Club.DEM_ABERTOS.indexOf(r.status) !== -1;
    return tdCel('<button class="cell' + (r.vence_em ? '' : ' vazio') +
      '" data-prazo="' + escopo + ':' + r.id + '">' +
      '<span class="tx"' + (atrasada ? ' style="color:#F08A8A"' : '') + '>' +
      esc(r.vence_em ? Club.fmtDue(r.vence_em) : 'sem prazo') + '</span></button>');
  }

  /* Sem checklist ainda, o lugar do chevron guarda o "+": é de lá que a lista
     vai brotar. Com checklist, quem acrescenta é a última linha dele. */
  function toggleOuAdd(chave, temFilho, demandId) {
    if (temFilho) return toggleTree(chave, true);
    return '<button class="tg add" data-add-sub="' + demandId +
      '" aria-label="Acrescentar subtarefa">' + ico('plus') + '</button>';
  }

  /* Esta linha não tem coluna para preencher: nem situação, nem prazo, nem dono.
     Então o nome atravessa a largura toda — é o que dá espaço de digitar. */
  function linhaNovaSub(demandId) {
    var dentro = st.novaSub === demandId
      ? '<input class="sub-inp" data-sub-inp="' + demandId + '" ' +
        'placeholder="O que falta fazer? Enter salva, Esc fecha." autocomplete="off">'
      : '<button class="add-sub" data-add-sub="' + demandId + '">' + ico('plus') +
        'Acrescentar subtarefa</button>';

    return '<div class="tr lv1 nova">' +
      '<div class="td nm"><span class="tg void"></span>' + dentro + '</div>' +
      '<div class="td end"></div>' +
    '</div>';
  }

  /* Subtarefa da demanda: mesmas colunas, mesmas listas, mesmo jeito de trocar.
     A única que fica vazia é Checklist — a subtarefa não abre outro nível, e
     nesta coluna a barra da mãe já conta a história dela. */
  function linhaSubtarefa(e) {
    return '<div class="tr lv1' + (e.feito ? ' feito' : '') + '">' +
      '<div class="td nm"><span class="tg void"></span>' +
        '<button class="cbx" data-sub="' + esc(e.id) + '" aria-pressed="' + (!!e.feito) +
          '" title="' + (e.feito && e.feito_em
            ? esc('Feito em ' + Club.fmtDataCurta(e.feito_em))
            : 'Marcar como concluída') + '"' +
          ' aria-label="Marcar subtarefa">' + ico('check') + '</button>' +
        '<div class="tx"><div class="tx tx-t" title="' + esc(e.titulo) + '">' +
          esc(e.titulo) + '</div></div></div>' +
      colunasDe(e, 's') +
      td('') +
      celulaPrazo(e, 's') +
      '<div class="td end"><div class="row-acts">' +
        '<button class="btn btn-sm btn-ghost" data-del-sub="' + e.id +
          '" aria-label="Remover subtarefa">' + ico('trash') + '</button>' +
      '</div></div>' +
    '</div>';
  }

  /* A caixinha é atalho para a coluna Situação, não um segundo lugar onde o
     "pronto" mora: marcar fecha, desmarcar devolve para A fazer. No banco é a
     mesma regra — o feito sai do status (ver supabase/demandas.sql). */
  function marcarSubtarefa(id) {
    var e = etapa(id);
    if (!e) return;
    salvarEtapa(id, { status: e.feito ? 'A fazer' : 'Concluída' });
  }

  /* ── edição na própria linha ───────────────────────────────────────────
     Uma demanda troca de situação, de dono e de prazo o dia inteiro. Abrir o
     formulário para cada troca custa três cliques e tira o time da lista; aqui
     a coluna é o controle. Título e descrição continuam no formulário: são
     texto livre, e texto livre pede espaço. */

  /* A célula não precisa saber de quem é: a chave traz o escopo e o resto é
     igual nas duas alturas — mesmas listas, mesmo salvamento otimista. */
  function menuDaCelula(el) {
    var par = el.dataset.cell.split('.');
    var sub = par[0] === 's';
    var r = sub ? etapa(el.dataset.id) : achar('demand', el.dataset.id);
    if (!r) return;
    var salvar = sub ? salvarEtapa : salvarDemanda;

    if (par[1] === 'status') {
      Club.menu(el, Club.DEM_STATUS.map(function (v) {
        return { value:v, label:v, color:Club.DEM_COR[v], checked:v === r.status };
      }), { titulo:'Situação', onPick:function (v) {
        salvar(r.id, { status:v });
      } });
      return;
    }

    if (par[1] === 'prio') {
      Club.menu(el, Club.DEM_PRIORIDADES.map(function (v) {
        return { value:v, label:v, color:Club.DEM_PRIO_COR[v], checked:v === r.prioridade };
      }), { titulo:'Prioridade', onPick:function (v) {
        salvar(r.id, { prioridade:v });
      } });
      return;
    }

    if (par[1] === 'membro') {
      Club.menu(el, [{ value:'', label:'Nenhum — demanda interna', checked:!r.member_id }]
        .concat(st.members.map(function (m) {
          return { value:m.id, label:m.nome, checked:m.id === r.member_id };
        })), { titulo:'Sobre qual mentorado', onPick:function (v) {
          salvar(r.id, { member_id: v || null });
        } });
      return;
    }

    if (par[1] === 'resp') {
      var ativos = st.staff.filter(function (p) { return p.ativo; });
      if (!ativos.length) {
        Club.toast('Cadastre a equipe antes — botão Equipe.', 'alert');
        return;
      }
      Club.menu(el, ativos.map(function (p) {
        return { value:p.id, label:p.nome,
                 checked:(r.responsaveis || []).indexOf(p.id) !== -1 };
      }), { titulo:'Responsáveis', multi:true, onPick:function (v, item) {
        var lista = (r.responsaveis || []).slice();
        var i = lista.indexOf(v);
        if (item.checked && i === -1) lista.push(v);
        if (!item.checked && i !== -1) lista.splice(i, 1);
        salvar(r.id, { responsaveis: lista });
      } });
    }
  }

  /* O prazo é o único campo sem lista fechada: a célula vira o calendário do
     navegador e volta a ser texto assim que o valor é escolhido. */
  function editarPrazo(el) {
    var par = el.dataset.prazo.split(':');
    var sub = par[0] === 's';
    var id = par[1];
    var r = sub ? etapa(id) : achar('demand', id);
    if (!r) return;
    var salvar = sub ? salvarEtapa : salvarDemanda;

    var inp = document.createElement('input');
    inp.type = 'date';
    inp.className = 'cell-date';
    inp.value = r.vence_em || '';
    el.replaceWith(inp);
    inp.focus();
    if (inp.showPicker) { try { inp.showPicker(); } catch (err) { /* sem picker */ } }

    var encerrado = false;
    function fim(gravar) {
      if (encerrado) return;
      encerrado = true;
      if (gravar && inp.value !== (r.vence_em || '')) {
        salvar(id, { vence_em: inp.value || null });
      } else {
        renderDemandas();
      }
    }
    inp.addEventListener('change', function () { fim(true); });
    inp.addEventListener('blur',   function () { fim(true); });
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') fim(false);
      if (ev.key === 'Enter')  fim(true);
    });
  }

  /* Vale na tela antes de o banco confirmar, como o resto do quadro. */
  function salvarDemanda(id, patch) {
    var d = achar('demand', id);
    if (!d) return;
    var antes = {};
    Object.keys(patch).forEach(function (k) { antes[k] = d[k]; });
    Object.assign(d, patch);
    st.demands = Club.data.demands.ordenar(st.demands);
    renderDemandas();

    Club.data.demands.save(Object.assign({ id:id }, patch)).then(function (linha) {
      st.demands = Club.data.demands.ordenar(st.demands.map(function (x) {
        return x.id === id ? linha : x;
      }));
      renderDemandas();
      renderOverview();
    }).catch(function (err) {
      Object.assign(d, antes);
      st.demands = Club.data.demands.ordenar(st.demands);
      renderDemandas();
      Club.toast(err.message || 'Não foi possível salvar.', 'alert');
    });
  }

  /* Mesma edição otimista da demanda: o time troca dono e prazo de subtarefa na
     mesma velocidade, e a lista não pode piscar a cada clique. */
  function salvarEtapa(id, patch) {
    var e = etapa(id);
    if (!e) return;
    var antes = { feito:e.feito, feito_em:e.feito_em };
    Object.keys(patch).forEach(function (k) { antes[k] = e[k]; });
    Object.assign(e, patch);

    /* O banco deriva o feito do status; a tela faz a mesma conta para riscar a
       linha sem esperar a resposta. */
    if (patch.status !== undefined) {
      e.feito = Club.DEM_ABERTOS.indexOf(patch.status) === -1;
      e.feito_em = e.feito ? (e.feito_em || new Date().toISOString()) : null;
    }
    renderDemandas();

    Club.data.demandSteps.save(Object.assign({ id:id }, patch)).then(function (linha) {
      st.demandSteps = st.demandSteps.map(function (x) { return x.id === id ? linha : x; });
      indexar();
      renderDemandas();
    }).catch(function (err) {
      Object.assign(e, antes);
      renderDemandas();
      Club.toast(err.message || 'Não foi possível salvar a subtarefa.', 'alert');
    });
  }

  /* Cadastrar trinta convites pelo formulário seria trinta vezes abrir, rolar e
     fechar. Aqui o ícone abre um campo na própria linha: cola, Enter, próximo. */
  function abrirGrupo(id) {
    st.zapEdit = id;
    renderMembers();
  }

  function fecharGrupo(gravar) {
    var inp = document.querySelector('[data-zap-inp]');
    if (!inp || !inp.dataset.zapInp) return;
    var id = inp.dataset.zapInp;
    var url = inp.value.trim();
    var m = achar('member', id);
    inp.dataset.zapInp = '';
    st.zapEdit = null;

    if (gravar && m && url !== (m.whatsapp_url || '')) salvarMembro(id, { whatsapp_url: url || null });
    else renderMembers();
  }

  /* Otimista como o resto do quadro: vale na tela antes de o banco confirmar. */
  function salvarMembro(id, patch) {
    var m = achar('member', id);
    if (!m) return;
    var antes = {};
    Object.keys(patch).forEach(function (k) { antes[k] = m[k]; });
    Object.assign(m, patch);
    renderMembers();

    Club.data.members.save(Object.assign({ id:id }, patch)).then(function (linha) {
      st.members = st.members.map(function (x) { return x.id === id ? linha : x; });
      renderMembers();
    }).catch(function (err) {
      Object.assign(m, antes);
      renderMembers();
      Club.toast(err.message || 'Não foi possível salvar o grupo.', 'alert');
    });
  }

  /* ── subtarefas na linha ──────────────────────────────────────────────── */

  function abrirNovaSub(demandId) {
    st.abertos['d:' + demandId] = true;
    st.novaSub = demandId;
    renderDemandas();
  }

  /* Desliga o campo antes de redesenhar: sem isso o focusout do campo velho
     chegaria depois do Enter e salvaria a mesma subtarefa duas vezes. */
  function fecharNovaSub(salvar) {
    var inp = document.querySelector('[data-sub-inp]');
    if (!inp || !inp.dataset.subInp) return;
    var demandId = inp.dataset.subInp;
    var titulo = inp.value.trim();
    inp.dataset.subInp = '';

    if (salvar && titulo) {
      salvarSubtarefa(demandId, titulo);
      return;
    }
    st.novaSub = null;
    renderDemandas();
  }

  function salvarSubtarefa(demandId, titulo) {
    var mae = achar('demand', demandId);
    Club.data.demandSteps.save({
      demand_id: demandId, titulo: titulo,
      ordem: etapasDaDemanda(demandId).length,
      /* O mentorado é o único campo que já se sabe: um pedaço da demanda da
         Cíntia é sobre a Cíntia. Dono, prazo e prioridade quem diz é o time. */
      member_id: mae ? mae.member_id : null
    }).then(function (linha) {
      st.demandSteps = st.demandSteps.concat([linha]);
      indexar();
      /* Continua aberta: quem cadastra checklist cadastra vários de uma vez. */
      renderDemandas();
    }).catch(function (err) {
      st.novaSub = null;
      renderDemandas();
      Club.toast(err.message || 'Não foi possível criar a subtarefa.', 'alert');
    });
  }

  function removerSubtarefa(id) {
    var e = etapa(id);
    if (!e) return;
    Club.modal.confirm('Remover?', '"' + e.titulo + '" sai do checklist. Não dá para desfazer.',
      function () {
        Club.data.demandSteps.remove(id).then(function () {
          st.demandSteps = st.demandSteps.filter(function (x) { return x.id !== id; });
          indexar();
          renderDemandas();
        }).catch(aviso);
      });
  }

  function abrirDemandas(abrir) {
    Object.keys(st.abertos).forEach(function (k) {
      if (k.charAt(0) === 'd') delete st.abertos[k];
    });
    if (abrir) {
      demandasVisiveis().forEach(function (d) {
        if (etapasDaDemanda(d.id).length) st.abertos['d:' + d.id] = true;
      });
    }
    renderDemandas();
  }

  function modalDemanda(d) {
    var novo = !d;
    d = d || { titulo:'', descricao:'', status:'A fazer', prioridade:'Média',
               responsaveis:[], member_id:null, origem:'', vence_em:'' };
    var subAtuais = d.id ? etapasDaDemanda(d.id) : [];

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
          d.member_id || '') +
        Club.field('Subtarefas', 'subtarefas', { value:subAtuais.map(function (e) {
            return e.titulo; }).join('\n'), textarea:true,
          placeholder:'Número liberado pela operadora\nAPI conectada\nFluxo testado',
          hint:'Uma por linha. Elas viram o checklist que abre dentro da demanda, ' +
               'para o time marcar o que já saiu. Renomear uma linha mantém a marca; ' +
               'apagar a linha apaga a marca junto.' }),

      onSubmit: function (dados) {
        if (!dados.titulo) { Club.toast('A demanda precisa de um título.', 'alert'); return; }
        dados.id = d.id;
        dados.member_id = dados.member_id || null;
        dados.responsaveis = dados.responsaveis || [];

        var titulos = String(dados.subtarefas || '').split('\n')
          .map(function (l) { return l.trim(); })
          .filter(Boolean);

        Club.data.demands.save(dados).then(function (salva) {
          /* A demanda nova só ganha id ao ser gravada, e a subtarefa precisa
             dele para saber de quem é. */
          return Club.data.demandSteps.sync(salva.id, titulos, subAtuais);
        }).then(function () {
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

    $('listaMateriais').innerHTML = tabela(
      'minmax(0,2fr) 124px 134px 112px 146px 122px',
      ['Material', 'Categoria', 'Arquivo', 'Publicado', 'Alcance', '>Ações'],
      materiaisVisiveis().map(function (m) {
        return '<div class="tr">' +
          '<div class="td"><span class="art-i" style="width:28px;height:28px;border-radius:8px;' +
            'font-size:14px;margin:0;flex-shrink:0">' +
            ico(Club.MAT_ICONE[m.categoria] || 'file-text') + '</span>' +
            '<div class="tx"><div class="tx tx-t" title="' + esc(m.titulo) + '">' + esc(m.titulo) + '</div>' +
            (m.descricao ? '<div class="tx tx-s">' + esc(m.descricao) + '</div>' : '') +
          '</div></div>' +
          td('<span class="tx-s">' + esc(m.categoria) + '</span>') +
          td(esc(Club.fmtExt(m.arquivo_nome)) + ' <span class="tx-s">' +
            esc(Club.fmtBytes(m.arquivo_bytes)) + '</span>', 'num') +
          td('<span class="tx-s">' + esc(Club.fmtDataCurta(m.publicado_em)) + '</span>', 'num') +
          td(esc(alcance(m))) +
          '<div class="td end"><div class="row-acts">' +
            '<button class="btn btn-sm btn-ghost" data-baixar="' + m.id +
              '" aria-label="Baixar">' + ico('download') + '</button>' +
            '<button class="btn btn-sm btn-ghost" data-edit="material" data-id="' + m.id +
              '" aria-label="Editar">' + ico('edit') + '</button>' +
            '<button class="btn btn-sm btn-ghost" data-del="material" data-id="' + m.id +
              '" aria-label="Remover">' + ico('trash') + '</button>' +
          '</div></div>' +
        '</div>';
      }).join(''),
      st.matCategoria || st.matMembro
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
    demand:    { store:'demands',    nome:function (r) { return r.titulo; },
                 aviso:'As subtarefas dela saem junto.' },
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

    /* Um galho só: a chave diz de qual árvore ele é ('d:' é demanda). */
    var galho = e.target.closest('[data-abrir]');
    if (galho) {
      var k = galho.dataset.abrir;
      st.abertos[k] = !st.abertos[k];
      if (k.charAt(0) === 'd') renderDemandas(); else renderMembers();
      return;
    }

    var etapa = e.target.closest('[data-etapa]');
    if (etapa) {
      var par = etapa.dataset.etapa.split('|');
      marcarEtapa(par[0], par[1]);
      return;
    }

    var sub = e.target.closest('[data-sub]');
    if (sub) { marcarSubtarefa(sub.dataset.sub); return; }

    /* A coluna é o controle: clicar na célula troca o valor sem abrir o
       formulário. Precisa vir antes de nada que pegue a linha inteira. */
    var cel = e.target.closest('[data-cell]');
    if (cel) { menuDaCelula(cel); return; }

    var prazo = e.target.closest('[data-prazo]');
    if (prazo) { editarPrazo(prazo); return; }

    var zap = e.target.closest('[data-zap]');
    if (zap) { abrirGrupo(zap.dataset.zap); return; }

    var maisSub = e.target.closest('[data-add-sub]');
    if (maisSub) { abrirNovaSub(maisSub.dataset.addSub); return; }

    var subFora = e.target.closest('[data-del-sub]');
    if (subFora) { removerSubtarefa(subFora.dataset.delSub); return; }

    var exp = e.target.closest('[data-expandir]');
    if (exp) {
      abrirTudo(st.members.some(function (m) {
        return (!st.arvMembro || m.id === st.arvMembro) && !st.abertos['m:' + m.id];
      }));
      return;
    }

    var expD = e.target.closest('[data-expandir-dem]');
    if (expD) {
      abrirDemandas(demandasVisiveis().some(function (d) { return !st.abertos['d:' + d.id]; }));
      return;
    }

    var sit = e.target.closest('#filtroArvSituacao button');
    if (sit) { st.arvFiltro = sit.dataset.sit; renderMembers(); return; }
  });

  /* Enter salva e o campo continua de pé para o próximo item; Esc desiste;
     sair do campo confirma o que já estava escrito. */
  document.addEventListener('keydown', function (e) {
    if (!e.target.matches) return;
    if (e.target.matches('[data-sub-inp]')) {
      if (e.key === 'Enter')  { e.preventDefault(); fecharNovaSub(true); }
      if (e.key === 'Escape') { e.preventDefault(); fecharNovaSub(false); }
    }
    if (e.target.matches('[data-zap-inp]')) {
      if (e.key === 'Enter')  { e.preventDefault(); fecharGrupo(true); }
      if (e.key === 'Escape') { e.preventDefault(); fecharGrupo(false); }
    }
  });

  document.addEventListener('focusout', function (e) {
    if (!e.target.matches) return;
    if (e.target.matches('[data-sub-inp]')) fecharNovaSub(true);
    if (e.target.matches('[data-zap-inp]')) fecharGrupo(true);
  });

  $('filtroArvMembro').addEventListener('change', function () {
    st.arvMembro = this.value;
    renderMembers();
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
