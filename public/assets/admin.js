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
             groups: [], artGrupo: '', progressNotes: [], notasEdit: {},
             view: 'overview', membro: '', status: 'all', igOrdem: 'seguidores',
             matCategoria: '', matMembro: '',
             demResp: '', demMembro: '', demProjeto: '', demAbertas: 'open',
             /* "Minhas" é a leitura padrão do quadro: quem abre vê o que é seu,
                agrupado por projeto. "eu" é a pessoa da equipe ligada ao login
                (staff.user_id) ou, enquanto a migração não roda, a escolhida no
                próprio botão e guardada neste navegador. */
             demVisao: 'minhas', demAgrupar: 'projeto', eu: null, temProjeto: true,
             grpFechado: {},
             arvMembro: '', arvFiltro: 'all',
             /* Demanda que está com a linha de nova subtarefa aberta. */
             novaSub: null, zapEdit: null, edicaoSub: {},
             /* Quais galhos das árvores (membros e demandas) estão abertos.
                Fica na tela, não no banco: é postura de leitura do momento. */
             abertos: {} };

  /* A navegação é uma árvore de um nível: quem é solto fica solto, quem tem
     'itens' vira um grupo com título. Agenda e Materiais moram em Mentorados
     porque são o que o mentorado consome; Artefatos mora em Time porque é o
     que o time produz. A chave de cada view continua a mesma — só o rótulo de
     'members' mudou para Progressão. */
  var NAV = [
    { key:'overview', label:'Visão geral', icon:'home' },
    { grupo:'Mentorados', itens: [
      { key:'members',   label:'Progressão', icon:'users' },
      { key:'graduacao', label:'Graduação', icon:'award' },
      { key:'tasks',     label:'Tarefas',    icon:'check-square' },
      { key:'agenda',    label:'Agenda',     icon:'calendar' },
      { key:'materials', label:'Materiais',  icon:'folder' }
    ] },
    { grupo:'Instagram', itens: [
      { key:'igMetricas',  label:'Alcance',         icon:'users' },
      { key:'botFila',     label:'O bot respondeu', icon:'bell' },
      { key:'botExemplos', label:'Voz do bot',      icon:'edit' }
    ] },
    { grupo:'Time', itens: [
      { key:'demands',   label:'Demandas',   icon:'check-circle' },
      { key:'artifacts', label:'Artefatos',  icon:'box' }
    ] }
  ];

  /* A barra do celular é uma fila de chips: não comporta hierarquia, então lê
     a mesma árvore achatada, na mesma ordem. */
  function navPlano() {
    return NAV.reduce(function (acc, n) {
      return acc.concat(n.itens || [n]);
    }, []);
  }

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
      Club.data.demandSteps.list(),
      Club.data.botExemplos.list(),
      Club.data.botRespostas.list(),
      Club.data.instagram.resumo(),
      Club.data.instagram.serie(45),
      Club.data.groups.list(),
      Club.data.progressNotes.list()
    ]).then(function (r) {
      st.members = r[0]; st.tasks = r[1]; st.events = r[2];
      st.artifacts = r[3]; st.materials = r[4];
      st.demands = r[5]; st.staff = r[6];
      st.steps = r[7]; st.progress = r[8]; st.demandSteps = r[9];
      st.botExemplos = r[10]; st.botRespostas = r[11];
      st.igResumo = r[12]; st.igSerie = r[13];
      st.groups = r[14];
      st.progressNotes = r[15];
      indexar();
      descobrirEu();
    });
  }

  /* ── quem sou eu no quadro ─────────────────────────────────────────────
     Primeiro pelo vínculo do banco (staff.user_id = login). Sem vínculo, vale a
     escolha feita no botão "Minhas" e guardada no localStorage: é o que deixa o
     quadro funcionar hoje, antes de o SQL de 02/09 rodar. A coluna "projeto"
     segue a mesma regra: se o banco ainda não a tem, o painel agrupa só por
     mentorado e esconde o campo, em vez de quebrar a gravação. */
  var CHAVE_EU = 'ob-admin-eu';

  /* Leitura da aba Demandas guardada no navegador, por login: visão, agrupamento,
     filtros e quais grupos estão fechados. Quem volta ao quadro encontra a
     leitura que deixou, sem mexer em filtro de novo (pedido da equipe 02/09). */
  var CHAVE_DEM = 'ob-admin-dem';
  var PREFS_DEM = ['demVisao', 'demAgrupar', 'demAbertas', 'demResp', 'demMembro', 'demProjeto', 'grpFechado'];

  function chaveDem() {
    return CHAVE_DEM + ':' + (sessao && sessao.email ? String(sessao.email).toLowerCase() : 'anon');
  }

  function carregarPrefsDem() {
    var raw = null;
    try { raw = localStorage.getItem(chaveDem()); } catch (err) { /* sem storage */ }
    if (!raw) return;
    try {
      var p = JSON.parse(raw);
      PREFS_DEM.forEach(function (k) { if (k in p && p[k] !== undefined) st[k] = p[k]; });
    } catch (err) { /* guardado velho ou corrompido: ignora */ }
    if (!st.grpFechado || typeof st.grpFechado !== 'object') st.grpFechado = {};
    if (!st.eu) st.demVisao = 'todas';
  }

  function salvarPrefsDem() {
    var p = {};
    PREFS_DEM.forEach(function (k) { p[k] = st[k]; });
    try { localStorage.setItem(chaveDem(), JSON.stringify(p)); } catch (err) { /* sem storage */ }
  }

  /* Login → sigla da equipe. É o vínculo que staff.user_id faria no banco; fica
     aqui até a migração rodar (e continua valendo como reserva depois). Trocar
     de e-mail = editar esta lista. */
  var EU_POR_EMAIL = {
    'felipentys@gmail.com':       'FM',
    'italomontepro@gmail.com':    'IM',
    'pedrolarry.jj@gmail.com':    'PL',
    'felipejoao.nm@gmail.com':    'JF',
    'thomasads.trafego@gmail.com':'TA'
  };

  function descobrirEu() {
    st.temProjeto = !!st.demands.length && ('projeto' in st.demands[0]);
    var porLogin = st.staff.filter(function (p) {
      return p.user_id && sessao && p.user_id === sessao.userId;
    })[0];
    var sigla = sessao && EU_POR_EMAIL[String(sessao.email || '').toLowerCase()];
    if (!porLogin && sigla) {
      porLogin = st.staff.filter(function (p) { return p.apelido === sigla; })[0];
    }
    var guardado = null;
    try { guardado = localStorage.getItem(CHAVE_EU); } catch (err) { /* sem storage */ }
    var porEscolha = st.staff.filter(function (p) { return p.id === guardado; })[0];
    st.eu = porLogin || porEscolha || null;
    if (!st.eu) st.demVisao = 'todas';
    carregarPrefsDem();
  }

  function escolherEu(anchor) {
    var ativos = st.staff.filter(function (p) { return p.ativo; });
    Club.menu(anchor, ativos.map(function (p) {
      return { value:p.id, label:p.nome, checked:!!(st.eu && st.eu.id === p.id) };
    }), { titulo:'Quem é você no quadro?', onPick:function (v) {
      st.eu = ativos.filter(function (p) { return p.id === v; })[0] || null;
      try { localStorage.setItem(CHAVE_EU, v); } catch (err) { /* sem storage */ }
      st.demVisao = 'minhas';
      renderDemandas();
    } });
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
  var porArtefato = {}, porEtapa = {}, porDemanda = {}, porNota = {};

  function indexar() {
    porArtefato = {}; porEtapa = {}; porDemanda = {}; porNota = {};
    st.progressNotes.forEach(function (n) { porNota[n.member_id + '|' + n.alvo] = n; });
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

  /* Quantas marcações (e de quantos mentorados) uma lista de etapas carrega.
     É o número que decide se mexer no checklist é seguro. */
  function marcasDe(etapas) {
    var ids = {}; etapas.forEach(function (e) { ids[e.id] = true; });
    var n = 0, membros = {};
    st.progress.forEach(function (p) {
      if (p.feito && ids[p.step_id]) { n++; membros[p.member_id] = true; }
    });
    return { marcas: n, mentorados: Object.keys(membros).length };
  }

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
    function botao(n, filho) {
      return '<button class="nav' + (filho ? ' nav-filho' : '') + '" role="tab" data-nav="' +
        n.key + '" aria-selected="' + (n.key === st.view) + '">' +
        ico(n.icon) + '<span>' + esc(n.label) + '</span></button>';
    }

    $('rail').innerHTML =
      '<div class="rail-lbl">ADMINISTRAÇÃO</div>' +
      NAV.map(function (n) {
        if (!n.itens) return botao(n, false);
        return '<div class="rail-lbl rail-grupo">' + esc(n.grupo) + '</div>' +
          n.itens.map(function (f) { return botao(f, true); }).join('');
      }).join('') +
      '<div class="rail-foot"><div class="k">' + st.members.length + ' MEMBROS</div>' +
      '<div class="v">' + st.tasks.filter(function (t) { return t.status !== 'done'; }).length +
      ' tarefas em aberto agora.</div></div>';

    $('navm').innerHTML = navPlano().map(function (n) {
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

  /* `dica` é opcional: quando existe, o cartão explica ao passar o mouse o que
     aquele número quer dizer. Número sem definição vira discussão na reunião. */
  function cardStat(k, v, d, dica) {
    return '<div class="stat' + (dica ? ' tem-dica' : '') + '"' +
      (dica ? ' data-dica="' + esc(dica) + '"' : '') + '>' +
      '<div class="k">' + esc(k) + '</div>' +
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

  var ARV_COLS = 'minmax(300px,2.2fr) 148px 200px 120px 180px 150px';
  var ARV_HEAD = ['Mentorado · artefato · etapa', 'Situação', 'Observação', 'Progresso',
                  'Detalhe', '>Ações'];

  /* Estado do par (mentorado, artefato): Club.par decide aceite, denominador,
     próxima etapa e estado. A mesma função roda na área do mentorado. */
  function contaPar(memberId, a) {
    return Club.par(etapasDe(a.id), function (id) { return !!marcada(memberId, id); });
  }

  /* Grupo do artefato e ordem de leitura: grupo, depois ordem cadastrada. */
  function grupoDe(a) {
    return st.groups.filter(function (g) { return g.id === a.group_id; })[0] || null;
  }
  function porGrupoOrdem(a, b) {
    var ga = grupoDe(a), gb = grupoDe(b);
    return ((ga ? ga.ordem : 999) - (gb ? gb.ordem : 999)) ||
      ((a.ordem || 0) - (b.ordem || 0)) ||
      String(a.nome).localeCompare(String(b.nome), 'pt-BR');
  }

  /* Do mentorado: só os pares aceitos contam. Barra = soma das entregas de
     implantação; o percentual médio é dos artefatos, cada um pesando 1. */
  function contaMembro(memberId) {
    var r = { feitas:0, total:0, aceitos:0, definir:0, travados:0, equipe:0, noar:0, pcts:[] };
    artefatosDe(memberId).forEach(function (a) {
      var p = contaPar(memberId, a);
      if (p.estado === 'definir') { r.definir++; return; }
      r.aceitos++; r.feitas += p.feitas; r.total += p.total;
      if (p.estado === 'travado') r.travados++;
      else if (Club.NO_AR[p.estado]) r.noar++;
      else r.equipe++;
      if (p.total || p.rotinas.length) r.pcts.push(p.completo ? 100 : p.pct);
    });
    r.pct = r.pcts.length
      ? Math.round(r.pcts.reduce(function (s, x) { return s + x; }, 0) / r.pcts.length) : 0;
    return r;
  }

  /* Par "A definir" só aparece em "Tudo"; em todos os outros filtros ele não
     é pendência de ninguém. Sem checklist conta como em aberto: falta definir
     as etapas, e escondê-lo em "No ar" seria dizer que está pronto. */
  function passaFiltro(p) {
    switch (st.arvFiltro) {
      case 'open':    return p.estado === 'nao_iniciado' || p.estado === 'travado' ||
                             p.estado === 'implantacao' || p.estado === 'sem_criterio';
      case 'equipe':  return p.estado === 'nao_iniciado' || p.estado === 'implantacao' ||
                             p.estado === 'sem_criterio';
      case 'travado': return p.estado === 'travado';
      case 'done':    return !!Club.NO_AR[p.estado];
      default:        return true;
    }
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
    var quadroAnterior = $('listaMembros').querySelector('.tblw');
    var scrollAnterior = quadroAnterior ? quadroAnterior.scrollLeft : 0;
    var ativo = document.activeElement;
    var focoNota = ativo && ativo.matches('[data-nota-texto]')
      ? { chave:ativo.dataset.notaTexto, inicio:ativo.selectionStart, fim:ativo.selectionEnd } : null;
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

    /* Todos os números sobre pares ACEITOS: o que ninguém contratou não é
       pendência. "Com a equipe" = a próxima etapa é nossa; "Travado" = a
       próxima depende do mentorado. */
    var geral = { feitas:0, total:0, aceitos:0, equipe:0, travados:0, noar:0 };
    membros.forEach(function (m) {
      var c = contaMembro(m.id);
      geral.feitas += c.feitas; geral.total += c.total; geral.aceitos += c.aceitos;
      geral.equipe += c.equipe; geral.travados += c.travados; geral.noar += c.noar;
    });

    $('statsMembros').innerHTML =
      cardStat('ENTREGAS', geral.feitas + '/' + geral.total,
               geral.total ? Math.round((geral.feitas / geral.total) * 100) + '% da implantação'
                           : 'nenhum artefato aceito',
               'Etapas de entrega e trava marcadas, sobre o total dos artefatos aceitos. Aceite e rotina ficam fora.') +
      cardStat('COM A EQUIPE', geral.equipe, 'pares cuja próxima etapa é nossa',
               'Artefatos aceitos em implantação em que a próxima etapa é ato da equipe.') +
      cardStat('TRAVADO NO MENTORADO', geral.travados, 'esperando acesso, dado ou aprovação',
               'Artefatos aceitos em que a próxima etapa depende do mentorado.') +
      cardStat('NO AR', geral.noar, geral.aceitos + ' pares aceitos no total',
               'Entregues (100% sem rotina) e ativos (100% com a rotina ligada).');

    $('listaMembros').innerHTML = (Club.erroObservacoes
      ? '<div class="notice" role="status">' + ico('alert') + '<div>' + esc(Club.erroObservacoes) +
        ' Recarregue a página após resolver o problema.</div></div>' : '') + tabela(ARV_COLS, ARV_HEAD,
      membros.map(linhaMentorado).join(''),
      st.arvMembro ? 'Este mentorado não tem nada cadastrado.'
                   : 'Nenhum membro cadastrado ainda.');
    var quadro = $('listaMembros').querySelector('.tblw');
    if (quadro) quadro.scrollLeft = scrollAnterior;

    if (st.zapEdit) {
      var campo = $('listaMembros').querySelector('[data-zap-inp]');
      if (campo) { campo.focus(); campo.select(); }
    }
    if (focoNota) {
      var notaAtiva = $('listaMembros').querySelector('[data-nota-texto="' + focoNota.chave + '"]');
      if (notaAtiva && !notaAtiva.disabled) {
        notaAtiva.focus({ preventScroll:true });
        notaAtiva.setSelectionRange(focoNota.inicio, focoNota.fim);
      }
    }
  }

  function linhaMentorado(m) {
    var chave = 'm:' + m.id;
    var aberto = !!st.abertos[chave];
    var arts = artefatosDe(m.id).filter(function (a) {
      return passaFiltro(contaPar(m.id, a));
    }).sort(porGrupoOrdem);
    var c = contaMembro(m.id);
    var ultima = ultimaMarcacao(m.id);
    var temFilho = arts.length > 0;

    var situacao = !m.ativo
      ? status('var(--faint)', 'Acesso inativo')
      : !c.aceitos ? status('var(--faint)', 'Nada aceito')
      : c.travados ? status('var(--orange)', 'Travado no mentorado')
      : c.equipe ? status('var(--warning)', 'Em implantação')
      : status('var(--success)', 'Tudo no ar');

    var linha = '<div class="tr lv0' + (m.ativo ? '' : ' off') + '">' +
      '<div class="td nm">' + toggleTree(chave, temFilho) +
        '<span class="avatar" style="width:26px;height:26px;font-size:10.5px">' +
          esc(m.iniciais || Club.initials(m.nome)) + '</span>' +
        '<div class="tx"><div class="tx tx-t" title="' + esc(m.nome) + '">' + esc(m.nome) + '</div>' +
        '<div class="tx tx-s">' + esc([m.turma, m.fase].filter(Boolean).join(' · ') ||
          m.email) + '</div></div></div>' +
      td(situacao) +
      celulaNota(m, 'mentorado', m.nome) +
      td(barra(c.feitas, c.total)) +
      (st.zapEdit === m.id
        /* Enquanto cola o convite, o campo toma as duas últimas colunas: um
           input estreito na coluna de ações escreveria por cima do detalhe. */
        ? '<div class="td zap-cell"><input class="cell-date zap-inp" data-zap-inp="' + m.id +
          '" type="url" value="' + esc(m.whatsapp_url || '') +
          '" placeholder="Cole o convite do grupo — Enter salva, Esc fecha" autocomplete="off"></div>'
        : td('<span class="tx-s">' + esc(c.aceitos + ' aceito' + (c.aceitos === 1 ? '' : 's') +
            (c.travados ? ' · ' + c.travados + ' travado' + (c.travados === 1 ? '' : 's') : '') +
            (c.noar ? ' · ' + c.noar + ' no ar' : '') +
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

    linha += linhaNota(m, 'mentorado', m.nome);
    if (!aberto || !temFilho) return linha;

    /* Faixa por grupo dentro do mentorado: com uma dezena de artefatos por
       pessoa, a lista não se lê sem agrupar. É cabeçalho, não nível: sem
       toggle, sem chave nova em abrirTudo. */
    var saida = '', grupoAtual;
    arts.forEach(function (a) {
      var g = grupoDe(a), gid = g ? g.id : 'sem';
      if (gid !== grupoAtual) {
        grupoAtual = gid;
        saida += faixaGrupo(m, g, arts.filter(function (x) { return (grupoDe(x) ? grupoDe(x).id : 'sem') === gid; }));
      }
      saida += linhaArtefato(m, a);
    });
    return linha + saida;
  }

  var PESO_ESTADO = { travado:4, implantacao:3, nao_iniciado:3, sem_criterio:3, ativo_off:2, ativo:1, entregue:1, definir:0 };

  function faixaGrupo(m, g, arts) {
    var pcts = [], pior = 'definir';
    arts.forEach(function (a) {
      var p = contaPar(m.id, a);
      if (p.estado === 'definir') return;
      if (p.total || p.rotinas.length) pcts.push(p.completo ? 100 : p.pct);
      if (PESO_ESTADO[p.estado] > PESO_ESTADO[pior]) pior = p.estado;
    });
    var pct = pcts.length ? Math.round(pcts.reduce(function (s, x) { return s + x; }, 0) / pcts.length) : null;
    var s = Club.PAR_ST[pior];
    return '<div class="tr grp sub">' +
      '<span class="grp-n">' + esc(g ? g.nome : 'Sem grupo') +
        (g && g.pilar ? ' <span class="tx-s">· ' + esc(String(g.pilar).split(' ')[0]) + '</span>' : '') + '</span>' +
      '<span class="tx-s">' + (pct === null ? 'nada aceito' : status(s.cor, s.label) + ' · ' + pct + '%') + '</span>' +
    '</div>';
  }

  function detalhePar(p, m) {
    switch (p.estado) {
      case 'definir':      return 'sem aceite (fora dos números)';
      case 'sem_criterio': return 'sem etapas de entrega';
      case 'nao_iniciado': return 'próxima: ' + (p.proxima ? p.proxima.titulo : '—');
      case 'travado':      return 'aguardando: ' + p.proxima.titulo + diasDesde(m);
      case 'implantacao':  return 'próxima: ' + (p.proxima ? p.proxima.titulo : '—');
      case 'entregue':     return 'entregue' + (ultimaMarcacao(m.id) ? ' em ' + Club.fmtDataCurta(ultimaMarcacao(m.id)) : '');
      case 'ativo':        return 'rotina ' + (p.cadencia ? Club.cadenciaRotulo(p.cadencia).toLowerCase() : '') + ' ligada';
      case 'ativo_off':    return (p.rotinas.length - p.ligadas) + ' rotina' + (p.rotinas.length - p.ligadas === 1 ? '' : 's') + ' desligada';
    }
    return '';
  }

  function diasDesde(m) {
    var u = ultimaMarcacao(m.id);
    if (!u) return '';
    var n = -Club.diffDays(u);
    return n > 0 ? ' · há ' + n + ' d' : '';
  }

  function linhaArtefato(m, a) {
    var chave = 'a:' + m.id + ':' + a.id;
    var aberto = !!st.abertos[chave];
    var etapas = Club.ordenaEtapas(etapasDe(a.id));
    var p = contaPar(m.id, a);
    var s = Club.PAR_ST[p.estado];

    var linha = '<div class="tr lv1' + (p.estado === 'definir' ? ' off' : '') + '">' +
      '<div class="td nm">' + toggleTree(chave, etapas.length) +
        '<span style="color:var(--gold);font-size:15px;flex-shrink:0">' +
          ico(a.icone || 'box') + '</span>' +
        '<div class="tx"><div class="tx tx-t" title="' + esc(a.nome) + '">' + esc(a.nome) + '</div>' +
        '<div class="tx tx-s">' + (a.member_id ? 'artefato dele' : 'artefato da turma') +
          (p.rotinas.length ? ' · com rotina' : '') +
        '</div></div></div>' +
      td(status(s.cor, Club.rotuloPar(p))) +
      celulaNota(m, 'artefato:' + a.id, a.nome) +
      td(p.total || p.temEtapas ? barra(p.feitas, p.total) : '<span class="tx tx-s">sem checklist</span>') +
      td(etapas.length
        ? '<span class="tx-s">' + esc(detalhePar(p, m)) + '</span>'
        /* Sem checklist não há o que marcar: o atalho leva direto a quem
           resolve isso, que é o cadastro do artefato. */
        : '<button class="btn btn-sm btn-ghost" data-edit="artifact" data-id="' + a.id +
          '" style="color:var(--gold)">' + ico('plus') + 'Definir etapas</button>') +
      '<div class="td end"><div class="row-acts">' +
        '<button class="btn btn-sm btn-ghost" data-edit="artifact" data-id="' + a.id +
          '" aria-label="Editar artefato e checklist">' + ico('edit') + '</button>' +
      '</div></div>' +
    '</div>';

    linha += linhaNota(m, 'artefato:' + a.id, a.nome);
    if (!aberto || !etapas.length) return linha;
    return linha + etapas.map(function (e) { return linhaEtapa(m, e, p); }).join('');
  }

  /* Cada tipo de etapa se lê diferente: aceite é o "sim" dele, trava espera
     ato dele, opcional só conta quando marcada, rotina liga e desliga. */
  function linhaEtapa(m, e, par) {
    var p = marcada(m.id, e.id);
    var t = Club.tipoEtapa(e);
    var situacao, nota = '';
    if (t === 'aceite') {
      situacao = p ? status('var(--success)', 'Aceito') : status('var(--faint)', 'Sem aceite');
      nota = 'aceite';
    } else if (t === 'rotina') {
      situacao = p ? status('var(--success)', 'Ligada') : status('var(--faint)', 'Desligada');
      nota = 'rotina · ' + Club.cadenciaRotulo(e.cadencia_dias).toLowerCase() +
        (par && !par.completo ? ' · começa após a implantação' : '');
    } else {
      situacao = p ? status('var(--success)', 'Entregue')
        : t === 'trava' ? status('var(--orange)', 'Com o mentorado')
        : status('var(--faint)', 'Em aberto');
      if (t === 'trava') nota = 'depende do mentorado';
      if (t === 'opcional') nota = 'opcional · conta só se marcar';
    }
    return '<div class="tr lv2' + (p ? ' feito' : '') + '">' +
      '<div class="td nm"><span class="tg void"></span>' +
        '<button class="cbx" data-etapa="' + esc(m.id) + '|' + esc(e.id) + '" aria-pressed="' +
          (!!p) + '" aria-label="Marcar etapa">' + ico('check') + '</button>' +
        (t === 'rotina' ? '<span style="color:var(--faint);flex-shrink:0">' + ico('refresh') + '</span>' : '') +
        '<div class="tx"><div class="tx tx-t" title="' + esc(e.titulo) + '">' + esc(e.titulo) + '</div>' +
        (nota ? '<div class="tx tx-s">' + esc(nota) + '</div>' : '') + '</div></div>' +
      td(situacao) +
      celulaNota(m, 'etapa:' + e.id, e.titulo) +
      td('') +
      td('<span class="tx-s">' + (p && p.feito_em
        ? esc('em ' + Club.fmtDataCurta(p.feito_em)) : '—') + '</span>') +
      '<div class="td end"></div>' +
    '</div>' + linhaNota(m, 'etapa:' + e.id, e.titulo);
  }

  /* Notas pertencem à linha DESTE mentorado, nunca ao checklist compartilhado.
     A célula fica curta; o editor se expande abaixo sem esconder o contexto. */
  function celulaNota(m, alvo, rotulo) {
    var chave = m.id + '|' + alvo, nota = porNota[chave];
    var texto = nota ? nota.observacao : '';
    var aberta = !!st.notasEdit[chave];
    return '<div class="td"><button type="button" class="progress-note' + (texto ? ' preenchida' : '') +
      '" data-nota-abrir="' + esc(chave) + '" aria-expanded="' + aberta + '"' +
      (aberta ? ' aria-controls="nota-painel-' + esc(chave) + '"' : '') +
      ' aria-label="Observação de ' + esc(rotulo) + ' — ' + esc(m.nome) + '"' +
      (Club.erroObservacoes ? ' disabled title="Observações indisponíveis"' : '') + '>' +
      '<span class="tx">' + esc(texto ? texto.replace(/\s+/g, ' ') : 'Adicionar observação') + '</span>' +
      ico('edit') + '</button></div>';
  }

  function linhaNota(m, alvo, rotulo) {
    var chave = m.id + '|' + alvo, edicao = st.notasEdit[chave];
    if (!edicao) return '';
    var id = 'nota-' + chave;
    return '<div class="tr progress-note-row" id="nota-painel-' + esc(chave) + '">' +
      '<div class="progress-note-panel" role="group" aria-labelledby="' + esc(id) + '-contexto"' +
        ' aria-busy="' + (!!edicao.salvando) + '">' +
        '<div class="progress-note-context" id="' + esc(id) + '-contexto">' + esc(m.nome) +
          (alvo === 'mentorado' ? '' : ' · ' + esc(rotulo)) + '</div>' +
        '<label for="' + esc(id) + '">Observação interna</label>' +
        '<textarea class="inp" id="' + esc(id) + '" data-nota-texto="' + esc(chave) +
          '" rows="3" maxlength="2000" placeholder="Contexto, pendência ou próximo passo…"' +
          ' aria-describedby="' + esc(id) + '-ajuda' + (edicao.erro ? ' ' + esc(id) + '-erro' : '') + '"' +
          (edicao.erro ? ' aria-invalid="true"' : '') +
          (edicao.salvando || Club.erroObservacoes ? ' disabled' : '') + '>' + esc(edicao.texto) + '</textarea>' +
        '<div class="progress-note-hint" id="' + esc(id) + '-ajuda">Só a equipe vê esta nota. ' +
          'Até 2.000 caracteres · Ctrl/Cmd+Enter salva · Esc cancela.</div>' +
        (edicao.erro ? '<div class="progress-note-error" role="alert" id="' + esc(id) + '-erro">' +
          esc(edicao.erro) + '</div>' : '') +
        '<div class="progress-note-actions"><span role="status">' + (edicao.salvando ? 'Salvando…' : '') + '</span>' +
          '<button type="button" class="btn btn-sm" data-nota-cancelar="' + esc(chave) + '"' +
            (edicao.salvando ? ' disabled' : '') + '>Cancelar</button>' +
          '<button type="button" class="btn btn-sm btn-primary" data-nota-salvar="' + esc(chave) + '"' +
            (edicao.salvando || Club.erroObservacoes ? ' disabled' : '') + '>Salvar observação</button>' +
        '</div></div></div>';
  }

  function focarNota(chave, editor) {
    var campo = $('listaMembros').querySelector('[' + (editor ? 'data-nota-texto' : 'data-nota-abrir') +
      '="' + chave + '"]');
    if (campo && !campo.disabled && (editor || document.activeElement === document.body)) campo.focus();
  }

  function abrirNota(chave) {
    if (Club.erroObservacoes) return;
    if (!st.notasEdit[chave]) {
      var nota = porNota[chave];
      st.notasEdit[chave] = { texto:nota ? nota.observacao : '', salvando:false, erro:'' };
    }
    renderMembers();
    focarNota(chave, true);
  }

  function fecharNota(chave, salvar) {
    var edicao = st.notasEdit[chave];
    if (!edicao || edicao.salvando) return;
    var texto = edicao.texto.trim(), atual = porNota[chave];
    if (!salvar || texto === (atual ? atual.observacao : '')) {
      delete st.notasEdit[chave];
      renderMembers();
      focarNota(chave, false);
      return;
    }
    if (texto.length > 2000 || Club.erroObservacoes) {
      edicao.erro = Club.erroObservacoes || 'Use até 2.000 caracteres.';
      renderMembers();
      focarNota(chave, true);
      return;
    }
    edicao.salvando = true;
    edicao.erro = '';
    renderMembers();
    var partes = chave.split('|');
    Club.data.progressNotes.save(partes[0], partes[1], texto).then(function (nota) {
      st.progressNotes = st.progressNotes.filter(function (n) {
        return !(n.member_id === partes[0] && n.alvo === partes[1]);
      }).concat([nota]);
      porNota[chave] = nota;
      delete st.notasEdit[chave];
      renderMembers();
      focarNota(chave, false);
      Club.toast('Observação salva.');
    }).catch(function (err) {
      edicao.salvando = false;
      edicao.erro = (err && err.message) || 'Não foi possível salvar. Tente novamente.';
      renderMembers();
    });
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
        : '<span style="color:' + (atrasada ? 'var(--danger)' : 'inherit') + '">' +
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

  /* ── voz do bot do Instagram ──────────────────────────────────────────────
     Duas telas que trabalham juntas. "O bot respondeu" é a fila do que a IA
     escreveu nos comentários e ainda espera aval; aprovar copia o par para
     "Voz do bot", que é o material de onde ele aprende a escrever.

     O ciclo é esse: o bot responde, você aprova o que ficou bom, e a próxima
     resposta sai melhor. Se as respostas entrassem sozinhas, o modelo passaria
     a aprender com ele mesmo e o tom derivaria sem ninguém perceber. */

  var BOT_GRUPOS = [
    { value:'relato',  label:'Relato — conta a própria história' },
    { value:'duvida',  label:'Dúvida — pergunta se pode fazer' },
    { value:'objecao', label:'Objeção — reclama ou desconfia' },
    { value:'outro',   label:'Outro — não se encaixou em nada' }
  ];

  function botRotulo(g) {
    var achou = BOT_GRUPOS.filter(function (x) { return x.value === g; })[0];
    return achou ? achou.label.split(' — ')[0] : (g || '—');
  }

  /* ── instagram dos mentorados ─────────────────────────────────────────── */
  /* O acompanhamento era por print e memória. Aqui a conta de cada mentorado
     aparece com o total de hoje e a variação desde o retrato de 7 e 30 dias
     atrás — quando ela existe. Antes disso a coluna diz "aguardando", que é
     diferente de "não cresceu": no primeiro dia não há com o que comparar.

     `visualizacoes` e `alcance` são a janela de 7 dias que o Instagram
     entrega, não um acumulado nosso; por isso o cabeçalho diz "7 dias". */

  function numeroCurto(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
    return String(n);
  }

  function variacao(v) {
    if (v === null || v === undefined) return '<span class="tx-s">aguardando</span>';
    if (v === 0) return '<span class="tx-s">estável</span>';
    var cor = v > 0 ? 'var(--success)' : 'var(--danger)';
    return '<span style="color:' + cor + '">' + (v > 0 ? '+' : '') + numeroCurto(v) + '</span>';
  }

  /* Barrinha de progressão dos últimos retratos, desenhada com divs: o painel
     não carrega biblioteca de gráfico, e trazer uma para 15 linhas seria caro
     demais pelo que entrega. Cada barra é um dia; a altura é relativa ao maior
     ganho da série daquela conta. */
  function faixaSerie(username) {
    var pontos = (st.igSerie || [])
      .filter(function (p) { return p.username === username && p.seguidores_ganhos !== null; })
      .slice(-14);
    if (pontos.length < 2) return '<span class="tx-s">aguardando</span>';
    var vals = pontos.map(function (p) { return p.seguidores_ganhos || 0; });
    var teto = Math.max.apply(null, vals.map(Math.abs)) || 1;
    return '<span class="ig-spark" title="ganho de seguidores por dia">' +
      pontos.map(function (p, i) {
        var v = vals[i];
        var h = Math.max(2, Math.round(Math.abs(v) / teto * 18));
        var cor = v < 0 ? 'var(--danger)' : 'var(--success)';
        return '<i style="height:' + h + 'px;background:' + cor + '" title="' +
               esc(Club.fmtDataCurta ? Club.fmtDataCurta(p.dia) : p.dia) +
               ': ' + (v > 0 ? '+' : '') + v + '"></i>';
      }).join('') + '</span>';
  }

  /* ── detalhe de uma conta ─────────────────────────────────────────────── */
  /* Clicar no mentorado abre o histórico dele. O que existe de passado, e por
     quê, está medido: o Instagram devolve `reach` diário por quase dois anos,
     mas `follower_count` só 30 dias, e `views` não tem série diária nenhuma
     (só janela). Então o gráfico grande é o alcance — o único com memória
     longa — e a curva de seguidores é reconstruída dos ganhos diários, o que
     vale um aviso na tela: é estimativa, não medição.

     Os gráficos são SVG escrito à mão. Trazer uma biblioteca de gráfico para
     duas séries seria mais peso no navegador do que o desenho inteiro. */



  /* Área + linha. `campo` diz qual número ler; nulo vira buraco, não zero —
     dia sem coleta não é dia de alcance zero. */
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

  /* Barras de ganho diário. Cada dia é uma coluna que ocupa a altura toda e
     ancora a barra na base — com `top` em elemento relative, como estava, a
     barra saía do cartão e caía por cima do bloco de baixo. Dia negativo
     (o Instagram devolve ganho, mas conta apagada pode zerar) cresce para
     baixo a partir do meio. */
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

  /* Curva de seguidores para trás: o total de hoje menos o que entrou depois de
     cada dia. É estimativa — `follower_count` conta quem chegou, não quem saiu,
     então quanto mais longe do hoje, mais a linha erra. Por isso 30 dias e o
     aviso ao lado do título. */
  function curvaSeguidores(pontos, totalHoje) {
    var acc = totalHoje, saida = [];
    for (var i = pontos.length - 1; i >= 0; i--) {
      saida.unshift({ dia: pontos[i].dia, seguidores: acc });
      acc -= (pontos[i].seguidores_ganhos || 0);
    }
    return saida;
  }

  /* ── a legenda que segue o mouse ───────────────────────────────────────── */
  /* Uma caixa só, movida por JS. O `title` do navegador demora quase um segundo
     para aparecer, some sozinho e não formata número — num painel que existe
     para ser lido rápido, isso é o mesmo que não ter legenda.

     Três clientes, o mesmo balão: cartão do topo (o que aquele número quer
     dizer), coluna de barra (o dia e quantos entraram) e gráfico de linha (o
     valor do dia sob o cursor, com linha-guia e ponto). */

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

  document.addEventListener('mousemove', rastrear);
  document.addEventListener('mouseleave', esconderDica);
  /* Rolar com o balão aberto o deixaria pendurado no lugar errado. */
  window.addEventListener('scroll', esconderDica, true);

  function abrirDetalheIg(username) {
    var l = (st.igResumo || []).filter(function (x) { return x.username === username; })[0];
    if (!l) return;
    var dias = st.igDetDias || 90;
    /* A série completa desta conta vem sob demanda: a lista só carrega os
       últimos 45 dias de todo mundo, senão o teto de linhas do PostgREST come
       o histórico. */
    Club.data.instagram.serieDaConta(username, 180).then(function (todos) {
      st.igSerieConta = todos;
      desenharDetalheIg(l, dias, todos);
    });
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

    Club.modal.open({
      title: (l.mentorado || username),
      sub: 'Instagram · histórico',
      leitura: true,
      largura: 980,
      body:
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
            '<span class="tx-s">quantas contas viram algo dele naquele dia</span></div>' +
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
    });
  }

  function renderIgMetricas() {
    if (Club.instagramIndisponivel) {
      $('listaIg').innerHTML = '<div class="placeholder">' + ico('alert') +
        '<h2>Falta criar no banco</h2><p>' + esc(Club.instagramIndisponivel) + '</p></div>';
      $('statsIg').innerHTML = '';
      return;
    }

    var linhas = (st.igResumo || []).slice();
    if (linhas.length === 0) {
      $('listaIg').innerHTML = '<div class="placeholder">' + ico('users') +
        '<h2>Nenhuma coleta ainda</h2><p>A primeira rodada do coletor ainda não ' +
        'aconteceu. Assim que rodar, as contas aparecem aqui.</p></div>';
      $('statsIg').innerHTML = '';
      return;
    }

    var total = linhas.reduce(function (a, l) { return a + (l.seguidores || 0); }, 0);
    var views = linhas.reduce(function (a, l) { return a + (l.visualizacoes || 0); }, 0);
    var comVar = linhas.filter(function (l) { return l.var_seguidores_7d !== null; });
    var cresceu = comVar.filter(function (l) { return l.var_seguidores_7d > 0; }).length;
    var dia = linhas[0].dia;

    $('statsIg').innerHTML =
      cardStat('SEGUIDORES NA TURMA', numeroCurto(total), linhas.length + ' contas acompanhadas') +
      cardStat('VISUALIZAÇÕES (7 DIAS)', numeroCurto(views), 'somadas as contas') +
      cardStat('CRESCERAM NA SEMANA', comVar.length ? cresceu : '—',
               comVar.length ? 'de ' + comVar.length + ' com histórico' : 'aguardando o 2º retrato') +
      cardStat('ÚLTIMO RETRATO', dia ? Club.fmtDataCurta(dia) : '—', 'um por dia');

    var ordem = st.igOrdem;
    linhas.sort(function (a, b) {
      if (ordem === 'crescimento') return (b.var_seguidores_7d || -1e9) - (a.var_seguidores_7d || -1e9);
      if (ordem === 'views') return (b.visualizacoes || 0) - (a.visualizacoes || 0);
      return (b.seguidores || 0) - (a.seguidores || 0);
    });

    $('listaIg').innerHTML = tabela(
      'minmax(0,1.6fr) 116px 108px 108px 132px 116px 116px',
      ['Mentorado · conta', 'Seguidores', '7 dias', '30 dias', 'Progressão',
       'Alcance médio/dia', '>Views (7d)'],
      linhas.map(function (l) {
        var nome = l.mentorado || '(sem mentorado)';
        return '<div class="tr tr-click" data-ig-det="' + esc(l.username) + '">' +
          td('<div class="tx"><div class="tx tx-t">' + esc(nome) + '</div>' +
             '<div class="tx tx-s"><a href="https://instagram.com/' + esc(l.username) +
             '" target="_blank" rel="noopener">@' + esc(l.username) + '</a></div></div>') +
          td('<span class="tx-t">' + numeroCurto(l.seguidores) + '</span>') +
          td(variacao(l.var_seguidores_7d)) +
          td(variacao(l.var_seguidores_30d)) +
          td(faixaSerie(l.username)) +
          td(numeroCurto(l.alcance_medio_30d)) +
          tdCel(numeroCurto(l.visualizacoes), 'end') +
        '</div>';
      }).join(''),
      'Nenhuma conta coletada.'
    );
  }

  function renderBotFila() {
    if (Club.faltaBot) {
      $('listaBotFila').innerHTML = '<div class="placeholder">' + ico('alert') +
        '<h2>Falta criar no banco</h2><p>' + esc(Club.faltaBot) + '</p></div>';
      $('statsBot').innerHTML = '';
      return;
    }
    var todas = st.botRespostas || [];
    var pend = todas.filter(function (r) { return !r.decisao; });
    var virou = todas.filter(function (r) { return r.decisao === 'exemplo'; });

    var ativos = (st.botExemplos || []).filter(function (e) { return e.ativo; }).length;
    $('statsBot').innerHTML =
      cardStat('ESPERANDO VOCÊ', pend.length,
               pend.length ? 'aprove ou descarte' : 'nada pendente') +
      cardStat('VIRARAM EXEMPLO', virou.length, 'ensinando o bot a escrever') +
      cardStat('EXEMPLOS ATIVOS', ativos, (st.botExemplos || []).length + ' cadastrados no total');

    /* Quem comentou tem coluna própria: a célula do painel é de uma linha só,
       com reticências, e espremer autor e data junto do texto some com os dois. */
    var lista = st.botFila === 'all' ? todas : pend;
    $('listaBotFila').innerHTML = tabela(
      '158px minmax(0,1fr) minmax(0,1.15fr) 96px 196px',
      ['Quem', 'Comentou', 'O bot respondeu', 'Grupo', '>Decisão'],
      lista.map(function (r) {
        var quando = r.respondido ? Club.fmtDataCurta(r.respondido) : '';
        var quem = r.usuario ? '@' + esc(r.usuario) : 'sem autor';
        var autor = r.permalink
          ? '<a href="' + esc(r.permalink) + '" target="_blank" rel="noopener" ' +
            'title="Abrir no Instagram">' + quem + '</a>'
          : quem;
        var acao = r.decisao === 'exemplo'
          ? '<span class="dotst" style="color:var(--ok)"><i></i>virou exemplo</span>'
          : r.decisao === 'descartada'
            ? '<span class="dotst" style="color:var(--muted)"><i></i>descartada</span>'
            : '<button class="btn btn-sm btn-primary" data-bot-aprovar="' + r.id + '">' +
              'Virar exemplo</button> <button class="btn btn-sm" data-bot-descartar="' + r.id + '">' +
              'Descartar</button>';
        return '<div class="tr tr-lida">' +
          td('<span class="tx-t">' + autor + '</span>') +
          td('<span class="tx-s">' + esc(quando) + '</span> ' + esc(r.comentario)) +
          td(esc(r.resposta)) +
          td(esc(botRotulo(r.grupo))) +
          tdCel(acao, 'end') +
        '</div>';
      }).join(''),
      st.botFila === 'all'
        ? 'O bot ainda não escreveu nenhuma resposta.'
        : 'Nada esperando você. Quando o bot escrever, aparece aqui.');
  }

  function renderBotExemplos() {
    if (Club.faltaBot) {
      $('listaBotExemplos').innerHTML = '<div class="placeholder">' + ico('alert') +
        '<h2>Falta criar no banco</h2><p>' + esc(Club.faltaBot) + '</p></div>';
      return;
    }
    var todos = st.botExemplos || [];
    var porGrupo = {};
    todos.forEach(function (e) { porGrupo[e.grupo] = (porGrupo[e.grupo] || 0) + 1; });

    $('filtroBotGrupo').innerHTML =
      '<option value="">Todos os grupos (' + todos.length + ')</option>' +
      BOT_GRUPOS.map(function (g) {
        return '<option value="' + g.value + '"' + (st.botGrupo === g.value ? ' selected' : '') +
          '>' + esc(g.label) + ' (' + (porGrupo[g.value] || 0) + ')</option>';
      }).join('');

    var lista = st.botGrupo
      ? todos.filter(function (e) { return e.grupo === st.botGrupo; })
      : todos;

    /* Sem resposta primeiro: são o trabalho a fazer, e no meio da lista eles
       sumiriam. Exemplo sem resposta não ensina nada e o bot nem o enxerga. */
    var vazio = function (e) { return !e.resposta || !e.resposta.trim(); };
    lista = lista.slice().sort(function (a, b) { return (vazio(a) ? 0 : 1) - (vazio(b) ? 0 : 1); });
    var faltam = todos.filter(vazio).length;

    $('avisoBotVazios').innerHTML = faltam
      ? '<div class="aviso-bot">' + ico('edit') + '<span><b>' + faltam +
        ' comentário' + (faltam > 1 ? 's' : '') + ' esperando resposta.</b> ' +
        'São comentários reais do perfil, como as pessoas escreveram. ' +
        'Enquanto estiverem sem resposta, o bot não os usa.</span></div>'
      : '';

    $('listaBotExemplos').innerHTML = tabela(
      'minmax(0,1fr) minmax(0,1.2fr) 112px 104px 130px',
      ['Comentário modelo', 'Resposta', 'Grupo', 'De quem', '>Ações'],
      lista.map(function (e) {
        var falta = vazio(e);
        return '<div class="tr' + (e.ativo ? '' : ' off') + (falta ? ' tr-falta' : '') + '">' +
          td('<b>' + esc(e.comentario) + '</b>') +
          td(falta ? '<span class="tx-s">esperando o Dr.</span>' : esc(e.resposta)) +
          td(esc(botRotulo(e.grupo))) +
          td(esc(falta ? '—' : (e.origem || 'italo'))) +
          tdCel(
            '<button class="btn btn-sm' + (falta ? ' btn-primary' : '') +
              '" data-edit="botExemplo" data-id="' + e.id + '">' +
              (falta ? 'Responder' : 'Editar') + '</button> ' +
            '<button class="btn btn-sm" data-bot-ativo="' + e.id + '">' +
              (e.ativo ? 'Desligar' : 'Ligar') + '</button>', 'end') +
        '</div>';
      }).join(''),
      'Nenhum exemplo ainda. Comece cadastrando um comentário que você já viu e a resposta que daria.');
  }

  function modalBotExemplo(e) {
    e = e || { grupo:'relato', comentario:'', resposta:'', origem:'italo' };
    Club.modal.open({
      title: e.id ? 'Editar exemplo' : 'Novo exemplo',
      sub: 'O bot procura os exemplos mais parecidos com o comentário que chegou e escreve no mesmo tom.',
      body:
        Club.select('Grupo', 'grupo', BOT_GRUPOS, e.grupo) +
        Club.field('Comentário modelo', 'comentario', { value:e.comentario, required:true,
          placeholder:'Fiz cirurgia há 20 anos e o grau voltou' }) +
        Club.field('Resposta certa para ele', 'resposta', { value:e.resposta || '',
          placeholder:'Não é fácil passar por isso de novo. Força aí 💙',
          hint:'Curta, sem preço, sem prometer nada e sem opinar sobre o caso da pessoa. ' +
               'Pode deixar em branco e responder depois — sem resposta, o bot não usa este exemplo.' }),
      onSubmit: function (d) {
        if (!d.comentario) {
          Club.toast('O comentário modelo é obrigatório.', 'alert'); return;
        }
        d.id = e.id;
        d.origem = e.origem || 'italo';
        d.ativo = e.ativo === undefined ? true : e.ativo;
        Club.data.botExemplos.save(d).then(function () {
          Club.modal.close();
          recarregar(e.id ? 'Exemplo atualizado.' : 'Exemplo criado.');
        }).catch(aviso);
      }
    });
  }

  function aprovarResposta(id) {
    Club.data.botRespostas.virarExemplo(id)
      .then(function () { recarregar('Virou exemplo. O bot já aprende com ele.'); })
      .catch(function (err) { Club.toast(err.message || 'Não foi possível aprovar.', 'alert'); });
  }

  function descartarResposta(id) {
    Club.data.botRespostas.descartar(id)
      .then(function () { recarregar('Descartada.'); })
      .catch(function (err) { Club.toast(err.message || 'Não foi possível descartar.', 'alert'); });
  }

  /* Desligar em vez de apagar: exemplo ruim ainda conta a história de por que
     ele foi escrito, e ligar de volta é um clique. */
  function alternarExemplo(id) {
    var e = (st.botExemplos || []).filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    Club.data.botExemplos.save({ id:id, ativo: !e.ativo })
      .then(function () { recarregar(e.ativo ? 'Exemplo desligado.' : 'Exemplo ligado.'); })
      .catch(aviso);
  }

  /* ── artefatos: o catálogo ────────────────────────────────────────────── */
  /* Papel desta aba: o que o Club entrega, em que grupo, com que dono e com
     que critério de 100%. Acompanhar mentorado é na Progressão. */

  function siglas(ids) {
    return (ids || []).map(function (id) {
      var p = st.staff.filter(function (x) { return x.id === id; })[0];
      return p ? (p.apelido || p.nome) : null;
    }).filter(Boolean).join(', ');
  }

  function criterioDe(etapas) {
    if (!etapas.length) return '<span class="tx-s" style="color:var(--warning)">sem critério</span>';
    var n = { aceite:0, entrega:0, trava:0, opcional:0, rotina:0 };
    etapas.forEach(function (e) { n[Club.tipoEtapa(e)]++; });
    var partes = [];
    if (n.entrega)  partes.push(n.entrega + ' entrega' + (n.entrega === 1 ? '' : 's'));
    if (n.trava)    partes.push(n.trava + ' trava' + (n.trava === 1 ? '' : 's'));
    if (n.opcional) partes.push(n.opcional + (n.opcional === 1 ? ' opcional' : ' opcionais'));
    return '<div class="tx tx-t">' + esc(partes.join(' · ') || 'só rotina') + '</div>' +
      '<div class="tx tx-s">' + esc((n.aceite ? 'com aceite' : 'sem aceite') +
        (n.rotina ? ' + ' + n.rotina + ' rotina' + (n.rotina === 1 ? '' : 's') : '')) + '</div>';
  }

  function tipoArtefato(etapas) {
    var cad = null, tem = false;
    etapas.forEach(function (e) {
      if (Club.tipoEtapa(e) !== 'rotina') return;
      tem = true;
      if (e.cadencia_dias && (!cad || e.cadencia_dias < cad)) cad = e.cadencia_dias;
    });
    return tem ? 'Rotina ' + Club.cadenciaRotulo(cad).toLowerCase() : 'Entrega';
  }

  /* Quantos mentorados aceitaram, chegaram a 100%, estão ativos ou travados.
     O denominador é quem pode ter o artefato: a turma, ou o dono quando é dele. */
  function adocaoDe(a) {
    var alvo = a.member_id
      ? st.members.filter(function (m) { return m.id === a.member_id; })
      : st.members.filter(function (m) { return m.ativo; });
    var n = { aceitos:0, cem:0, ativos:0, travados:0 };
    alvo.forEach(function (m) {
      var p = contaPar(m.id, a);
      if (p.estado === 'definir') return;
      n.aceitos++;
      if (p.estado === 'entregue') n.cem++;
      if (p.estado === 'ativo' || p.estado === 'ativo_off') n.ativos++;
      if (p.estado === 'travado') n.travados++;
    });
    var partes = [n.aceitos + ' aceito' + (n.aceitos === 1 ? '' : 's')];
    if (n.cem) partes.push(n.cem + ' a 100%');
    if (n.ativos) partes.push(n.ativos + ' ativo' + (n.ativos === 1 ? '' : 's'));
    if (n.travados) partes.push(n.travados + ' travado' + (n.travados === 1 ? '' : 's'));
    return '<div class="tx tx-t">' + esc(partes[0]) + '</div>' +
      '<div class="tx tx-s">' + esc(partes.slice(1).join(' · ') || '—') + '</div>';
  }

  function linhaCatalogo(a) {
    var s = Club.ART_ST[a.status] || Club.ART_ST['Bloqueado'];
    var etapas = etapasDe(a.id);
    return '<div class="tr">' +
      '<div class="td"><span class="art-i" style="width:28px;height:28px;border-radius:8px;' +
        'font-size:14px;margin:0;flex-shrink:0">' + ico(a.icone || 'box') + '</span>' +
        '<div class="tx"><div class="tx tx-t" title="' + esc(a.nome) + '">' + esc(a.nome) + '</div>' +
        '<div class="tx tx-s">' + esc([a.subtitulo, a.member_id ? 'só ' + escopo(a.member_id) : null,
          siglas(a.responsaveis) ? 'dono ' + siglas(a.responsaveis) : null].filter(Boolean).join(' · ')) +
        '</div></div></div>' +
      '<div class="td"><div class="tx">' + criterioDe(etapas) + '</div></div>' +
      td('<span class="tx-s">' + esc(tipoArtefato(etapas)) + '</span>') +
      '<div class="td"><div class="tx">' + adocaoDe(a) + '</div></div>' +
      td(status(s.color, a.status)) +
      '<div class="td end">' + acoes('artifact', a.id) + '</div>' +
    '</div>';
  }

  function cabecalhoGrupo(g, n) {
    var sub = g
      ? [g.pilar, siglas(g.responsaveis), n + ' artefato' + (n === 1 ? '' : 's')].filter(Boolean).join(' · ')
      : n + ' artefato' + (n === 1 ? '' : 's') + ' sem grupo';
    return '<div class="tr grp pai">' +
      '<span class="grp-n">' + esc(g ? g.nome : 'Sem grupo') +
        ' <span class="tx-s" style="font-weight:400">' + esc(sub) + '</span></span>' +
      (g ? '<span>' + acoes('group', g.id) + '</span>' : '<span></span>') +
    '</div>';
  }

  function renderArtifacts() {
    var grupos = st.groups.slice().concat([null]);
    $('filtroArtGrupo').innerHTML = '<option value="">Todos os grupos</option>' +
      st.groups.map(function (g) {
        return '<option value="' + esc(g.id) + '"' + (g.id === st.artGrupo ? ' selected' : '') + '>' +
          esc(g.nome) + '</option>';
      }).join('') + '<option value="sem"' + (st.artGrupo === 'sem' ? ' selected' : '') + '>Sem grupo</option>';

    var semCriterio = st.artifacts.filter(function (a) { return !etapasDe(a.id).length; }).length;
    $('artResumo').textContent = st.artifacts.length + ' artefatos · ' + st.groups.length + ' grupos' +
      (semCriterio ? ' · ' + semCriterio + ' sem critério' : '');
    $('avisoGrupos').innerHTML = Club.faltaGrupos
      ? '<div class="notice">' + ico('alert') + '<div>' + esc(Club.faltaGrupos) + '</div></div>' : '';

    var secoes = grupos.map(function (g) {
      var gid = g ? g.id : 'sem';
      if (st.artGrupo && st.artGrupo !== gid) return '';
      var arts = st.artifacts.filter(function (a) {
        return (g ? a.group_id === g.id : !a.group_id);
      }).sort(porGrupoOrdem);
      /* "Sem grupo" some quando está vazia: seria uma seção sem assunto. */
      if (!arts.length && !g) return '';
      return cabecalhoGrupo(g, arts.length) + arts.map(linhaCatalogo).join('');
    }).join('');

    $('listaArtefatos').innerHTML = tabela(
      'minmax(0,2fr) minmax(0,1.3fr) 128px minmax(0,1.3fr) 118px 88px',
      ['Artefato', 'Critério de 100%', 'Tipo', 'Adoção', 'Situação', '>Ações'],
      secoes, 'Nenhum artefato cadastrado ainda.');
  }

  function opcoesEquipe() {
    return st.staff.filter(function (p) { return p.ativo; }).map(function (p) {
      return { value:p.id, label:p.nome + (p.apelido ? ' (' + p.apelido + ')' : '') };
    });
  }

  /* O select múltiplo só reflete o array inteiro depois de estar no DOM. */
  function marcarMultiplos(name, valores) {
    if (!valores || valores.length < 2) return;
    var campo = document.querySelector('#modalForm [name="' + name + '"]');
    if (!campo) return;
    Array.prototype.forEach.call(campo.options, function (o) {
      o.selected = valores.indexOf(o.value) !== -1;
    });
  }

  function modalGrupo(g) {
    g = g || { nome:'', pilar:'', ordem: st.groups.length + 1, responsaveis:[] };
    Club.modal.open({
      title: g.id ? 'Editar grupo' : 'Novo grupo',
      sub: g.id ? g.nome : 'O bloco que o Club vende: reúne os artefatos que fazem parte da mesma entrega.',
      body:
        Club.field('Nome', 'nome', { value:g.nome, required:true, placeholder:'Tráfego' }) +
        '<div class="fld-row">' +
          Club.select('Pilar do método', 'pilar', [{ value:'', label:'—' }].concat(
            Club.PILARES.map(function (p) { return { value:p, label:p }; })), g.pilar || '') +
          Club.field('Ordem', 'ordem', { value:g.ordem, type:'number' }) +
        '</div>' +
        (opcoesEquipe().length
          ? Club.select('Responsáveis', 'responsaveis', opcoesEquipe(), (g.responsaveis || [])[0],
              { multiple:true, hint:'Quem responde pelo grupo. Segure Ctrl (ou Cmd) para mais de um.' })
          : ''),
      onSubmit: function (d) {
        if (!d.nome) { Club.toast('O grupo precisa de um nome.', 'alert'); return; }
        d.id = g.id;
        d.responsaveis = d.responsaveis || [];
        Club.data.groups.save(d).then(function () {
          Club.modal.close();
          recarregar(g.id ? 'Grupo atualizado.' : 'Grupo criado.');
        }).catch(aviso);
      }
    });
    marcarMultiplos('responsaveis', g.responsaveis);
  }

  function modalArtefato(a) {
    a = a || { nome:'', subtitulo:'', icone:'box', status:'Em produção', meta:'',
               url:'', member_id:null, group_id: st.artGrupo && st.artGrupo !== 'sem' ? st.artGrupo : null,
               ordem:0, responsaveis:[] };
    var etapasAtuais = a.id ? etapasDe(a.id) : [];
    var comGrupos = !Club.faltaGrupos;
    Club.modal.open({
      title: a.id ? 'Editar artefato' : 'Novo artefato',
      sub: a.id ? a.nome : 'O que o Club entrega para o mentorado.',
      body:
        Club.field('Nome', 'nome', { value:a.nome, required:true,
          placeholder:'Landing Page VSL' }) +
        Club.field('Descrição curta', 'subtitulo', { value:a.subtitulo,
          placeholder:'Página de vídeo de vendas' }) +
        (comGrupos
          ? '<div class="fld-row">' +
              Club.select('Grupo', 'group_id', [{ value:'', label:'Sem grupo' }].concat(
                st.groups.map(function (g) { return { value:g.id, label:g.nome }; })), a.group_id || '') +
              Club.field('Ordem no grupo', 'ordem', { value:a.ordem || 0, type:'number' }) +
            '</div>' +
            (opcoesEquipe().length
              ? Club.select('Dono', 'responsaveis', opcoesEquipe(), (a.responsaveis || [])[0],
                  { multiple:true, hint:'Quem move este artefato. Sem dono, vale o do grupo.' })
              : '')
          : '') +
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
          hint:'Uma etapa por linha, na ordem do checklist. Renomear uma linha mantém ' +
               'o que já estava marcado nela; etapa nova entra no fim; inserir no meio ' +
               'ou apagar linha com marca é barrado. O tipo de cada etapa (aceite, ' +
               'entrega, trava, opcional, rotina) fica como está; linha nova nasce entrega.' }),
      onSubmit: function (d) {
        if (!d.nome) { Club.toast('O artefato precisa de um nome.', 'alert'); return; }
        d.id = a.id;
        d.member_id = d.member_id || null;
        if (comGrupos) { d.group_id = d.group_id || null; d.responsaveis = d.responsaveis || []; }

        var titulos = String(d.etapas || '').split('\n')
          .map(function (l) { return l.trim(); })
          .filter(Boolean);

        /* Guarda de posição. O sync casa etapa velha com linha nova pelo índice,
           então inserir ou mover uma linha no meio passa as marcações de todo
           mundo para a etapa errada, em silêncio. Renomear no lugar é seguro;
           linha nova entra no fim. Apagar linha com marca também para aqui:
           o cascade levaria o progresso junto sem aviso. */
        var trava = guardaPosicao(etapasAtuais, titulos);
        if (trava) { Club.toast(trava, 'alert'); return; }

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
    marcarMultiplos('responsaveis', a.responsaveis);
  }

  /* Devolve a mensagem que barra o salvamento, ou null quando o novo checklist
     não desloca nem apaga marcação. Regras: (1) etapa com marca que some da
     sua posição e reaparece em outra = movida/inserção no meio; (2) linha
     além do novo tamanho com marca = apagada com progresso. */
  function guardaPosicao(atuais, titulos) {
    atuais = (atuais || []).slice().sort(function (a, b) {
      return (a.ordem - b.ordem) || String(a.criado_em).localeCompare(String(b.criado_em));
    });
    var movidas = [], apagadas = [];
    atuais.forEach(function (e, i) {
      var m = marcasDe([e]);
      if (!m.marcas) return;
      if (i >= titulos.length) { apagadas.push(e); return; }
      if (titulos[i] !== e.titulo && titulos.indexOf(e.titulo) !== -1) movidas.push(e);
    });
    if (movidas.length) {
      var mm = marcasDe(movidas);
      return 'Isso deslocaria ' + mm.marcas + ' marcações de ' + mm.mentorados +
        ' mentorados para a etapa errada. Renomear no lugar é seguro; etapa nova só entra no fim.';
    }
    if (apagadas.length) {
      var ma = marcasDe(apagadas);
      return 'Apagar "' + apagadas[0].titulo + '" apaga ' + ma.marcas + ' marcações de ' +
        ma.mentorados + ' mentorados. Deixe a linha e renomeie; etapa com marca não sai por aqui.';
    }
    return null;
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

  function minha(d) {
    return !!(st.eu && d.responsaveis && d.responsaveis.indexOf(st.eu.id) !== -1);
  }

  /* Projeto é o eixo de leitura: demanda de mentorado se agrupa por ele;
     interna, pelo texto livre em `projeto`; sem nada, vai para "Sem projeto". */
  /* Sem a coluna no banco, o projeto mora no começo do título: "[SDR IA Marina]
     Migrar pra Sonnet 5". A tela lê e escreve a tag; o resto do sistema (TV,
     Hermes) enxerga o título inteiro e não precisa saber da convenção. Quando a
     coluna existir, ela manda e a tag deixa de ser escrita. */
  var TAG = /^\s*\[([^\]]+)\]\s*/;

  function lerProjeto(d) {
    if (st.temProjeto && d.projeto) return String(d.projeto).trim();
    var m = TAG.exec(d.titulo || '');
    return m ? m[1].trim() : '';
  }

  function tituloSemTag(t) { return String(t || '').replace(TAG, ''); }

  function comTag(projeto, titulo) {
    var base = tituloSemTag(titulo);
    return projeto ? '[' + projeto + '] ' + base : base;
  }

  /* O que gravar ao trocar o projeto: coluna, ou o título reescrito. */
  function patchProjeto(r, v) {
    v = (v || '').trim();
    if (st.temProjeto) return { projeto: v || null };
    return { titulo: comTag(v, r.titulo) };
  }

  function projetoDe(d) {
    if (d.member_id) return { key:'m:' + d.member_id, nome:membro(d.member_id) || 'Mentorado removido', tipo:'mentorado' };
    var p = lerProjeto(d);
    if (p) return { key:'p:' + p.toLowerCase(), nome:p, tipo:'projeto' };
    return { key:'z:', nome:'Sem projeto', tipo:'vazio' };
  }

  function projetosExistentes() {
    var vistos = {};
    st.demands.forEach(function (d) {
      if (d.member_id) return;
      var p = lerProjeto(d);
      if (p) vistos[p.toLowerCase()] = p;
    });
    return Object.keys(vistos).sort().map(function (k) { return vistos[k]; });
  }

  /* Projeto em dois níveis, sem coluna nova: "Olympus / Imersão Grau Zero" é a
     frente "Imersão Grau Zero" dentro do pai "Olympus". Fechado na reunião de
     equipe de 02/09: Clínica Dr. Alex e Olympus são pais; cada mentorado segue
     no topo, como grupo próprio; projeto sem barra também fica no topo. */
  var SEP_PROJETO = ' / ';

  function partesProjeto(nome) {
    var i = String(nome || '').indexOf(SEP_PROJETO);
    if (i === -1) return { pai: null, frente: String(nome || '').trim() };
    return { pai: nome.slice(0, i).trim(), frente: nome.slice(i + SEP_PROJETO.length).trim() };
  }

  /* Opções do filtro de projeto: cada pai (lendo o guarda-chuva inteiro), as
     frentes dele indentadas, e por fim os projetos soltos. */
  function opcoesProjeto() {
    var nomes = projetosExistentes(), pais = {}, lista = [];
    nomes.forEach(function (n) {
      var pp = partesProjeto(n);
      if (pp.pai) pais[pp.pai.toLowerCase()] = pp.pai;
    });
    Object.keys(pais).sort().forEach(function (k) {
      lista.push({ value: pais[k], label: pais[k] + ' (tudo)' });
      nomes.forEach(function (n) {
        var pp = partesProjeto(n);
        if (pp.pai && pp.pai.toLowerCase() === k) lista.push({ value: n, label: '    ' + pp.frente });
      });
    });
    nomes.forEach(function (n) {
      if (!partesProjeto(n).pai) lista.push({ value: n, label: n });
    });
    return lista;
  }

  /* O filtro casa o nome inteiro (uma frente) ou só o pai (todas as frentes). */
  function casaProjeto(d, alvo) {
    var p = projetoDe(d);
    if (p.tipo !== 'projeto') return false;
    var n = p.nome.toLowerCase(); alvo = String(alvo || '').toLowerCase();
    return n === alvo || n.indexOf(alvo + SEP_PROJETO.toLowerCase()) === 0;
  }

  function demandasVisiveis() {
    return st.demands.filter(function (d) {
      if (st.demVisao === 'minhas' && !minha(d)) return false;
      if (st.demAbertas === 'open' && Club.DEM_ABERTOS.indexOf(d.status) === -1) return false;
      if (st.demResp && (!d.responsaveis || d.responsaveis.indexOf(st.demResp) === -1)) return false;
      if (st.demMembro && d.member_id !== st.demMembro) return false;
      if (st.demProjeto && !casaProjeto(d, st.demProjeto)) return false;
      return true;
    });
  }

  function renderDemandas() {
    var quadroAnterior = $('listaDemandas').querySelector('.tblw');
    var scrollAnterior = quadroAnterior ? quadroAnterior.scrollLeft : 0;
    var ativo = document.activeElement;
    var focoTitulo = ativo && ativo.matches('[data-sub-titulo]')
      ? { id:ativo.dataset.subTitulo, inicio:ativo.selectionStart, fim:ativo.selectionEnd } : null;
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

    var opProj = opcoesProjeto();
    if (st.demProjeto && !opProj.some(function (o) { return o.value.toLowerCase() === st.demProjeto.toLowerCase(); })) {
      st.demProjeto = '';
    }
    $('filtroProjetoDem').innerHTML = '<option value="">Qualquer projeto</option>' +
      opProj.map(function (o) {
        return '<option value="' + esc(o.value) + '"' +
          (o.value.toLowerCase() === String(st.demProjeto || '').toLowerCase() ? ' selected' : '') +
          '>' + esc(o.label) + '</option>';
      }).join('');

    /* A leitura escolhida fica guardada a cada desenho: é mais simples do que
       lembrar de salvar em cada botão, e cobre a escolha de "quem sou eu". */
    salvarPrefsDem();

    Array.prototype.forEach.call($('filtroAbertas').children, function (b) {
      b.setAttribute('aria-selected', String(b.dataset.ab === st.demAbertas));
    });
    Array.prototype.forEach.call($('filtroVisao').children, function (b) {
      b.setAttribute('aria-selected', String(b.dataset.visao === st.demVisao));
    });
    Array.prototype.forEach.call($('filtroAgrupar').children, function (b) {
      b.setAttribute('aria-selected', String(b.dataset.agrupar === st.demAgrupar));
    });
    $('filtroVisao').firstElementChild.textContent = st.eu
      ? 'Minhas (' + (st.eu.apelido || Club.initials(st.eu.nome)) + ')' : 'Minhas';

    var universo = st.demVisao === 'minhas' ? st.demands.filter(minha) : st.demands;
    var abertas = universo.filter(function (d) {
      return Club.DEM_ABERTOS.indexOf(d.status) !== -1;
    });
    var atrasadas = abertas.filter(function (d) {
      var n = Club.diffDays(d.vence_em);
      return n !== null && n < 0;
    });
    var risco = universo.filter(function (d) {
      return d.status === 'Em risco' || d.status === 'Aguardando retorno';
    });
    var semDono = abertas.filter(function (d) {
      return !d.responsaveis || !d.responsaveis.length;
    });

    if (st.demVisao === 'minhas') {
      /* Na leitura pessoal os cartões são a agenda: o que venceu, o que vence
         hoje, o que vence até domingo e o que ainda não tem dia. */
      var hoje = abertas.filter(function (d) { return Club.diffDays(d.vence_em) === 0; });
      var semana = abertas.filter(function (d) {
        var n = Club.diffDays(d.vence_em); return n !== null && n > 0 && n <= 6;
      });
      var semPrazo = abertas.filter(function (d) { return !d.vence_em; });
      $('statsDemandas').innerHTML =
        cardStat('ATRASADAS', atrasadas.length, atrasadas.length ? 'passaram do prazo' : 'nada atrasado') +
        cardStat('HOJE', hoje.length, hoje.length ? 'vencem hoje' : 'nada vence hoje') +
        cardStat('ESTA SEMANA', semana.length, 'vencem nos próximos 6 dias') +
        cardStat('SEM PRAZO', semPrazo.length, abertas.length + ' em aberto no total');
    } else {
      $('statsDemandas').innerHTML =
        cardStat('EM ABERTO', abertas.length, st.demands.length + ' no total') +
        cardStat('ATRASADAS', atrasadas.length, atrasadas.length ? 'passaram do prazo' : 'tudo dentro do prazo') +
        cardStat('PEDINDO ATENÇÃO', risco.length, 'em risco ou aguardando retorno') +
        cardStat('SEM RESPONSÁVEL', semDono.length, semDono.length ? 'ninguém tocando' : 'todas com dono');
    }

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
        st.demVisao === 'minhas' && !st.eu ? 'Clique em "Minhas" e diga quem você é no quadro.'
        : st.demResp || st.demMembro || st.demProjeto ? 'Nenhuma demanda com este filtro.'
        : st.demVisao === 'minhas' ? 'Nada em aberto no seu nome. Aproveite.'
        : 'Nenhuma demanda em aberto. Aproveite.');
      return;
    }

    /* Duas leituras da mesma tabela. "Por demanda": uma linha embaixo da outra,
       na ordem do banco (situação → prioridade → prazo, ver byDemanda), com a
       coluna Projeto pra filtrar. "Por projeto": as linhas se juntam sob o
       projeto (mentorado, ou pai → frente pra interna), o grupo que tem atraso
       vem primeiro e, dentro dele, quem vence antes. A coluna Projeto só
       aparece na lista: no agrupado ela é o cabeçalho. */
    var comProjeto = st.demAgrupar === 'lista';
    var larguras = [230, 132, 96, 140, 124].concat(comProjeto ? [128] : [])
      .concat([116, 116, 104]);
    var cols = 'minmax(230px,2fr) ' + larguras.slice(1).map(function (n) { return n + 'px'; }).join(' ');
    var cabecalhos = ['Demanda', 'Situação', 'Prioridade', 'Responsáveis', 'Mentorado']
      .concat(comProjeto ? ['Projeto'] : [])
      .concat(['Checklist', 'Prazo', '>Ações']);

    var corpo = st.demAgrupar === 'projeto'
      ? gruposPorProjeto(rows).map(function (g) { return linhaGrupo(g, 0); }).join('')
      : rows.map(function (d) { return linhaDemanda(d, comProjeto); }).join('');

    $('listaDemandas').innerHTML = avisoCk + tabela(cols, cabecalhos, corpo, '');
    Club.ajustarColunas($('listaDemandas'), {
      chave:chaveDem() + ':colunas:' + st.demAgrupar, minimos:larguras
    });
    $('listaDemandas').querySelector('.tblw').scrollLeft = scrollAnterior;

    /* O campo de subtarefa é redesenhado a cada render: sem devolver o foco, o
       Enter que salvou uma subtarefa deixaria o time digitando no vazio. */
    if (st.novaSub) {
      var campo = $('listaDemandas').querySelector('[data-sub-inp]');
      if (campo) campo.focus();
    }
    if (focoTitulo) {
      var tituloAtivo = $('listaDemandas').querySelector('[data-sub-titulo="' + focoTitulo.id + '"]');
      if (tituloAtivo && !tituloAtivo.disabled) {
        tituloAtivo.focus({ preventScroll:true });
        tituloAtivo.setSelectionRange(focoTitulo.inicio, focoTitulo.fim);
      }
    }
    Club.reancorarMenu();
  }

  /* Prazo mais próximo primeiro; sem prazo por último; empate = prioridade. */
  var PESO_PRIO = { 'Alta':0, 'Média':1, 'Baixa':2 };
  function porPrazo(a, b) {
    var fa = Club.DEM_ABERTOS.indexOf(a.status) === -1;
    var fb = Club.DEM_ABERTOS.indexOf(b.status) === -1;
    if (fa !== fb) return fa ? 1 : -1;
    var pa = a.vence_em || '9999', pb = b.vence_em || '9999';
    if (pa !== pb) return pa < pb ? -1 : 1;
    return (PESO_PRIO[a.prioridade] || 1) - (PESO_PRIO[b.prioridade] || 1);
  }

  function contarGrupo(g, itens) {
    var abertas = itens.filter(function (d) { return Club.DEM_ABERTOS.indexOf(d.status) !== -1; });
    g.abertas = abertas.length;
    g.atrasadas = abertas.filter(function (d) {
      var n = Club.diffDays(d.vence_em); return n !== null && n < 0;
    }).length;
    g.hoje = abertas.filter(function (d) { return Club.diffDays(d.vence_em) === 0; }).length;
    var prazos = abertas.map(function (d) { return d.vence_em || '9999'; }).sort();
    g.proximo = prazos[0] || '9999';
  }

  function ordemGrupo(a, b) {
    if (a.atrasadas !== b.atrasadas) return b.atrasadas - a.atrasadas;
    if (a.hoje !== b.hoje) return b.hoje - a.hoje;
    if (a.proximo !== b.proximo) return a.proximo < b.proximo ? -1 : 1;
    if (a.tipo !== b.tipo) return a.tipo === 'vazio' ? 1 : b.tipo === 'vazio' ? -1 : 0;
    return a.nome.localeCompare(b.nome);
  }

  function gruposPorProjeto(rows) {
    var mapa = {};
    rows.forEach(function (d) {
      var p = projetoDe(d);
      var g = mapa[p.key] = mapa[p.key] || { key:p.key, nome:p.nome, tipo:p.tipo, itens:[], filhos:[] };
      g.itens.push(d);
    });
    var grupos = Object.keys(mapa).map(function (k) { return mapa[k]; });
    grupos.forEach(function (g) { g.itens.sort(porPrazo); contarGrupo(g, g.itens); });

    /* Projeto "Pai / Frente" sobe pro pai: o pai é uma linha que abre e fecha
       as frentes dele e soma os números delas. Mentorado e projeto sem barra
       ficam no topo, como antes. */
    var pais = {}, topo = [];
    grupos.forEach(function (g) {
      var pp = g.tipo === 'projeto' ? partesProjeto(g.nome) : { pai: null };
      if (!pp.pai) { topo.push(g); return; }
      var pk = 'pai:' + pp.pai.toLowerCase();
      var pai = pais[pk] = pais[pk] || { key:pk, nome:pp.pai, tipo:'pai', itens:[], filhos:[] };
      g.nome = pp.frente;
      pai.filhos.push(g);
    });
    Object.keys(pais).forEach(function (k) {
      var pai = pais[k];
      pai.filhos.sort(ordemGrupo);
      contarGrupo(pai, pai.filhos.reduce(function (acc, f) { return acc.concat(f.itens); }, []));
      topo.push(pai);
    });
    topo.sort(ordemGrupo);
    return topo;
  }

  function linhaGrupo(g, nivel) {
    nivel = nivel || 0;
    var chave = 'g:' + g.key;
    var fechado = !!st.grpFechado[chave];
    var meta = '<b>' + g.abertas + '</b> em aberto' +
      (g.atrasadas ? ' · <span class="late"><b>' + g.atrasadas + '</b> atrasada' + (g.atrasadas > 1 ? 's' : '') + '</span>' : '') +
      (g.hoje ? ' · <span class="today"><b>' + g.hoje + '</b> hoje</span>' : '');
    var rotulo = g.tipo === 'mentorado' ? 'mentorado'
      : g.tipo === 'pai' ? g.filhos.length + (g.filhos.length === 1 ? ' frente' : ' frentes')
      : g.tipo === 'projeto' ? (nivel ? 'frente' : 'projeto') : '';
    var cab = '<div class="tr grp' + (nivel ? ' sub' : '') + (g.tipo === 'pai' ? ' pai' : '') +
      '" data-grupo="' + esc(chave) + '">' +
      '<div class="grp-t"><button class="tg" aria-expanded="' + (!fechado) +
        '" aria-label="Abrir ou fechar projeto">' + ico('chevron-right') + '</button>' +
        '<span class="grp-n">' + esc(g.nome) + '</span>' +
        '<span class="grp-k">' + rotulo + '</span>' +
      '</div><div class="grp-m">' + meta + '</div></div>';
    if (fechado) return cab;
    return cab +
      g.filhos.map(function (f) { return linhaGrupo(f, nivel + 1); }).join('') +
      g.itens.map(function (d) { return linhaDemanda(d, false); }).join('');
  }

  function linhaDemanda(d, comProjeto) {
    var cor = Club.DEM_COR[d.status];
    var fechada = Club.DEM_ABERTOS.indexOf(d.status) === -1;

    var chave = 'd:' + d.id;
    var etapas = etapasDaDemanda(d.id);
    var feitas = etapas.filter(function (e) { return e.feito; }).length;
    /* De onde veio e o que é: as duas linhas curtas cabem juntas embaixo do
       título e liberam a coluna para o checklist. */
    var sub = [d.origem, d.descricao].filter(Boolean).join(' · ');
    var titulo = d.member_id ? d.titulo : tituloSemTag(d.titulo);

    var linha = '<div class="tr' + (fechada ? ' off' : '') + '"' +
      ' style="box-shadow:inset 3px 0 0 ' + cor + '">' +
      '<div class="td nm">' + toggleOuAdd(chave, etapas.length, d.id) +
        '<button type="button" class="demand-open" data-detalhe-demanda="' + esc(d.id) +
          '" aria-label="Ver demanda: ' + esc(titulo) + '">' +
          '<span class="tx tx-t">' + esc(titulo) + '</span>' +
          (sub ? '<span class="tx tx-s">' + esc(sub) + '</span>' : '') +
        '</button></div>' +
      colunasDe(d, 'd') +
      (comProjeto ? celulaProjeto(d) : '') +
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
    var filhos = st.abertos[chave] ? etapas.map(function (e) {
      return linhaSubtarefa(e, comProjeto);
    }).join('') : '';
    return linha + filhos + linhaNovaSub(d.id);
  }

  /* Texto livre, mas com memória: o menu lista os projetos que já existem e
     deixa criar um novo. Demanda de mentorado não tem projeto: o mentorado é
     o projeto dela. */
  function celulaProjeto(d) {
    if (d.member_id) return tdCel('<span class="tx tx-s">' + esc(membro(d.member_id) || '—') + '</span>');
    var p = lerProjeto(d);
    return tdCel(celula('d.projeto', d.id, '<span class="tx">' + esc(p || 'sem projeto') + '</span>', !p));
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
      '<span class="tx"' + (atrasada ? ' style="color:var(--danger)"' : '') + '>' +
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
  function linhaSubtarefa(e, comProjeto) {
    var edicao = st.edicaoSub[e.id];
    var nome = edicao
      ? '<div class="sub-title-editor" aria-busy="' + (!!edicao.salvando) + '">' +
          '<input class="sub-inp" data-sub-titulo="' + esc(e.id) + '" value="' + esc(edicao.titulo) +
          '" aria-label="Nome da subtarefa" autocomplete="off"' + (edicao.salvando ? ' disabled' : '') +
          (edicao.erro ? ' aria-invalid="true" aria-describedby="sub-erro-' + esc(e.id) + '"' : '') + '>' +
          (edicao.erro ? '<span class="sub-title-error" id="sub-erro-' + esc(e.id) + '" role="alert">' +
            esc(edicao.erro) + '</span>' : '') +
          (edicao.salvando ? '<span class="sub-title-hint" role="status">Salvando…</span>' : '') + '</div>'
      : '<button type="button" class="demand-open" data-detalhe-sub="' + esc(e.id) +
          '" aria-label="Ver subtarefa: ' + esc(e.titulo) + '">' +
          '<span class="tx tx-t">' + esc(e.titulo) + '</span></button>';
    var acoes = edicao
      ? '<button type="button" class="btn btn-sm btn-ghost" data-sub-salvar="' + esc(e.id) +
          '" aria-label="Salvar nome da subtarefa" title="Salvar (Enter)"' +
          (edicao.salvando ? ' disabled' : '') + '>' + ico('check') + '</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-sub-cancelar="' + esc(e.id) +
          '" aria-label="Cancelar edição do nome" title="Cancelar (Esc)"' +
          (edicao.salvando ? ' disabled' : '') + '>' + ico('x') + '</button>'
      : '<button type="button" class="btn btn-sm btn-ghost" data-sub-editar="' + esc(e.id) +
          '" aria-label="Editar nome da subtarefa" title="Editar nome">' + ico('edit') + '</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-del-sub="' + esc(e.id) +
          '" aria-label="Remover subtarefa">' + ico('trash') + '</button>';
    return '<div class="tr lv1' + (e.feito ? ' feito' : '') + (edicao ? ' sub-editing' : '') + '">' +
      '<div class="td nm"><span class="tg void"></span>' +
        '<button class="cbx" data-sub="' + esc(e.id) + '" aria-pressed="' + (!!e.feito) +
          '" title="' + (e.feito && e.feito_em
            ? esc('Feito em ' + Club.fmtDataCurta(e.feito_em))
            : 'Marcar como concluída') + '"' +
          ' aria-label="Marcar subtarefa">' + ico('check') + '</button>' +
        nome + '</div>' +
      colunasDe(e, 's') +
      (comProjeto ? td('') : '') +
      td('') +
      celulaPrazo(e, 's') +
      '<div class="td end"><div class="row-acts">' + acoes + '</div></div>' +
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
     a coluna é o controle. Título e descrição da demanda ficam no formulário;
     o título da subtarefa também pode ser editado pelo lápis na linha. */

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

    if (par[1] === 'projeto') {
      var atual = lerProjeto(r);
      var itens = [{ value:'', label:'Sem projeto', checked:!atual }]
        .concat(projetosExistentes().map(function (p) {
          return { value:p, label:p, checked:p.toLowerCase() === atual.toLowerCase() };
        }))
        .concat([{ value:'__novo', label:'Novo projeto…' }]);
      Club.menu(el, itens, { titulo:'Projeto', onPick:function (v) {
        if (v === '__novo') {
          var nome = window.prompt('Nome do projeto', atual);
          if (nome === null) return;
          v = nome.trim();
        }
        salvar(r.id, patchProjeto(r, v));
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

  function focarTituloSub(id, selecionar) {
    var campo = $('listaDemandas').querySelector('[data-sub-titulo="' + id + '"]');
    if (campo && !campo.disabled) {
      campo.focus();
      if (selecionar) campo.select();
    }
  }

  function focarBotaoSub(id) {
    var botao = $('listaDemandas').querySelector('[data-sub-editar="' + id + '"]');
    if (botao && document.activeElement === document.body) botao.focus({ preventScroll:true });
  }

  function editarTituloSub(id) {
    var registro = etapa(id);
    if (!registro) return;
    st.edicaoSub[id] = st.edicaoSub[id] || { titulo:registro.titulo || '', salvando:false, erro:'' };
    renderDemandas();
    focarTituloSub(id, true);
  }

  function fecharTituloSub(id, salvar) {
    var edicao = st.edicaoSub[id], registro = etapa(id);
    if (!edicao || edicao.salvando) return;
    var titulo = edicao.titulo.trim();
    if (!salvar || !registro || titulo === registro.titulo) {
      delete st.edicaoSub[id];
      renderDemandas();
      focarBotaoSub(id);
      return;
    }
    if (!titulo) {
      edicao.erro = 'A subtarefa precisa de um nome.';
      renderDemandas();
      focarTituloSub(id);
      return;
    }
    edicao.salvando = true;
    edicao.erro = '';
    renderDemandas();
    /* Atualiza o mesmo registro: só o título viaja, sem recriar o checklist. */
    Club.data.demandSteps.save({ id:id, titulo:titulo }).then(function (linha) {
      var atual = etapa(id);
      if (atual) atual.titulo = linha.titulo;
      delete st.edicaoSub[id];
      renderDemandas();
      focarBotaoSub(id);
    }).catch(function (err) {
      edicao.salvando = false;
      edicao.erro = err.message || 'Não foi possível salvar. Tente novamente.';
      renderDemandas();
    });
  }

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

  /* Leitura completa, sem entrar no formulário nem alterar o registro. */
  function detalheDemanda(id, subId) {
    var d = achar('demand', id);
    var r = subId ? etapa(subId) : d;
    if (!d || !r) return;
    var projeto = projetoDe(d);
    var titulo = subId || d.member_id ? r.titulo : tituloSemTag(r.titulo);
    var etapas = subId ? [] : etapasDaDemanda(d.id);
    var feitas = etapas.filter(function (e) { return e.feito; }).length;
    function campo(nome, valor) {
      return '<div><dt>' + esc(nome) + '</dt><dd>' + valor + '</dd></div>';
    }
    Club.modal.open({
      title:subId ? 'Detalhes da subtarefa' : 'Detalhes da demanda',
      leitura:true, largura:780,
      body:'<article class="demand-detail">' +
        '<p class="demand-context">' + esc(projeto.nome) + '</p>' +
        '<h3 class="demand-title">' + esc(titulo) + '</h3>' +
        (subId ? '<button type="button" class="demand-parent" data-detalhe-demanda="' + esc(d.id) +
          '">' + ico('chevron-right') + '<span>Demanda principal: ' +
          esc(d.member_id ? d.titulo : tituloSemTag(d.titulo)) + '</span></button>' : '') +
        '<dl class="demand-meta">' +
          campo('Situação', status(Club.DEM_COR[r.status] || 'var(--faint)', r.status || 'Não informada')) +
          campo('Prioridade', status(Club.DEM_PRIO_COR[r.prioridade] || 'var(--faint)', r.prioridade || 'Não informada')) +
          campo('Responsáveis', esc(responsaveisDe(r))) +
          campo('Prazo', esc(r.vence_em ? Club.fmtDataCurta(r.vence_em) : 'Sem prazo')) +
          campo('Mentorado', esc(r.member_id ? membro(r.member_id) || 'Mentorado removido' : 'Demanda interna')) +
          (!subId ? campo('Origem', esc(r.origem || 'Não informada')) : '') +
        '</dl>' +
        (!subId ? '<section class="demand-section"><h4>Descrição</h4><p class="demand-description">' +
          esc(d.descricao || 'Nenhuma descrição adicionada.') + '</p></section>' : '') +
        (!subId ? '<section class="demand-section"><h4>Checklist <span>' + feitas + '/' + etapas.length +
          '</span></h4>' + (etapas.length ? '<ul class="demand-checklist">' + etapas.map(function (e) {
            return '<li><button type="button" class="demand-step" data-detalhe-sub="' + esc(e.id) + '">' +
              '<span class="demand-step-icon' + (e.feito ? ' done' : '') + '">' +
                ico(e.feito ? 'check-circle' : 'clock') + '</span><span class="demand-step-body">' +
                '<span class="demand-step-title">' + esc(e.titulo) + '</span>' +
                '<span class="demand-step-meta">' + esc([e.status || (e.feito ? 'Concluída' : 'A fazer'),
                  responsaveisDe(e), e.vence_em ? Club.fmtDataCurta(e.vence_em) : 'Sem prazo'].join(' · ')) +
                '</span></span>' + ico('chevron-right') + '</button></li>';
          }).join('') + '</ul>' : '<p class="demand-description">Nenhuma subtarefa adicionada.</p>') + '</section>' : '') +
        '<div class="demand-detail-actions"><button type="button" class="btn" data-edit="demand" data-id="' +
          esc(d.id) + '">' + ico('edit') + (subId ? 'Editar demanda principal' : 'Editar demanda') + '</button></div>' +
      '</article>'
    });
  }

  function modalDemanda(d) {
    var novo = !d;
    d = d || { titulo:'', descricao:'', status:'A fazer', prioridade:'Média',
               responsaveis:[], member_id:null, origem:'', vence_em:'', projeto:'' };
    var subAtuais = d.id ? etapasDaDemanda(d.id) : [];

    var opcoesEquipe = st.staff.filter(function (p) { return p.ativo; })
      .map(function (p) { return { value:p.id, label:p.nome }; });

    Club.modal.open({
      title: novo ? 'Nova demanda' : 'Editar demanda',
      sub: novo ? 'Operação interna — o mentorado não enxerga isto.' : d.titulo,
      body:
        Club.field('O que precisa ser feito', 'titulo', { value:tituloSemTag(d.titulo), required:true,
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
        Club.field('Projeto', 'projeto', { value:d.id ? lerProjeto(d) : '',
          placeholder:'SDR IA Marina, Tráfego B2C Dr. Alex, Sistema Black…',
          hint:'Só para demanda interna; a de mentorado se agrupa por ele. ' +
               (projetosExistentes().length ? 'Existem: ' + projetosExistentes().join(', ') + '.' : '') }) +
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
        var proj = dados.member_id ? '' : String(dados.projeto || '').trim();
        if (st.temProjeto) { dados.projeto = proj || null; dados.titulo = tituloSemTag(dados.titulo); }
        else { delete dados.projeto; dados.titulo = comTag(proj, dados.titulo); }

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
    /* O cascade leva etapas e o progresso de todo mundo; o aviso diz quanto. */
    artifact: { store:'artifacts', nome:function (r) { return r.nome; },
                aviso:function (r) {
                  var et = etapasDe(r.id), m = marcasDe(et);
                  if (!et.length) return '';
                  return 'Saem junto ' + et.length + ' etapa' + (et.length === 1 ? '' : 's') +
                    (m.marcas ? ' e ' + m.marcas + ' marcações de ' + m.mentorados + ' mentorados.' : '.');
                } },
    group:    { store:'groups',    nome:function (r) { return r.nome; },
                aviso:function (r) {
                  var n = st.artifacts.filter(function (a) { return a.group_id === r.id; }).length;
                  return n ? 'Os ' + n + ' artefatos dele ficam "Sem grupo"; nada de progresso muda.' : '';
                } },
    material:  { store:'materials',  nome:function (r) { return r.titulo; },
                 aviso:'O arquivo sai do servidor junto.' },
    demand:    { store:'demands',    nome:function (r) { return r.titulo; },
                 aviso:'As subtarefas dela saem junto.' },
    staff:     { store:'staff',      nome:function (r) { return r.nome; },
                 aviso:'As demandas dele continuam, sem responsável.' },
    /* Sem esta linha o clique em Editar/Responder morre em silêncio: achar()
       procura o store aqui e estoura antes de o modal abrir. */
    botExemplo: { store:'botExemplos', nome:function (r) { return r.comentario; },
                  aviso:'' }
  };

  function achar(tipo, id) {
    return st[TIPOS[tipo].store].filter(function (r) { return r.id === id; })[0];
  }

  function remover(tipo, id) {
    var reg = achar(tipo, id);
    if (!reg) return;
    var t = TIPOS[tipo];
    var avisoTipo = typeof t.aviso === 'function' ? t.aviso(reg) : t.aviso;
    Club.modal.confirm('Remover?',
      ['"' + t.nome(reg) + '" será apagado.', avisoTipo, 'Não dá para desfazer.']
        .filter(Boolean).join(' '),
      function () {
        Club.data[t.store].remove(id)
          .then(function () { recarregar('Removido.'); })
          .catch(aviso);
      });
  }

  var MODAIS = { member:modalMembro, task:modalTarefa, event:modalEvento,
                 artifact:modalArtefato, group:modalGrupo, material:modalMaterial,
                 demand:modalDemanda, botExemplo:modalBotExemplo };

  /* ── eventos ──────────────────────────────────────────────────────────── */

  document.addEventListener('click', function (e) {
    var notaAbrir = e.target.closest('[data-nota-abrir]');
    if (notaAbrir) { abrirNota(notaAbrir.dataset.notaAbrir); return; }
    var notaSalvar = e.target.closest('[data-nota-salvar]');
    if (notaSalvar) { fecharNota(notaSalvar.dataset.notaSalvar, true); return; }
    var notaCancelar = e.target.closest('[data-nota-cancelar]');
    if (notaCancelar) { fecharNota(notaCancelar.dataset.notaCancelar, false); return; }

    var editarSub = e.target.closest('[data-sub-editar]');
    if (editarSub) { editarTituloSub(editarSub.dataset.subEditar); return; }
    var salvarSub = e.target.closest('[data-sub-salvar]');
    if (salvarSub) { fecharTituloSub(salvarSub.dataset.subSalvar, true); return; }
    var cancelarSub = e.target.closest('[data-sub-cancelar]');
    if (cancelarSub) { fecharTituloSub(cancelarSub.dataset.subCancelar, false); return; }

    var detalhe = e.target.closest('[data-detalhe-demanda]');
    if (detalhe) { detalheDemanda(detalhe.dataset.detalheDemanda); return; }

    var detalheSub = e.target.closest('[data-detalhe-sub]');
    if (detalheSub) {
      var subRegistro = etapa(detalheSub.dataset.detalheSub);
      if (subRegistro) detalheDemanda(subRegistro.demand_id, subRegistro.id);
      return;
    }

    var nav = e.target.closest('[data-nav]');
    if (nav) { go(nav.dataset.nav); return; }

    var novo = e.target.closest('[data-new]');
    if (novo) { MODAIS[novo.dataset.new](); return; }

    var editar = e.target.closest('[data-edit]');
    if (editar) { MODAIS[editar.dataset.edit](achar(editar.dataset.edit, editar.dataset.id)); return; }

    var apagar = e.target.closest('[data-del]');
    if (apagar) { remover(apagar.dataset.del, apagar.dataset.id); return; }

    var bfila = e.target.closest('#filtroBotFila button');
    if (bfila) { st.botFila = bfila.dataset.fila; renderBotFila(); return; }

    var igper = e.target.closest('#igPeriodo button');
    if (igper) {
      st.igDetDias = Number(igper.dataset.igdias);
      var atual = document.querySelector('.ig-arroba');
      if (atual) {
        var u = atual.textContent.replace('@', '');
        var linha = (st.igResumo || []).filter(function (x) { return x.username === u; })[0];
        Club.modal.close();
        /* Já temos a série desta conta em mãos: trocar 30/90/180 é recortar o
           que está na memória, não voltar ao banco. */
        if (linha) desenharDetalheIg(linha, st.igDetDias, st.igSerieConta || []);
      }
      return;
    }

    var igdet = e.target.closest('[data-ig-det]');
    if (igdet && !e.target.closest('a')) { abrirDetalheIg(igdet.dataset.igDet); return; }

    var big = e.target.closest('#filtroIg button');
    if (big) {
      st.igOrdem = big.dataset.ig;
      Array.prototype.forEach.call(document.querySelectorAll('#filtroIg button'), function (b) {
        b.setAttribute('aria-selected', String(b === big));
      });
      renderIgMetricas();
      return;
    }

    var bap = e.target.closest('[data-bot-aprovar]');
    if (bap) { aprovarResposta(bap.dataset.botAprovar); return; }

    var bdes = e.target.closest('[data-bot-descartar]');
    if (bdes) { descartarResposta(bdes.dataset.botDescartar); return; }

    var bat = e.target.closest('[data-bot-ativo]');
    if (bat) { alternarExemplo(bat.dataset.botAtivo); return; }

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

    var vis = e.target.closest('#filtroVisao button');
    if (vis) {
      if (vis.dataset.visao === 'minhas' && (!st.eu || st.demVisao === 'minhas')) {
        /* Sem vínculo no banco (ou clique repetido) o botão pergunta quem é. */
        vis.dataset.menuId = 'eu';
        escolherEu(vis);
        return;
      }
      st.demVisao = vis.dataset.visao; renderDemandas(); return;
    }

    var agr = e.target.closest('#filtroAgrupar button');
    if (agr) { st.demAgrupar = agr.dataset.agrupar; renderDemandas(); return; }

    var grp = e.target.closest('[data-grupo]');
    if (grp) {
      var gk = grp.dataset.grupo;
      st.grpFechado[gk] = !st.grpFechado[gk];
      renderDemandas();
      return;
    }

    /* Um galho só: a chave diz de qual árvore ele é ('d:' é demanda). */
    var galho = e.target.closest('[data-abrir]');
    if (galho) {
      var k = galho.dataset.abrir;
      st.abertos[k] = !st.abertos[k];
      if (k.charAt(0) === 'd') renderDemandas(); else renderMembers();
      return;
    }

    var etapaBotao = e.target.closest('[data-etapa]');
    if (etapaBotao) {
      var par = etapaBotao.dataset.etapa.split('|');
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

  document.addEventListener('input', function (e) {
    if (e.target.matches('[data-nota-texto]')) {
      var nota = st.notasEdit[e.target.dataset.notaTexto];
      if (nota && !nota.salvando) {
        nota.texto = e.target.value;
        nota.erro = '';
        e.target.removeAttribute('aria-invalid');
        e.target.setAttribute('aria-describedby', e.target.id + '-ajuda');
        var erroNota = e.target.parentElement.querySelector('.progress-note-error');
        if (erroNota) erroNota.remove();
      }
      return;
    }
    if (!e.target.matches('[data-sub-titulo]')) return;
    var edicao = st.edicaoSub[e.target.dataset.subTitulo];
    if (!edicao || edicao.salvando) return;
    edicao.titulo = e.target.value;
    edicao.erro = '';
    e.target.removeAttribute('aria-invalid');
    e.target.removeAttribute('aria-describedby');
    var erro = e.target.parentElement.querySelector('.sub-title-error');
    if (erro) erro.remove();
  });

  /* Enter salva e o campo continua de pé para o próximo item; Esc desiste;
     sair do campo confirma o que já estava escrito. */
  document.addEventListener('keydown', function (e) {
    if (!e.target.matches) return;
    if (e.target.matches('[data-nota-texto]')) {
      if (e.isComposing) return;
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        fecharNota(e.target.dataset.notaTexto, e.key !== 'Escape');
      }
      return;
    }
    if (e.target.matches('[data-sub-titulo]')) {
      if (e.isComposing) return;
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        fecharTituloSub(e.target.dataset.subTitulo, e.key === 'Enter');
      }
      return;
    }
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

  $('filtroArtGrupo').addEventListener('change', function () {
    st.artGrupo = this.value;
    renderArtifacts();
  });

  $('filtroResponsavel').addEventListener('change', function () {
    st.demResp = this.value;
    renderDemandas();
  });

  $('filtroMembroDem').addEventListener('change', function () {
    st.demMembro = this.value;
    renderDemandas();
  });

  $('filtroProjetoDem').addEventListener('change', function () {
    st.demProjeto = this.value;
    renderDemandas();
  });

  $('filtroBotGrupo').addEventListener('change', function () {
    st.botGrupo = this.value;
    renderBotExemplos();
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
    renderIgMetricas();
    renderBotFila();
    renderBotExemplos();
    Club.graduacao.mountAdmin($('graduacaoAdmin'), st.members);
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
    return carregar().then(function () {
      render();
      /* #demandas na URL abre direto no quadro: é o atalho que vai no favorito. */
      var alvo = (location.hash || '').replace('#', '');
      go(alvo === 'demandas' ? 'demands' : alvo && document.querySelector('.view[data-view="' + alvo + '"]') ? alvo : 'overview');
    });
  }).catch(falhou);
})();
