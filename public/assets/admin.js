/* ============================================================================
   Club OftalmoBlack — painel do administrador

   Cadastra membros, agenda, artefatos e demandas. Tudo passa por Club.data, que
   na Etapa 2 troca o localStorage pelo Supabase sem mexer neste arquivo.
   ========================================================================= */
(function () {
  'use strict';

  var sessao = null;

  var st = { members: [], events: [], artifacts: [], materials: [],
             demands: [], staff: [], steps: [], progress: [], demandSteps: [],
             groups: [], artGrupo: '', progressNotes: [], notasEdit: {},
             qrLinks: [], qrScans: [],
             view: 'farol', igOrdem: 'seguidores',
             matCategoria: '', matMembro: '',
             demResp: '', demMembro: '', demFrente: '', demAbertas: 'open',
             /* Recorte aberto por um cartão do painel (atrasadas, sem dono…).
                Não é leitura guardada: é um mergulho, e mora na URL. */
             demFoco: '',
             /* "Minhas" é a leitura padrão do quadro: quem abre vê o que é seu,
                agrupado por frente. "eu" é a pessoa da equipe ligada ao login
                (staff.user_id) ou, enquanto a migração não roda, a escolhida no
                próprio botão e guardada neste navegador. */
             demVisao: 'minhas', demAgrupar: 'frente', eu: null,
             grpFechado: {},
             arvMembro: '', arvFiltro: 'all',
             /* Demanda que está com a linha de nova subtarefa aberta. */
             novaSub: null, zapEdit: null, edicaoSub: {},
             /* Quais galhos das árvores (membros e demandas) estão abertos.
                Fica na tela, não no banco: é postura de leitura do momento. */
             abertos: {},
             /* Demandas fechadas nesta leitura. Continuam na lista mesmo com o
                filtro "Em aberto", até a pessoa trocar visão ou filtro: quem
                conclui precisa ver que concluiu — e poder reabrir no mesmo lugar. */
             recemFechadas: {},
             /* Detalhe aberto: na janela (detalheModal) ou destacado no painel
                flutuante (painel). Cada um guarda { id, subId }. */
             detalheModal: null, painel: null };

  /* A navegação é uma árvore de um nível: quem é solto fica solto, quem tem
     'itens' vira um grupo com título. Agenda e Materiais moram em Mentorados
     porque são o que o mentorado consome; Artefatos mora em Time porque é o
     que o time produz. A chave de cada view continua a mesma — só o rótulo de
     'members' mudou para Progressão. */
  var NAV = [
    { key:'farol', label:'Farol', icon:'eye' },
    { grupo:'Mentorados', itens: [
      { key:'members',   label:'Progressão', icon:'users' },
      { key:'graduacao', label:'Graduação', icon:'award' },
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
    ] },
    { grupo:'Imersão', itens: [
      { key:'qr',        label:'QR da credencial', icon:'link' }
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
  }

  $('sair').addEventListener('click', function () { Club.auth.logout(); });
  $('verComoMembro').addEventListener('click', function () {
    var id = Club.farol.selected();
    if (id) this.href = '/membros/?membro=' + encodeURIComponent(id);
  });

  /* ── dados ────────────────────────────────────────────────────────────── */

  function carregar() {
    return Promise.all([
      Club.data.members.list(),
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
      Club.data.progressNotes.list(),
      Club.data.qrLinks.list(),
      Club.data.qrScans.list()
    ]).then(function (r) {
      st.members = r[0]; st.events = r[1];
      st.artifacts = r[2]; st.materials = r[3];
      st.demands = r[4]; st.staff = r[5];
      st.steps = r[6]; st.progress = r[7]; st.demandSteps = r[8];
      st.botExemplos = r[9]; st.botRespostas = r[10];
      st.igResumo = r[11]; st.igSerie = r[12];
      st.groups = r[13];
      st.progressNotes = r[14];
      st.qrLinks = r[15]; st.qrScans = r[16];
      indexar();
      descobrirEu();
    });
  }

  /* ── quem sou eu no quadro ─────────────────────────────────────────────
     Primeiro pelo vínculo do banco (staff.user_id = login). Sem vínculo, vale a
     escolha feita no botão "Minhas" e guardada no localStorage: é o que deixa o
     quadro funcionar hoje, antes de o SQL de 02/09 rodar. */
  var CHAVE_EU = 'ob-admin-eu';

  /* Leitura da aba Demandas guardada no navegador, por login: visão, agrupamento,
     filtros e quais grupos estão fechados. Quem volta ao quadro encontra a
     leitura que deixou, sem mexer em filtro de novo (pedido da equipe 02/09). */
  var CHAVE_DEM = 'ob-admin-dem';
  var PREFS_DEM = ['demVisao', 'demAgrupar', 'demAbertas', 'demResp', 'demMembro', 'demFrente', 'grpFechado'];

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
    /* Preferência gravada antes da fase 3: "por projeto" virou "por frente". */
    if (st.demAgrupar === 'projeto') st.demAgrupar = 'frente';
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
  /* Frente interna (tipo 'interna') é da equipe: só agrupa demandas. Não
     entra na Progressão nem nas contas, mesmo estando em st.artifacts. */
  function artefatosDe(memberId) {
    return st.artifacts.filter(function (a) {
      return a.tipo !== 'interna' && (!a.member_id || a.member_id === memberId);
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

  /* Mexer numa demanda não precisa reler o painel inteiro (são dezoito
     consultas, Instagram incluído): só o quadro e a equipe voltam do banco.
     Galhos abertos, scroll e as fechadas há pouco continuam de pé. */
  function recarregarDemandas(msg) {
    return Promise.all([
      Club.data.demands.list(),
      Club.data.demandSteps.list(),
      Club.data.staff.list()
    ]).then(function (r) {
      st.demands = r[0];
      st.demandSteps = r[1];
      st.staff = r[2];
      if (st.eu) st.eu = st.staff.filter(function (p) { return p.id === st.eu.id; })[0] || null;
      indexar();
      renderDemandas();
      /* O contador de demandas da etapa (Progressão) lê o mesmo quadro. */
      renderMembers();
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
      '<div class="v">' + st.demands.filter(function (d) { return Club.DEM_ABERTOS.indexOf(d.status) !== -1; }).length +
      ' demandas em aberto agora.</div></div>';

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
    /* Só o quadro escreve na URL: #demandas já era o atalho do favorito, e o
       recorte vai junto dele. As outras abas seguem sem endereço. */
    sincronizarHash();
    if (key === 'farol') {
      montarFarol();
      Club.farol.enter(lerHash().secao === 'farol' ? location.hash : '');
    } else if (location.hash.indexOf('#farol/') === 0 && key !== 'demands') {
      history.replaceState(null, '', location.pathname + location.search);
    }
    /* O painel destacado é da aba Demandas: some com ela e volta com ela. */
    var painel = $('painelDemanda');
    if (painel) painel.hidden = key !== 'demands' || !st.painel;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* `dica` é opcional: quando existe, o cartão explica ao passar o mouse o que
     aquele número quer dizer. Número sem definição vira discussão na reunião.
     `foco` também: com ele o cartão vira botão e o clique abre a lista que o
     número resume (ver FOCOS, na aba Demandas). */
  function cardStat(k, v, d, dica, foco) {
    var tag = foco ? 'button' : 'div';
    return '<' + tag + ' class="stat' + (dica ? ' tem-dica' : '') + (foco ? ' foco' : '') + '"' +
      (dica ? ' data-dica="' + esc(dica) + '"' : '') +
      (foco ? ' type="button" data-foco="' + esc(foco) + '" aria-pressed="' + (st.demFoco === foco) +
        '" title="Ver esta lista"' : '') + '>' +
      '<div class="k">' + esc(k) + '</div>' +
      '<div class="v">' + esc(v) + '</div><div class="d">' + esc(d) + '</div></' + tag + '>';
  }

  /* ── membros ──────────────────────────────────────────────────────────── */
  /* Uma tela só. O mentorado é a linha-mãe e abre no que está combinado com
     ele: os artefatos, que abrem no próprio checklist. Cadastro
     e progresso eram a mesma pergunta — "como está fulano?" — feita em dois
     lugares diferentes, e responder exigia ir e voltar entre as duas abas.

     Três níveis, como no ClickUp:

       Mentorado
         └ Artefato → etapa do checklist (padrão do artefato)

     Tarefa do mentorado não existe mais (fase 4 da taxonomia): a ação dele é
     etapa trava do artefato, cobrada por demanda da CS no quadro.

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

  var farolMontado = false;
  function montarFarol() {
    if (farolMontado) return;
    farolMontado = true;
    Club.farol.mount($('farolAdmin'), {
      members: function () { return st.members; },
      session: function () { return sessao; },
      instagram: function () { return { resumo:st.igResumo || [], serie:st.igSerie || [], indisponivel:Club.instagramIndisponivel }; },
      entregas: contaMembro,
      artefatos: function (id) {
        return artefatosDe(id).map(function (a) {
          return { artifact:a, part:contaPar(id, a), steps:etapasDe(a.id).map(function (e) {
            return Object.assign({}, e, { feito:!!marcada(id, e.id) });
          }),
            demands:st.demands.filter(function (d) { return d.member_id === id && d.artifact_id === a.id; }) };
        });
      },
      demandas: function () { return st.demands; },
      abrirInstagram: abrirDetalheIg,
      abrirProgressao: function (id) { st.arvMembro = id; go('members'); renderMembers(); },
      abrirDemandas: function (id) {
        st.demMembro = id; st.demVisao = 'todas'; st.demFoco = '';
        st.demAbertas = 'open'; go('demands'); renderDemandas();
      }
    });
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

    /* Faixa por área dentro do mentorado: com uma dezena de artefatos por
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
      '<span class="grp-n">' + esc(g ? g.nome : 'Sem área') + '</span>' +
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
  /* A demanda que nasce da etapa já vem endereçada: título da etapa, frente,
     etapa, mentorado e dono. Trava é ato do mentorado — quem cobra é a CS. */
  function prefillDaEtapa(m, e, a) {
    var cs = st.staff.filter(function (p) { return p.apelido === 'KK' && p.ativo; }).map(function (p) { return p.id; });
    var g = grupoDe(a);
    var dono = (a.responsaveis && a.responsaveis.length) ? a.responsaveis : ((g && g.responsaveis) || []);
    return {
      titulo: e.titulo,
      member_id: m.id,
      artifact_id: a.id,
      step_id: e.id,
      responsaveis: Club.tipoEtapa(e) === 'trava' && cs.length ? cs : dono,
      origem: 'Progressão · ' + a.nome + ' · ' + Club.fmtDataCurta(hojeISO())
    };
  }

  /* Data de hoje no fuso do navegador, em YYYY-MM-DD. toISOString() daria a
     data em UTC, que em Manaus vira amanhã depois das 20h. */
  function hojeISO() {
    var hoje = new Date();
    return hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
      String(hoje.getDate()).padStart(2, '0');
  }

  function demandasAbertasDaEtapa(memberId, stepId) {
    return st.demands.filter(function (d) {
      return d.step_id === stepId && d.member_id === memberId && aberta(d);
    });
  }

  function abrirDemandaDaEtapa(memberId, stepId) {
    var m = st.members.filter(function (x) { return x.id === memberId; })[0];
    var e = st.steps.filter(function (x) { return x.id === stepId; })[0];
    var a = e && st.artifacts.filter(function (x) { return x.id === e.artifact_id; })[0];
    if (!m || !e || !a) return;
    modalDemanda(null, prefillDaEtapa(m, e, a));
  }

  function verDemandasDaEtapa(memberId, artifactId) {
    st.demVisao = 'todas'; st.demFoco = ''; st.demAbertas = 'open';
    st.demResp = ''; st.demMembro = memberId; st.demFrente = artifactId;
    go('demands');
    renderDemandas();
  }

  function linhaEtapa(m, e, par) {
    var p = marcada(m.id, e.id);
    var t = Club.tipoEtapa(e);
    var abertas = demandasAbertasDaEtapa(m.id, e.id);
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
      td((abertas.length
        ? '<button type="button" class="btn btn-sm btn-ghost" data-ver-demandas="' + esc(m.id) + '|' + esc(e.artifact_id) +
            '" title="Ver no quadro">' + ico('check-square') + abertas.length + ' demanda' + (abertas.length === 1 ? '' : 's') + '</button> '
        : '') +
        '<span class="tx-s">' + (p && p.feito_em ? esc('em ' + Club.fmtDataCurta(p.feito_em)) : (abertas.length ? '' : '—')) + '</span>') +
      '<div class="td end"><div class="row-acts">' +
        (!p && t !== 'aceite'
          ? '<button class="btn btn-sm btn-ghost" data-abrir-demanda="' + esc(m.id) + '|' + esc(e.id) +
              '" aria-label="Abrir demanda desta etapa" title="Abrir demanda">' + ico('plus') + '</button>'
          : '') +
      '</div></div>' +
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
      if (farolMontado) Club.farol.refresh();
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

  /* ── QR da credencial da Imersão ──────────────────────────────────────────
     O código impresso é fixo; esta lista é o que ele abre. Uma linha com
     "redirecionar" vigente manda o visitante direto para a URL; sem nenhuma,
     a página vira um menu com as linhas ativas e vigentes. As janelas são
     digitadas e mostradas no horário de São Paulo, onde o evento acontece —
     a equipe está em Manaus, e o relógio do navegador confundiria em 1 h.
     Ver supabase/qr-credencial.sql e /imersaograuzero/credencial/. */

  var QR_ICONES = [
    { value:'link',      label:'Link' },
    { value:'whatsapp',  label:'WhatsApp' },
    { value:'map-pin',   label:'Mapa / local' },
    { value:'coffee',    label:'Almoço / café' },
    { value:'image',     label:'Fotos' },
    { value:'calendar',  label:'Programação' },
    { value:'award',     label:'Mentoria / produto' },
    { value:'star',      label:'Destaque' },
    { value:'users',     label:'Grupo / comunidade' },
    { value:'file-text', label:'Material / PDF' },
    { value:'video',     label:'Vídeo' },
    { value:'gift',      label:'Brinde / bônus' },
    { value:'instagram', label:'Instagram' }
  ];

  /* São Paulo é -03:00 o ano inteiro: o Brasil não tem horário de verão desde
     2019, então o deslocamento fixo é exato. */
  var SP_OFFSET_MS = 3 * 60 * 60 * 1000;

  function spLocal(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return new Date(d.getTime() - SP_OFFSET_MS).toISOString().slice(0, 16);
  }

  function spIso(local) { return local ? local + ':00-03:00' : null; }

  function fmtSp(ts) {
    var l = spLocal(ts);
    return l ? l.slice(8, 10) + '/' + l.slice(5, 7) + ' ' + l.slice(11, 16) : '';
  }

  function qrVigente(r, agora) {
    return (!r.inicio || new Date(r.inicio) <= agora) &&
           (!r.fim    || new Date(r.fim)    >= agora);
  }

  function proximaOrdem() {
    return st.qrLinks.reduce(function (m, r) { return Math.max(m, Number(r.ordem) || 0); }, 0) + 10;
  }

  function renderQr() {
    if (Club.faltaQr) {
      $('statsQr').innerHTML = '';
      $('listaQr').innerHTML = '<div class="notice">' + ico('alert') +
        '<div>' + esc(Club.faltaQr) + '</div></div>';
      return;
    }

    var agora = new Date();
    var vivos = st.qrLinks.filter(function (r) { return r.ativo && qrVigente(r, agora); });
    var alvo = vivos.filter(function (r) { return r.redirecionar; })[0];
    var hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    /* Clique no menu é um segundo evento do mesmo scan; conta à parte. */
    var leituras = st.qrScans.filter(function (s) { return s.modo !== 'clique'; });
    var hojeN = leituras.filter(function (s) { return new Date(s.lido_em) >= hoje; }).length;
    var porLink = {};
    st.qrScans.forEach(function (s) {
      if (s.link_id) porLink[s.link_id] = (porLink[s.link_id] || 0) + 1;
    });

    $('statsQr').innerHTML =
      cardStat('O QR ABRE AGORA', alvo ? alvo.titulo : 'Menu',
        alvo ? 'redirecionando direto' :
          vivos.length + (vivos.length === 1 ? ' botão' : ' botões') + ' no menu') +
      cardStat('SCANS HOJE', hojeN, 'leituras do código') +
      cardStat('SCANS NO TOTAL', leituras.length, 'desde a primeira leitura');

    $('listaQr').innerHTML = tabela(
      'minmax(0,2.2fr) 130px 200px 130px 80px 88px',
      ['Destino', 'Modo', 'Janela (horário de SP)', 'Situação', 'Scans', '>Ações'],
      st.qrLinks.map(function (r) {
        var vivo = r.ativo && qrVigente(r, agora);
        var abrindo = alvo ? r.id === alvo.id : vivo;
        var situacao = !r.ativo ? status('var(--muted)', 'Inativo')
          : !qrVigente(r, agora) ? status('var(--warning)', 'Fora da janela')
          : abrindo ? status('var(--gold)', alvo ? 'Abrindo agora' : 'No menu agora')
          : status('var(--muted)', 'Encoberto pelo redirect');
        var janela = (r.inicio || r.fim)
          ? (r.inicio ? fmtSp(r.inicio) : 'desde já') + ' → ' + (r.fim ? fmtSp(r.fim) : 'sem fim')
          : 'sempre';
        return '<div class="tr' + (vivo ? '' : ' off') + '">' +
          '<div class="td"><div class="tx">' +
            '<div class="tx tx-t" title="' + esc(r.titulo) + '">' + esc(r.titulo) + '</div>' +
            '<div class="tx tx-s" title="' + esc(r.url) + '">' +
              esc(String(r.url).replace(/^https?:\/\//, '')) + '</div>' +
          '</div></div>' +
          td(r.redirecionar
            ? '<span style="color:var(--gold);font-weight:600">Redireciona</span>'
            : '<span class="tx-s">Botão do menu</span>') +
          td('<span class="tx-s">' + esc(janela) + '</span>') +
          td(situacao) +
          td(esc(String(porLink[r.id] || 0))) +
          '<div class="td end">' + acoes('qr', r.id) + '</div>' +
        '</div>';
      }).join(''),
      'Nenhum destino cadastrado — o QR está mostrando o menu de reserva da própria página.');
  }

  function modalQr(r) {
    var novo = !r;
    r = r || { titulo:'', descricao:'', url:'', icone:'link', ordem:proximaOrdem(),
               ativo:true, redirecionar:false, inicio:null, fim:null };
    Club.modal.open({
      title: novo ? 'Novo destino do QR' : 'Editar destino',
      sub: novo
        ? 'Entra como botão no menu da credencial — ou, marcando "redirecionar", vira o lugar para onde o QR manda.'
        : r.titulo,
      body:
        Club.field('Título', 'titulo', { value:r.titulo, required:true,
          placeholder:'Local do almoço' }) +
        Club.field('URL', 'url', { value:r.url, required:true, type:'url',
          placeholder:'https://maps.app.goo.gl/…',
          hint:'Maps, WhatsApp, álbum de fotos, página do produto — qualquer link.' }) +
        Club.field('Descrição', 'descricao', { value:r.descricao || '',
          placeholder:'Uma linha embaixo do título. Opcional.' }) +
        '<div class="fld-row">' +
          Club.select('Ícone', 'icone', QR_ICONES, r.icone || 'link') +
          Club.field('Ordem', 'ordem', { value:r.ordem, type:'number', min:0,
            hint:'Menor aparece primeiro. Entre redirects vigentes, vale o menor.' }) +
        '</div>' +
        '<div class="fld-row">' +
          Club.field('Vale a partir de', 'inicio', { value:spLocal(r.inicio),
            type:'datetime-local', hint:'Horário de São Paulo. Vazio = desde já.' }) +
          Club.field('Vale até', 'fim', { value:spLocal(r.fim),
            type:'datetime-local', hint:'Vazio = sem limite.' }) +
        '</div>' +
        Club.checkbox('Ativo', 'ativo', r.ativo) +
        Club.checkbox('Redirecionar — o QR abre esta URL direto, sem mostrar o menu',
          'redirecionar', r.redirecionar),
      onSubmit: function (d) {
        if (!d.titulo || !d.url) {
          Club.toast('Título e URL são obrigatórios.', 'alert'); return;
        }
        if (!/^https?:\/\/\S+$/i.test(d.url)) {
          Club.toast('A URL precisa começar com https://', 'alert'); return;
        }
        var ini = spIso(d.inicio), fim = spIso(d.fim);
        if (ini && fim && new Date(fim) <= new Date(ini)) {
          Club.toast('O fim precisa vir depois do início.', 'alert'); return;
        }
        Club.data.qrLinks.save({
          id: r.id, slug: 'credencial',
          titulo: d.titulo, descricao: d.descricao || null, url: d.url,
          icone: d.icone || 'link', ordem: Number(d.ordem) || 0,
          ativo: !!d.ativo, redirecionar: !!d.redirecionar,
          inicio: ini, fim: fim
        }).then(function () {
          Club.modal.close();
          recarregar(novo ? 'Destino criado.' : 'Destino atualizado.');
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

    var d = '', area = '', aberto = false, ultimoX = null;
    pontos.forEach(function (p, i) {
      var v = p[campo];
      if (v === null || v === undefined) {
        if (aberto) area += 'L' + ultimoX + ' ' + H + 'Z';
        aberto = false;
        return;
      }
      var px = i * passo, py = y(v);
      d += (aberto ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
      area += (aberto ? 'L' : 'M' + px.toFixed(1) + ' ' + H + 'L') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
      ultimoX = px.toFixed(1);
      aberto = true;
    });
    var ultimo = pontos.length - 1;
    if (aberto) area += 'L' + ultimoX + ' ' + H + 'Z';

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

  /* A API entrega no maximo 30 dias. Completar o calendario impede que uma
     falha de coleta comprima o eixo e pareca pertencer a outra data. */
  function serieSeguidores30(pontos, hoje) {
    var porDia = {};
    pontos.forEach(function (p) { porDia[p.dia] = p; });
    var fim = new Date((hoje || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
    var saida = [];
    for (var i = 29; i >= 0; i--) {
      var d = new Date(fim); d.setUTCDate(d.getUTCDate() - i);
      var dia = d.toISOString().slice(0, 10);
      saida.push(porDia[dia] || { dia:dia, seguidores_ganhos:null });
    }
    return saida;
  }

  /* Barras de ganho diário. Cada dia é uma coluna que ocupa a altura toda e
     ancora a barra na base — com `top` em elemento relative, como estava, a
     barra saía do cartão e caía por cima do bloco de baixo. Dia negativo
     (o Instagram devolve ganho, mas conta apagada pode zerar) cresce para
     baixo a partir do meio. Nulo fica marcado como pendente; nunca vira zero. */
  function barras(pontos, campo, altura) {
    var H = altura || 96;
    var vals = pontos.map(function (p) { return p[campo]; });
    var validos = vals.filter(function (v) { return v !== null && v !== undefined; });
    if (!validos.length) return '<div class="ig-vazio">Aguardando dados da Meta.</div>';
    var teto = Math.max.apply(null, validos.map(Math.abs)) || 1;
    var temNeg = validos.some(function (v) { return v < 0; });
    var util = temNeg ? H / 2 : H;
    return '<div class="ig-barras' + (temNeg ? ' tem-neg' : '') + '" style="height:' + H + 'px">' +
      pontos.map(function (p, i) {
        var v = vals[i];
        if (v === null || v === undefined) {
          return '<span class="ig-col pendente" data-dia="' +
            esc(Club.fmtDataCurta(p.dia)) +
            '" data-valor="aguardando dado da Meta"><i></i></span>';
        }
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
    var acc = totalHoje, saida = [], confiavel = true;
    for (var i = pontos.length - 1; i >= 0; i--) {
      saida.unshift({ dia: pontos[i].dia, seguidores: confiavel ? acc : null });
      var ganho = pontos[i].seguidores_ganhos;
      if (ganho === null || ganho === undefined) confiavel = false;
      else if (confiavel) acc -= ganho;
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
    var dias = st.igDetDias || 30;
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
    var corte = new Date(); corte.setHours(0, 0, 0, 0); corte.setDate(corte.getDate() - dias + 1);
    var serie = todos.filter(function (p) { return new Date(p.dia + 'T12:00') >= corte; });
    var serie30 = serieSeguidores30(todos);

    var alc = serie.map(function (p) { return p.alcance_dia; })
                   .filter(function (v) { return v !== null && v !== undefined; });
    var media = alc.length ? Math.round(alc.reduce(function (a, b) { return a + b; }, 0) / alc.length) : null;
    var melhor = serie.filter(function (p) { return p.alcance_dia !== null; })
                      .sort(function (a, b) { return b.alcance_dia - a.alcance_dia; })[0];
    var ganhosValidos = serie30.filter(function (p) {
      return p.seguidores_ganhos !== null && p.seguidores_ganhos !== undefined;
    });
    var ganhos30 = ganhosValidos.length
      ? ganhosValidos.reduce(function (a, p) { return a + p.seguidores_ganhos; }, 0)
      : null;
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
              [7, 30, 90, 180].map(function (d) {
                return '<button data-igdias="' + d + '" aria-selected="' + (d === dias) + '">' +
                  d + ' dias</button>';
              }).join('') +
            '</div>' +
          '</div>' +

          '<div class="statgrid ig-det-stats">' +
            cardStat('SEGUIDORES', numeroCurto(l.seguidores), 'agora',
                     'Total de seguidores no último retrato. É o número que o próprio ' +
                     'Instagram mostra no perfil.') +
            cardStat('GANHOS EM 30 DIAS', ganhos30 === null ? '—' :
                     (ganhos30 > 0 ? '+' : '') + numeroCurto(ganhos30),
                     ganhosValidos.length === 30 ? 'somando o que entrou por dia' :
                     ganhosValidos.length + ' de 30 dias consolidados',
                     'Soma de quem seguiu a conta nos últimos 30 dias. O Instagram conta ' +
                     'quem chegou, não quem saiu — então isto é entrada bruta, não saldo. ' +
                     'Dias ainda ausentes ficam pendentes e não entram como zero.') +
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
  /* Papel desta aba: o que o Club entrega, em que área, com que dono e com
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
    var interna = a.tipo === 'interna';
    return '<div class="tr' + (interna ? ' interna' : '') + '">' +
      '<div class="td"><span class="art-i" style="width:28px;height:28px;border-radius:8px;' +
        'font-size:14px;margin:0;flex-shrink:0">' + ico(a.icone || 'box') + '</span>' +
        '<div class="tx"><div class="tx tx-t" title="' + esc(a.nome) + '">' + esc(a.nome) + '</div>' +
        '<div class="tx tx-s">' + esc([a.subtitulo, a.member_id ? 'só ' + escopo(a.member_id) : null,
          siglas(a.responsaveis) ? 'dono ' + siglas(a.responsaveis) : null].filter(Boolean).join(' · ')) +
        '</div></div></div>' +
      '<div class="td"><div class="tx">' + (interna
        ? '<span class="tx-s">frente interna · só agrupa demandas</span>' : criterioDe(etapas)) + '</div></div>' +
      td('<span class="tx-s">' + esc(interna ? 'Interna' : tipoArtefato(etapas)) + '</span>') +
      '<div class="td"><div class="tx">' + (interna ? '<span class="tx-s">—</span>' : adocaoDe(a)) + '</div></div>' +
      td(status(s.color, a.status)) +
      '<div class="td end">' + acoes('artifact', a.id) + '</div>' +
    '</div>';
  }

  /* Cabeçalho de uma área na aba Artefatos. Área da equipe (interna) só
     agrupa demandas: o rótulo "equipe" e a classe .interna dizem isso. */
  function cabecalhoGrupo(g, n) {
    var interna = !!(g && g.interna);
    var qtd = n + (interna ? ' frente' : ' artefato') + (n === 1 ? '' : 's');
    var sub = g
      ? [interna ? 'equipe' : null, siglas(g.responsaveis), qtd].filter(Boolean).join(' · ')
      : qtd + ' sem área';
    return '<div class="tr grp pai' + (interna ? ' interna' : '') + '">' +
      '<span class="grp-n">' + esc(g ? g.nome : 'Sem área') +
        ' <span class="tx-s" style="font-weight:400">' + esc(sub) + '</span></span>' +
      (g ? '<span>' + acoes('group', g.id) + '</span>' : '<span></span>') +
    '</div>';
  }

  function renderArtifacts() {
    var grupos = st.groups.slice().concat([null]);
    $('filtroArtGrupo').innerHTML = '<option value="">Todas as áreas</option>' +
      st.groups.map(function (g) {
        return '<option value="' + esc(g.id) + '"' + (g.id === st.artGrupo ? ' selected' : '') + '>' +
          esc(g.nome) + '</option>';
      }).join('') + '<option value="sem"' + (st.artGrupo === 'sem' ? ' selected' : '') + '>Sem área</option>';

    var semCriterio = st.artifacts.filter(function (a) { return a.tipo !== 'interna' && !etapasDe(a.id).length; }).length;
    $('artResumo').textContent = st.artifacts.length + ' frentes · ' + st.groups.length + ' áreas' +
      (semCriterio ? ' · ' + semCriterio + ' sem critério' : '');
    $('avisoGrupos').innerHTML = Club.faltaGrupos
      ? '<div class="notice">' + ico('alert') + '<div>' + esc(Club.faltaGrupos) + '</div></div>' : '';

    var secoes = grupos.map(function (g) {
      var gid = g ? g.id : 'sem';
      if (st.artGrupo && st.artGrupo !== gid) return '';
      var arts = st.artifacts.filter(function (a) {
        return (g ? a.group_id === g.id : !a.group_id);
      }).sort(porGrupoOrdem);
      /* "Sem área" some quando está vazia: seria uma seção sem assunto. */
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
    g = g || { nome:'', ordem: st.groups.length + 1, responsaveis:[], interna:false };
    Club.modal.open({
      title: g.id ? 'Editar área' : 'Nova área',
      sub: g.id ? g.nome : 'Uma área da jornada do mentorado, ou uma área da equipe que só agrupa demandas.',
      body:
        Club.field('Nome', 'nome', { value:g.nome, required:true, placeholder:'Geração de demanda' }) +
        Club.field('Ordem', 'ordem', { value:g.ordem, type:'number' }) +
        Club.checkbox('Área da equipe (interna): não aparece para o mentorado nem na Progressão',
          'interna', !!g.interna) +
        (opcoesEquipe().length
          ? Club.select('Responsáveis', 'responsaveis', opcoesEquipe(), (g.responsaveis || [])[0],
              { multiple:true, hint:'Quem responde pela área. Segure Ctrl (ou Cmd) para mais de um.' })
          : ''),
      onSubmit: function (d) {
        if (!d.nome) { Club.toast('A área precisa de um nome.', 'alert'); return; }
        d.id = g.id;
        d.responsaveis = d.responsaveis || [];
        d.interna = !!d.interna;
        Club.data.groups.save(d).then(function () {
          Club.modal.close();
          recarregar(g.id ? 'Área atualizada.' : 'Área criada.');
        }).catch(aviso);
      }
    });
    marcarMultiplos('responsaveis', g.responsaveis);
  }

  function modalArtefato(a) {
    a = a || { nome:'', subtitulo:'', icone:'box', status:'Em produção', meta:'',
               url:'', member_id:null, group_id: st.artGrupo && st.artGrupo !== 'sem' ? st.artGrupo : null,
               ordem:0, responsaveis:[], tipo:'artefato' };
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
              Club.select('Área', 'group_id', [{ value:'', label:'Sem área' }].concat(
                st.groups.map(function (g) { return { value:g.id, label:g.nome + (g.interna ? ' (equipe)' : '') }; })), a.group_id || '') +
              Club.field('Ordem na área', 'ordem', { value:a.ordem || 0, type:'number' }) +
            '</div>' +
            (opcoesEquipe().length
              ? Club.select('Dono', 'responsaveis', opcoesEquipe(), (a.responsaveis || [])[0],
                  { multiple:true, hint:'Quem move esta frente. Sem dono, vale o da área.' })
              : '')
          : '') +
        '<div class="fld-row">' +
          Club.select('Situação', 'status', Club.ART_STATUS, a.status) +
          Club.select('Ícone', 'icone', Club.ART_ICONES, a.icone) +
        '</div>' +
        Club.select('Tipo', 'tipo', [
            { value:'artefato', label:'Artefato do mentorado (checklist e progresso)' },
            { value:'interna',  label:'Frente interna (só agrupa demandas)' }
          ], a.tipo || 'artefato',
          { hint:'Frente interna nunca aparece para o mentorado nem na Progressão. Use só em área da equipe.' }) +
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
        d.tipo = d.tipo === 'interna' ? 'interna' : 'artefato';
        /* Frente interna é da equipe: não é de mentorado nenhum e não tem checklist. */
        d.member_id = d.tipo === 'interna' ? null : (d.member_id || null);
        if (comGrupos) { d.group_id = d.group_id || null; d.responsaveis = d.responsaveis || []; }

        var titulos = d.tipo === 'interna' ? [] : String(d.etapas || '').split('\n')
          .map(function (l) { return l.trim(); })
          .filter(Boolean);

        /* Guarda de posição. O sync casa etapa velha com linha nova pelo índice,
           então inserir ou mover uma linha no meio passa as marcações de todo
           mundo para a etapa errada, em silêncio. Renomear no lugar é seguro;
           linha nova entra no fim. Apagar linha com marca também para aqui:
           o cascade levaria o progresso junto sem aviso. */
        var trava = d.tipo === 'interna' ? null : guardaPosicao(etapasAtuais, titulos);
        if (trava) { Club.toast(trava, 'alert'); return; }
        if (d.tipo === 'interna' && etapasAtuais.length) {
          Club.toast('Frente interna não tem checklist. Apague as etapas antes de trocar o tipo.', 'alert');
          return;
        }

        Club.data.artifacts.save(d).then(function (salvo) {
          /* O artefato novo só ganha id ao ser gravado, e a etapa precisa dele
             para saber de quem é — daí o checklist ir na sequência, não junto.
             Frente interna não tem checklist: nada a sincronizar. */
          if (d.tipo === 'interna') return null;
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

  /* ── frente: o eixo de leitura do quadro ──────────────────────────────
     A demanda aponta para a frente (demands.artifact_id): um artefato do
     mentorado ou uma frente interna da equipe, sempre dentro de uma área da
     jornada. Demanda de mentorado sem frente ainda se agrupa por ele; sem
     mentorado e sem frente vai para "Sem frente", que é onde a triagem
     acontece. projeto_legado é o texto antigo, só para leitura. */

  function frenteDe(d) {
    if (!d || !d.artifact_id) return null;
    return st.artifacts.filter(function (a) { return a.id === d.artifact_id; })[0] || null;
  }

  function rotuloFrente(a) {
    var g = grupoDe(a);
    return (g ? g.nome + ' · ' : '') + a.nome + (a.member_id ? ' (' + (membro(a.member_id) || 'mentorado') + ')' : '');
  }

  function contextoDe(d) {
    var a = frenteDe(d);
    if (a) return { key:'f:' + a.id, nome:a.nome, tipo:'frente', area:grupoDe(a) };
    if (d.member_id) return { key:'m:' + d.member_id, nome:membro(d.member_id) || 'Mentorado removido', tipo:'mentorado', area:null };
    return { key:'z:', nome:'Sem frente', tipo:'vazio', area:null };
  }

  /* Áreas na ordem cadastrada (as da equipe vêm depois por ordem, e por
     garantia por `interna`), frentes na ordem da área. */
  function areasOrdenadas() {
    return st.groups.slice().sort(function (a, b) {
      return ((a.interna ? 1 : 0) - (b.interna ? 1 : 0)) || ((a.ordem || 0) - (b.ordem || 0)) ||
        String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });
  }

  function frentesOrdenadas() {
    var ordemArea = {};
    areasOrdenadas().forEach(function (g, i) { ordemArea[g.id] = i; });
    return st.artifacts.slice().sort(function (a, b) {
      var ga = ordemArea[a.group_id], gb = ordemArea[b.group_id];
      if (ga === undefined) ga = 999; if (gb === undefined) gb = 999;
      return (ga - gb) || ((a.ordem || 0) - (b.ordem || 0)) ||
        String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });
  }

  /* Opções do filtro: a área inteira ("a:<id>") e, indentadas, as frentes dela. */
  function opcoesFrente() {
    var lista = [];
    areasOrdenadas().forEach(function (g) {
      var frentes = frentesOrdenadas().filter(function (a) { return a.group_id === g.id; });
      if (!frentes.length) return;
      lista.push({ value:'a:' + g.id, label:g.nome + ' (tudo)' });
      frentes.forEach(function (a) {
        lista.push({ value:a.id, label:'    ' + a.nome + (a.member_id ? ' (' + (membro(a.member_id) || 'mentorado') + ')' : '') });
      });
    });
    return lista;
  }

  /* O filtro casa a frente exata ou a área inteira. */
  function casaFrente(d, alvo) {
    var a = frenteDe(d);
    if (!a) return false;
    alvo = String(alvo || '');
    if (alvo.indexOf('a:') === 0) return a.group_id === alvo.slice(2);
    return a.id === alvo;
  }

  function estaFechada(d) { return Club.DEM_ABERTOS.indexOf(d.status) === -1; }

  /* Para os recortes, a fechada há pouco ainda conta como aberta: é o que a
     mantém na lista depois do ✓. */
  function aberta(d) { return !estaFechada(d) || !!st.recemFechadas[d.id]; }

  /* Os recortes que os cartões do painel abrem. Cada um responde se a demanda
     entra, como se chama na faixa e o que dizer quando não sobra nada. Todos
     partem das abertas: prazo passado de coisa concluída não é atraso. */
  var FOCOS = {
    atrasadas: { nome:'Atrasadas', vazio:'Nenhuma demanda atrasada. Aproveite.',
      testa:function (d) { var n = Club.diffDays(d.vence_em); return aberta(d) && n !== null && n < 0; } },
    hoje:      { nome:'Vencem hoje', vazio:'Nada vence hoje.',
      testa:function (d) { return aberta(d) && Club.diffDays(d.vence_em) === 0; } },
    semana:    { nome:'Vencem esta semana', vazio:'Nada vence nos próximos 6 dias.',
      testa:function (d) { var n = Club.diffDays(d.vence_em); return aberta(d) && n !== null && n > 0 && n <= 6; } },
    semprazo:  { nome:'Sem prazo', vazio:'Todas as abertas têm prazo.',
      testa:function (d) { return aberta(d) && !d.vence_em; } },
    atencao:   { nome:'Pedindo atenção', vazio:'Nada em risco nem aguardando retorno.',
      testa:function (d) { return d.status === 'Em risco' || d.status === 'Aguardando retorno'; } },
    semdono:   { nome:'Sem responsável', vazio:'Todas as abertas têm dono.',
      testa:function (d) { return aberta(d) && (!d.responsaveis || !d.responsaveis.length); } },
    semfrente: { nome:'Sem frente', vazio:'Todas as abertas têm frente.',
      testa:function (d) { return aberta(d) && !d.artifact_id; } }
  };

  /* O cartão "Em aberto" não é recorte: é a lista inteira das abertas, o ponto
     de partida. Clicar nele limpa recorte e filtros e volta a essa leitura. */
  function aplicarFoco(foco) {
    if (foco === 'abertas' || st.demFoco === foco) st.demFoco = '';
    else if (FOCOS[foco]) st.demFoco = foco;
    st.demAbertas = 'open';
    st.demResp = ''; st.demMembro = ''; st.demFrente = '';
    sincronizarHash();
    renderDemandas();
  }

  /* O recorte e a demanda aberta moram na URL: #demandas?foco=atrasadas abre
     direto na lista, #demandas/<id> abre a demanda, e o endereço se copia para
     quem precisa ver o mesmo. */
  function lerHash() {
    var h = (location.hash || '').replace(/^#/, '');
    var i = h.indexOf('?');
    var caminho = i === -1 ? h : h.slice(0, i);
    var partes = caminho.split('/');
    var foco = '';
    if (i !== -1) {
      var m = /(?:^|&)foco=([^&]*)/.exec(h.slice(i + 1));
      foco = m ? decodeURIComponent(m[1]) : '';
    }
    var id = '';
    try { id = decodeURIComponent(partes[1] || ''); } catch (err) { id = ''; }
    return { secao:partes[0], id:id, foco:FOCOS[foco] ? foco : '' };
  }

  function sincronizarHash() {
    if (st.view !== 'demands') return;
    var id = idEmDestaque();
    var novo = '#demandas' + (id ? '/' + encodeURIComponent(id) : '') +
      (st.demFoco ? '?foco=' + encodeURIComponent(st.demFoco) : '');
    if (location.hash !== novo) history.replaceState(null, '', novo);
  }

  /* A faixa acima da lista diz qual recorte está valendo e devolve a leitura
     inteira num clique. */
  function faixaFoco(rows) {
    var f = FOCOS[st.demFoco];
    if (!f) return '';
    return '<div class="foco-bar" role="status">' + ico('search') +
      '<span>Mostrando <b>' + esc(f.nome.toLowerCase()) + '</b> · ' + rows.length +
      (rows.length === 1 ? ' demanda' : ' demandas') + '</span><span class="sp"></span>' +
      '<button type="button" class="btn btn-sm" data-foco-limpar>Ver todas as abertas</button></div>';
  }

  /* Fechou agora: fica na lista e no lugar. Reabriu: volta a ser uma aberta comum. */
  function marcarFechamento(d) {
    if (estaFechada(d)) st.recemFechadas[d.id] = true;
    else delete st.recemFechadas[d.id];
  }

  /* A ordem do banco manda (situação → prioridade → prazo), mas a demanda
     fechada há pouco não pula para o fim: fica no índice em que estava, para
     a pessoa ver a própria conclusão sem ter que procurar. */
  function ordenarDemandas(rows) {
    var fixas = {}, soltas = [];
    rows.forEach(function (d, i) {
      if (st.recemFechadas[d.id]) fixas[i] = d; else soltas.push(d);
    });
    soltas = Club.data.demands.ordenar(soltas);
    var out = [], j = 0;
    for (var i = 0; i < rows.length; i++) out.push(fixas[i] || soltas[j++]);
    return out;
  }

  function demandasVisiveis() {
    return st.demands.filter(function (d) {
      if (st.demVisao === 'minhas' && !minha(d)) return false;
      if (st.demAbertas === 'open' && estaFechada(d) && !st.recemFechadas[d.id]) return false;
      if (st.demFoco && FOCOS[st.demFoco] && !FOCOS[st.demFoco].testa(d)) return false;
      if (st.demResp && (!d.responsaveis || d.responsaveis.indexOf(st.demResp) === -1)) return false;
      if (st.demMembro && d.member_id !== st.demMembro) return false;
      if (st.demFrente && !casaFrente(d, st.demFrente)) return false;
      return true;
    });
  }

  function renderDemandas() {
    /* Com o calendário de um prazo aberto (na linha, na janela ou no painel),
       redesenhar agora apagaria o campo no meio da escolha. Quem fecha o
       calendário redesenha — salvando ou não. */
    var foco = document.activeElement;
    if (foco && foco.classList && foco.classList.contains('cell-date')) return;
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

    /* Trocar visão ou filtro é virar a página: as fechadas há pouco saem daqui
       e passam a valer só em "Todas", como qualquer concluída. */
    var assinatura = [st.demVisao, st.demAbertas, st.demResp, st.demMembro, st.demFrente].join('|');
    if (assinatura !== assinaturaFiltros) st.recemFechadas = {};
    assinaturaFiltros = assinatura;

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

    var opFrente = opcoesFrente();
    if (st.demFrente && !opFrente.some(function (o) { return o.value === st.demFrente; })) st.demFrente = '';
    $('filtroFrenteDem').innerHTML = '<option value="">Qualquer frente</option>' +
      opFrente.map(function (o) {
        return '<option value="' + esc(o.value) + '"' + (o.value === st.demFrente ? ' selected' : '') +
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
    var semFrente = abertas.filter(function (d) { return !d.artifact_id; });

    if (st.demVisao === 'minhas') {
      /* Na leitura pessoal os cartões são a agenda: o que venceu, o que vence
         hoje, o que vence até domingo e o que ainda não tem dia. */
      var hoje = abertas.filter(function (d) { return Club.diffDays(d.vence_em) === 0; });
      var semana = abertas.filter(function (d) {
        var n = Club.diffDays(d.vence_em); return n !== null && n > 0 && n <= 6;
      });
      var semPrazo = abertas.filter(function (d) { return !d.vence_em; });
      $('statsDemandas').innerHTML =
        cardStat('ATRASADAS', atrasadas.length, atrasadas.length ? 'passaram do prazo' : 'nada atrasado', null, 'atrasadas') +
        cardStat('HOJE', hoje.length, hoje.length ? 'vencem hoje' : 'nada vence hoje', null, 'hoje') +
        cardStat('ESTA SEMANA', semana.length, 'vencem nos próximos 6 dias', null, 'semana') +
        cardStat('SEM PRAZO', semPrazo.length, abertas.length + ' em aberto no total', null, 'semprazo');
    } else {
      $('statsDemandas').innerHTML =
        cardStat('EM ABERTO', abertas.length, st.demands.length + ' no total', null, 'abertas') +
        cardStat('ATRASADAS', atrasadas.length, atrasadas.length ? 'passaram do prazo' : 'tudo dentro do prazo', null, 'atrasadas') +
        cardStat('PEDINDO ATENÇÃO', risco.length, 'em risco ou aguardando retorno', null, 'atencao') +
        cardStat('SEM RESPONSÁVEL', semDono.length, semDono.length ? 'ninguém tocando' : 'todas com dono', null, 'semdono') +
        cardStat('SEM FRENTE', semFrente.length, semFrente.length ? 'esperando triagem' : 'todas com frente', null, 'semfrente');
    }

    var rows = demandasVisiveis();
    var faixa = faixaFoco(rows);

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
      $('listaDemandas').innerHTML = avisoCk + faixa + Club.empty('check-circle',
        st.demVisao === 'minhas' && !st.eu ? 'Clique em "Minhas" e diga quem você é no quadro.'
        : st.demFoco && (st.demResp || st.demMembro || st.demFrente) ? 'Nenhuma demanda com este filtro.'
        : st.demFoco ? FOCOS[st.demFoco].vazio
        : st.demResp || st.demMembro || st.demFrente ? 'Nenhuma demanda com este filtro.'
        : st.demVisao === 'minhas' ? 'Nada em aberto no seu nome. Aproveite.'
        : 'Nenhuma demanda em aberto. Aproveite.');
      atualizarDetalhes();
      return;
    }

    /* Duas leituras da mesma tabela. "Por demanda": uma linha embaixo da outra,
       na ordem do banco (situação → prioridade → prazo, ver byDemanda), com a
       coluna Frente pra filtrar. "Por frente": as linhas se juntam sob a
       frente, dentro da área (mentorado sem frente fica no topo, pelo nome),
       o grupo que tem atraso vem primeiro e, dentro dele, quem vence antes. A
       coluna Frente só aparece na lista: no agrupado ela é o cabeçalho. */
    var comFrente = st.demAgrupar === 'lista';
    var larguras = [230, 132, 96, 140, 124].concat(comFrente ? [180] : [])
      .concat([116, 116, 104]);
    var cols = 'minmax(230px,2fr) ' + larguras.slice(1).map(function (n) { return n + 'px'; }).join(' ');
    var cabecalhos = ['Demanda', 'Situação', 'Prioridade', 'Responsáveis', 'Mentorado']
      .concat(comFrente ? ['Frente'] : [])
      .concat(['Checklist', 'Prazo', '>Ações']);

    var corpo = st.demAgrupar === 'frente'
      ? gruposPorFrente(rows).map(function (g) { return linhaGrupo(g, 0); }).join('')
      : rows.map(function (d) { return linhaDemanda(d, comFrente); }).join('');

    $('listaDemandas').innerHTML = avisoCk + faixa + tabela(cols, cabecalhos, corpo, '');
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
    atualizarDetalhes();
    Club.reancorarMenu();
  }

  /* Filtros do último desenho; ver renderDemandas. */
  var assinaturaFiltros = null;

  /* Prazo mais próximo primeiro; sem prazo por último; empate = prioridade.
     A fechada há pouco ainda se ordena como aberta: é assim que ela fica onde
     estava dentro do grupo. */
  var PESO_PRIO = { 'Alta':0, 'Média':1, 'Baixa':2 };
  function porPrazo(a, b) {
    var fa = estaFechada(a) && !st.recemFechadas[a.id];
    var fb = estaFechada(b) && !st.recemFechadas[b.id];
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
    if (a.tipo === 'pai' && b.tipo === 'pai' && !!a.interna !== !!b.interna) return a.interna ? 1 : -1;
    return a.nome.localeCompare(b.nome);
  }

  /* Área → frente. A demanda de mentorado sem frente fica no topo, pelo
     mentorado, como antes; sem nada vai para "Sem frente", no fim. A área é
     uma linha-pai que abre e fecha as frentes dela e soma os números. */
  function gruposPorFrente(rows) {
    var mapa = {};
    rows.forEach(function (d) {
      var c = contextoDe(d);
      var g = mapa[c.key] = mapa[c.key] || { key:c.key, nome:c.nome, tipo:c.tipo, area:c.area, itens:[], filhos:[] };
      g.itens.push(d);
    });
    var grupos = Object.keys(mapa).map(function (k) { return mapa[k]; });
    grupos.forEach(function (g) { g.itens.sort(porMentoradoPrazo); contarGrupo(g, g.itens); });

    var pais = {}, topo = [];
    grupos.forEach(function (g) {
      if (g.tipo !== 'frente' || !g.area) { topo.push(g); return; }
      var pk = 'pai:' + g.area.id;
      var pai = pais[pk] = pais[pk] || { key:pk, nome:g.area.nome, tipo:'pai', ordem:g.area.ordem, interna:!!g.area.interna, itens:[], filhos:[] };
      pai.filhos.push(g);
    });
    var ordemFrente = {};
    frentesOrdenadas().forEach(function (a, i) { ordemFrente['f:' + a.id] = i; });
    Object.keys(pais).forEach(function (k) {
      var pai = pais[k];
      pai.filhos.sort(function (a, b) { return (ordemFrente[a.key] || 0) - (ordemFrente[b.key] || 0); });
      contarGrupo(pai, pai.filhos.reduce(function (acc, f) { return acc.concat(f.itens); }, []));
      topo.push(pai);
    });
    topo.sort(ordemGrupo);
    return topo;
  }

  /* Dentro da frente: quem tem mentorado primeiro, por nome; depois prazo. */
  function porMentoradoPrazo(a, b) {
    var ma = a.member_id ? (membro(a.member_id) || '') : '', mb = b.member_id ? (membro(b.member_id) || '') : '';
    if (ma !== mb) return ma.localeCompare(mb, 'pt-BR');
    return porPrazo(a, b);
  }

  function linhaGrupo(g, nivel) {
    nivel = nivel || 0;
    var chave = 'g:' + g.key;
    var fechado = !!st.grpFechado[chave];
    var meta = '<b>' + g.abertas + '</b> em aberto' +
      (g.atrasadas ? ' · <span class="late"><b>' + g.atrasadas + '</b> atrasada' + (g.atrasadas > 1 ? 's' : '') + '</span>' : '') +
      (g.hoje ? ' · <span class="today"><b>' + g.hoje + '</b> hoje</span>' : '');
    var rotulo = g.tipo === 'mentorado' ? 'mentorado sem frente'
      : g.tipo === 'pai' ? (g.interna ? 'área da equipe · ' : 'área · ') + g.filhos.length + (g.filhos.length === 1 ? ' frente' : ' frentes')
      : g.tipo === 'frente' ? 'frente' : '';
    var cab = '<div class="tr grp' + (nivel ? ' sub' : '') + (g.tipo === 'pai' ? ' pai' : '') +
      '" data-grupo="' + esc(chave) + '">' +
      '<div class="grp-t"><button class="tg" aria-expanded="' + (!fechado) +
        '" aria-label="Abrir ou fechar grupo">' + ico('chevron-right') + '</button>' +
        '<span class="grp-n">' + esc(g.nome) + '</span>' +
        '<span class="grp-k">' + rotulo + '</span>' +
      '</div><div class="grp-m">' + meta + '</div></div>';
    if (fechado) return cab;
    return cab +
      g.filhos.map(function (f) { return linhaGrupo(f, nivel + 1); }).join('') +
      g.itens.map(function (d) { return linhaDemanda(d, false); }).join('');
  }

  function linhaDemanda(d, comFrente) {
    var cor = Club.DEM_COR[d.status];
    var fechada = Club.DEM_ABERTOS.indexOf(d.status) === -1;

    var chave = 'd:' + d.id;
    var etapas = etapasDaDemanda(d.id);
    var feitas = etapas.filter(function (e) { return e.feito; }).length;
    /* De onde veio e o que é: as duas linhas curtas cabem juntas embaixo do
       título e liberam a coluna para o checklist. */
    var sub = [d.origem, d.descricao].filter(Boolean).join(' · ');
    var titulo = d.titulo;

    var linha = '<div class="tr' + (fechada ? ' off' : '') + '"' +
      ' style="box-shadow:inset 3px 0 0 ' + cor + '">' +
      '<div class="td nm">' + toggleOuAdd(chave, etapas.length, d.id) +
        '<button type="button" class="demand-open" data-detalhe-demanda="' + esc(d.id) +
          '" aria-label="Ver demanda: ' + esc(titulo) + '">' +
          '<span class="tx tx-t">' + esc(titulo) + '</span>' +
          (sub ? '<span class="tx tx-s">' + esc(sub) + '</span>' : '') +
        '</button></div>' +
      colunasDe(d, 'd') +
      (comFrente ? celulaFrente(d) : '') +
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
      return linhaSubtarefa(e, comFrente);
    }).join('') : '';
    return linha + filhos + linhaNovaSub(d.id);
  }

  /* A frente é menu: lista todas, por área, e deixa tirar. Trocar a frente
     zera a etapa, que era da frente antiga. */
  function celulaFrente(d) {
    var a = frenteDe(d);
    return tdCel(celula('d.frente', d.id, '<span class="tx">' + esc(a ? rotuloFrente(a) : 'sem frente') + '</span>', !a));
  }

  /* Artefato exclusivo de um mentorado (member_id) só aparece para demanda
     desse mentorado; demanda interna ou de outro não o vê. */
  function itensMenuFrente(atual, memberId) {
    var itens = [{ value:'', label:'Sem frente', checked:!atual }];
    areasOrdenadas().forEach(function (g) {
      frentesOrdenadas().filter(function (a) {
        return a.group_id === g.id && (!a.member_id || a.member_id === memberId);
      }).forEach(function (a) {
        itens.push({ value:a.id, label:rotuloFrente(a), checked:a.id === atual });
      });
    });
    return itens;
  }

  function itensMenuEtapa(artifactId, atual) {
    var etapas = Club.ordenaEtapas(etapasDe(artifactId));
    return [{ value:'', label:'Sem etapa', checked:!atual }].concat(etapas.map(function (e) {
      return { value:e.id, label:e.titulo + ' · ' + Club.STEP_TIPO_ROTULO[Club.tipoEtapa(e)], checked:e.id === atual };
    }));
  }

  /* Célula que abre menu no clique. Fica invisível como controle até o mouse
     chegar: a tabela precisa continuar legível como tabela. A chave carrega o
     escopo — 'd' para a demanda, 's' para a subtarefa. */
  function celula(tipo, id, conteudo, vazia, chave) {
    return '<button class="cell' + (vazia ? ' vazio' : '') + '" data-cell="' + tipo +
      '" data-id="' + id + '" data-menu-id="' + (chave || tipo + ':' + id) +
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
  function linhaSubtarefa(e, comFrente) {
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
      (comFrente ? td('') : '') +
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
        if (!sub && v === 'Concluída') mudarStatus(r.id, v); else salvar(r.id, { status:v });
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

    if (par[1] === 'frente') {
      Club.menu(el, itensMenuFrente(r.artifact_id, r.member_id), { titulo:'Frente', onPick:function (v) {
        salvar(r.id, { artifact_id: v || null, step_id: null });
      } });
      return;
    }

    if (par[1] === 'etapa') {
      if (!r.artifact_id) { Club.toast('Escolha a frente antes da etapa.', 'alert'); return; }
      Club.menu(el, itensMenuEtapa(r.artifact_id, r.step_id), { titulo:'Etapa do checklist', onPick:function (v) {
        salvar(r.id, { step_id: v || null });
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
      /* Solta o foco antes de redesenhar: renderDemandas não mexe na tela
         enquanto um calendário estiver em foco (ver lá), e este está fechando. */
      inp.blur();
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
    if (patch.status !== undefined) marcarFechamento(d);
    st.demands = ordenarDemandas(st.demands);
    renderDemandas();
    /* O contador de demandas da etapa, na Progressão, lê o mesmo quadro. */
    if ('step_id' in patch || 'member_id' in patch || 'status' in patch) renderMembers();

    Club.data.demands.save(Object.assign({ id:id }, patch)).then(function (linha) {
      /* Concluir e reabrir em seguida manda duas gravações; a resposta da
         primeira não pode desfazer a segunda na tela. Se a linha já mudou de
         novo, quem mudou traz a versão certa. */
      var atual = achar('demand', id);
      var superada = !atual || Object.keys(patch).some(function (k) {
        return String(atual[k]) !== String(patch[k]);
      });
      if (superada) return;
      /* Só o que esta gravação mandou volta do banco para a tela — mais o
         carimbo de conclusão, que o gatilho deriva do status. Copiar a linha
         inteira desfaria uma troca mais nova feita em outro campo enquanto
         esta resposta viajava. */
      Object.keys(patch).forEach(function (k) { if (k in linha) atual[k] = linha[k]; });
      if ('concluida_em' in linha) atual.concluida_em = linha.concluida_em;
      st.demands = ordenarDemandas(st.demands);
      renderDemandas();
    }).catch(function (err) {
      Object.assign(d, antes);
      if (patch.status !== undefined) marcarFechamento(d);
      st.demands = ordenarDemandas(st.demands);
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
      /* Mesma regra da demanda: a resposta só traz os campos que mandou, mais
         o feito e o carimbo, que o gatilho deriva do status. */
      var atual = etapa(id);
      var superada = !atual || Object.keys(patch).some(function (k) {
        return String(atual[k]) !== String(patch[k]);
      });
      if (superada) return;
      Object.keys(patch).forEach(function (k) { if (k in linha) atual[k] = linha[k]; });
      ['feito', 'feito_em'].forEach(function (k) { if (k in linha) atual[k] = linha[k]; });
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

  /* ── detalhe da demanda ────────────────────────────────────────────────
     Leitura completa sem entrar no formulário, em dois modos: a janela
     (modal, como sempre foi) e o painel destacado — uma caixa flutuante que
     fica de pé enquanto a pessoa mexe na lista. O corpo é o mesmo nos dois, e
     as células de situação, prioridade, dono, mentorado e prazo são as mesmas
     da linha: trocar aqui grava igual e redesenha os dois lugares. */

  function corpoDetalhe(d, r, subId) {
    var escopo = subId ? 's' : 'd';
    var ctxo = contextoDe(d), frente = frenteDe(d);
    var etapaLigada = d.step_id
      ? etapasDe(d.artifact_id).filter(function (e) { return e.id === d.step_id; })[0] : null;
    var titulo = r.titulo;
    var etapas = subId ? [] : etapasDaDemanda(d.id);
    var feitas = etapas.filter(function (e) { return e.feito; }).length;
    var chave = function (tipo) { return escopo + '.' + tipo + ':' + r.id + ':det'; };
    function campo(nome, valor) {
      return '<div><dt>' + esc(nome) + '</dt><dd>' + valor + '</dd></div>';
    }
    var n = Club.diffDays(r.vence_em);
    var atrasada = n !== null && n < 0 && !estaFechada(r);

    return '<article class="demand-detail">' +
      '<p class="demand-context">' + esc(frente ? rotuloFrente(frente) + (etapaLigada ? ' · ' + etapaLigada.titulo : '')
        : ctxo.tipo === 'mentorado' ? ctxo.nome : 'Sem frente') + '</p>' +
      '<h3 class="demand-title">' + esc(titulo) + '</h3>' +
      (subId ? '<button type="button" class="demand-parent" data-detalhe-demanda="' + esc(d.id) +
        '">' + ico('chevron-right') + '<span>Demanda principal: ' +
        esc(d.titulo) + '</span></button>' : '') +
      '<dl class="demand-meta">' +
        campo('Situação', celula(escopo + '.status', r.id,
          status(Club.DEM_COR[r.status] || 'var(--faint)', r.status || 'Não informada'), false, chave('status'))) +
        campo('Prioridade', celula(escopo + '.prio', r.id,
          status(Club.DEM_PRIO_COR[r.prioridade] || 'var(--faint)', r.prioridade || 'Não informada'), false, chave('prio'))) +
        campo('Responsáveis', celula(escopo + '.resp', r.id, '<span class="tx">' + esc(responsaveisDe(r)) + '</span>',
          !r.responsaveis || !r.responsaveis.length, chave('resp'))) +
        campo('Prazo', '<button type="button" class="cell' + (r.vence_em ? '' : ' vazio') + '" data-prazo="' +
          escopo + ':' + esc(r.id) + '"><span class="tx"' + (atrasada ? ' style="color:var(--danger)"' : '') + '>' +
          esc(r.vence_em ? Club.fmtDataCurta(r.vence_em) + ' · ' + Club.fmtDue(r.vence_em) : 'Sem prazo') +
          '</span></button>') +
        campo('Mentorado', celula(escopo + '.membro', r.id, '<span class="tx">' +
          esc(r.member_id ? membro(r.member_id) || 'Mentorado removido' : 'Demanda interna') + '</span>',
          !r.member_id, chave('membro'))) +
        (!subId ? campo('Frente', celula('d.frente', r.id, '<span class="tx">' +
          esc(frente ? rotuloFrente(frente) : 'Sem frente') + '</span>', !frente, chave('frente'))) : '') +
        (!subId && frente ? campo('Etapa', celula('d.etapa', r.id, '<span class="tx">' +
          esc(etapaLigada ? etapaLigada.titulo : 'Sem etapa') + '</span>', !etapaLigada, chave('etapa'))) : '') +
        (!subId && d.projeto_legado ? campo('Projeto (legado)', '<span class="tx tx-s" style="color:var(--faint)">' +
          esc(d.projeto_legado) + '</span>') : '') +
        (!subId ? campo('Origem', esc(r.origem || 'Não informada')) : '') +
      '</dl>' +
      (!subId ? '<section class="demand-section"><h4>Descrição</h4><p class="demand-description">' +
        esc(d.descricao || 'Nenhuma descrição adicionada.') + '</p></section>' : '') +
      (!subId ? '<section class="demand-section"><h4>Checklist <span>' + feitas + '/' + etapas.length +
        '</span></h4>' + (etapas.length ? '<ul class="demand-checklist">' + etapas.map(function (e) {
          return '<li' + (e.feito ? ' class="feito"' : '') + '>' +
            '<button type="button" class="cbx" data-sub="' + esc(e.id) + '" aria-pressed="' + (!!e.feito) +
              '" aria-label="Marcar subtarefa" title="' + (e.feito && e.feito_em
                ? esc('Feito em ' + Club.fmtDataCurta(e.feito_em)) : 'Marcar como concluída') + '">' +
              ico('check') + '</button>' +
            '<button type="button" class="demand-step" data-detalhe-sub="' + esc(e.id) + '">' +
              '<span class="demand-step-body">' +
                '<span class="demand-step-title">' + esc(e.titulo) + '</span>' +
                '<span class="demand-step-meta">' + esc([e.status || (e.feito ? 'Concluída' : 'A fazer'),
                  responsaveisDe(e), e.vence_em ? Club.fmtDataCurta(e.vence_em) : 'Sem prazo'].join(' · ')) +
                '</span></span>' + ico('chevron-right') + '</button></li>';
        }).join('') + '</ul>' : '<p class="demand-description">Nenhuma subtarefa adicionada.</p>') +
        '</section>' : '') +
      '<div class="demand-detail-actions"><button type="button" class="btn" data-edit="demand" data-id="' +
        esc(d.id) + '">' + ico('edit') + (subId ? 'Editar demanda principal' : 'Editar demanda') + '</button></div>' +
    '</article>';
  }

  function detalheDemanda(id, subId) {
    var d = achar('demand', id);
    var r = subId ? etapa(subId) : d;
    if (!d || !r) return;
    /* Com o painel de pé, ele é o leitor: clicar em outra demanda troca o que
       está nele, sem abrir janela por cima. */
    if (st.painel) {
      st.painel = { id:id, subId:subId || null };
      renderPainel();
      sincronizarHash();
      return;
    }
    st.detalheModal = { id:id, subId:subId || null };
    Club.modal.open({
      title:subId ? 'Detalhes da subtarefa' : 'Detalhes da demanda',
      leitura:true, largura:780,
      body:corpoDetalhe(d, r, subId)
    });
    /* A setinha para fora: destaca a leitura num painel e devolve a lista. */
    var cab = document.querySelector('.modal-h');
    if (cab && !cab.querySelector('[data-destacar]')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-ghost btn-sm btn-destacar';
      b.setAttribute('data-destacar', '1');
      b.setAttribute('aria-label', 'Manter aberta');
      b.title = 'Manter aberta e continuar mexendo na lista';
      b.innerHTML = ico('arrow-left');
      cab.insertBefore(b, cab.querySelector('[data-close]'));
    }
    observarModal();
    sincronizarHash();
  }

  /* A janela fecha por vários caminhos (Esc, fundo, botão): quem avisa que
     ela fechou é o próprio atributo hidden, e a URL solta o id na hora. */
  var modalObservado = false;
  function observarModal() {
    if (modalObservado || !window.MutationObserver) return;
    var el = document.querySelector('.modal');
    if (!el) return;
    modalObservado = true;
    new MutationObserver(function () {
      if (el.hidden && st.detalheModal) { st.detalheModal = null; sincronizarHash(); }
    }).observe(el, { attributes:true, attributeFilter:['hidden'] });
  }

  /* ── painel destacado ──────────────────────────────────────────────────── */

  var CHAVE_PAINEL = 'ob-admin-dem-painel';
  function chavePainel() {
    return CHAVE_PAINEL + ':' + (sessao && sessao.email ? String(sessao.email).toLowerCase() : 'anon');
  }

  function criarPainel() {
    var el = document.createElement('aside');
    el.id = 'painelDemanda';
    el.className = 'painel-dem';
    el.hidden = true;
    el.setAttribute('aria-label', 'Demanda em acompanhamento');
    document.body.appendChild(el);
    var pos = null;
    try { pos = JSON.parse(localStorage.getItem(chavePainel())); } catch (err) { pos = null; }
    if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') posicionarPainel(el, pos.left, pos.top);
    arrastavel(el);
    window.addEventListener('resize', function () {
      if (el.style.left) posicionarPainel(el, parseFloat(el.style.left), parseFloat(el.style.top));
    });
    return el;
  }

  /* Nunca sai da tela: sobra ao menos o cabeçalho para pegar de volta. */
  function posicionarPainel(el, left, top) {
    var w = el.offsetWidth || 460;
    left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
    top = Math.max(8, Math.min(window.innerHeight - 64, top));
    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(top) + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }

  /* Arrasta pelo cabeçalho. A captura fica no painel, não no cabeçalho: o
     cabeçalho é redesenhado a cada gravação e sumiria no meio do arraste. */
  function arrastavel(el) {
    var arr = null;
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || !e.target.closest('[data-painel-arrastar]') || e.target.closest('button')) return;
      var r = el.getBoundingClientRect();
      arr = { id:e.pointerId, dx:e.clientX - r.left, dy:e.clientY - r.top, moveu:false };
      el.setPointerCapture(e.pointerId);
      el.classList.add('arrastando');
      e.preventDefault();
    });
    el.addEventListener('pointermove', function (e) {
      if (!arr || e.pointerId !== arr.id) return;
      arr.moveu = true;
      posicionarPainel(el, e.clientX - arr.dx, e.clientY - arr.dy);
    });
    function soltar(e) {
      if (!arr || e.pointerId !== arr.id) return;
      el.classList.remove('arrastando');
      if (arr.moveu) {
        try {
          localStorage.setItem(chavePainel(), JSON.stringify({
            left:parseFloat(el.style.left), top:parseFloat(el.style.top) }));
        } catch (err) { /* sem storage */ }
      }
      arr = null;
    }
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  }

  function renderPainel() {
    var p = st.painel;
    if (!p) return;
    var d = achar('demand', p.id), r = p.subId ? etapa(p.subId) : d;
    if (!d || !r) { fecharPainel(); return; }
    var el = $('painelDemanda') || criarPainel();
    var corpoAntigo = el.querySelector('.painel-b');
    var scroll = corpoAntigo ? corpoAntigo.scrollTop : 0;
    el.innerHTML =
      '<div class="painel-h" data-painel-arrastar>' + ico('check-circle') +
        '<span class="painel-t">' + (p.subId ? 'Subtarefa' : 'Demanda') + ' em acompanhamento</span>' +
        '<span class="sp"></span>' +
        '<button type="button" class="btn btn-ghost btn-sm btn-janela" data-painel-janela ' +
          'aria-label="Abrir como janela" title="Voltar para a janela">' + ico('arrow-left') + '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-painel-fechar aria-label="Fechar">' +
          ico('x') + '</button>' +
      '</div>' +
      '<div class="painel-b">' + corpoDetalhe(d, r, p.subId) + '</div>';
    el.hidden = st.view !== 'demands';
    el.querySelector('.painel-b').scrollTop = scroll;
  }

  function fecharPainel() {
    st.painel = null;
    var el = $('painelDemanda');
    if (el) el.hidden = true;
    sincronizarHash();
  }

  function destacarDetalhe() {
    var alvo = st.detalheModal;
    if (!alvo) return;
    st.detalheModal = null;
    Club.modal.close();
    st.painel = alvo;
    renderPainel();
    sincronizarHash();
  }

  function painelParaJanela() {
    var p = st.painel;
    if (!p) return;
    fecharPainel();
    detalheDemanda(p.id, p.subId);
  }

  /* Depois de cada redesenho da lista, o detalhe aberto (janela ou painel)
     relê o registro: a troca feita num lugar aparece no outro. O formulário
     de edição não tem .demand-detail, então não é tocado. */
  function atualizarDetalhes() {
    if (st.painel) renderPainel();
    var modal = document.querySelector('.modal');
    var corpo = modal && !modal.hidden ? modal.querySelector('.demand-detail') : null;
    if (!st.detalheModal || !corpo) return;
    var d = achar('demand', st.detalheModal.id);
    var r = st.detalheModal.subId ? etapa(st.detalheModal.subId) : d;
    if (!d || !r) { Club.modal.close(); return; }
    corpo.outerHTML = corpoDetalhe(d, r, st.detalheModal.subId);
  }

  function idEmDestaque() {
    if (st.painel) return st.painel.id;
    var modal = document.querySelector('.modal');
    if (st.detalheModal && modal && !modal.hidden) return st.detalheModal.id;
    return '';
  }

  /* ── formulário da demanda ─────────────────────────────────────────────
     Mesma hierarquia da tela de detalhes: contexto (frente ou mentorado) e
     título no topo, o cartão de situação, prioridade, dono e prazo, a
     descrição e o checklist. Os seletores são os mesmos menus das células da
     linha — o <select> nativo abre branco no branco no Windows — e o valor
     escolhido viaja num campo oculto, porque o formulário coleta por name. */

  function campoPick(label, name, hostId, valor, hint) {
    return '<div class="fld"><label>' + esc(label) + '</label><div id="' + hostId + '"></div>' +
      '<input type="hidden" name="' + name + '" value="' + esc(valor == null ? '' : valor) + '">' +
      (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</div>';
  }

  function campoOculto(campo) {
    return document.querySelector('#modalForm [name="' + campo + '"]');
  }

  function pickSimples(hostId, campo, itens, valor, opts) {
    var host = $(hostId), hidden = campoOculto(campo);
    if (!host || !hidden) return;
    opts = opts || {};
    Club.pick(host, itens, valor, { titulo:opts.titulo, vazio:opts.vazio, onPick:function (v, item) {
      hidden.value = v;
      if (opts.onPick) opts.onPick(v, item);
    } });
  }

  /* Vários de uma vez, num botão que se recolhe: o rótulo lista quem está
     marcado e o menu fica de pé enquanto a pessoa marca — o mesmo menu da
     coluna Responsáveis da linha. */
  function pickVarios(hostId, campo, itens, valores, opts) {
    var host = $(hostId), hidden = campoOculto(campo);
    if (!host || !hidden) return null;
    opts = opts || {};
    var marcados = (valores || []).slice();
    host.classList.add('pick');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'inp pick-b';
    btn.dataset.menuId = 'pickm-' + campo;
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="pick-l"></span><span class="pick-c">' + ico('chevron-down') + '</span>';
    host.appendChild(btn);

    function rotulo() {
      var nomes = itens.filter(function (i) { return marcados.indexOf(i.value) !== -1; })
        .map(function (i) { return i.label; });
      var l = btn.querySelector('.pick-l');
      l.textContent = nomes.length ? nomes.join(', ') : (opts.vazio || 'Ninguém');
      l.classList.toggle('is-ph', !nomes.length);
      hidden.value = marcados.join(',');
    }
    rotulo();

    btn.addEventListener('click', function () {
      Club.menu(btn, itens.map(function (i) {
        return { value:i.value, label:i.label, checked:marcados.indexOf(i.value) !== -1 };
      }), { titulo:opts.titulo, multi:true, largura:btn.offsetWidth, onPick:function (v, item) {
        var i = marcados.indexOf(v);
        if (item.checked && i === -1) marcados.push(v);
        if (!item.checked && i !== -1) marcados.splice(i, 1);
        rotulo();
        if (opts.onPick) opts.onPick(marcados.slice());
      } });
    });
    return {
      valores:function () { return marcados.slice(); },
      travar:function (sim) { btn.disabled = !!sim; if (sim) Club.fecharMenu(); }
    };
  }

  /* Uma linha do checklist no formulário. A existente mostra a situação, o
     dono e o prazo que carrega, para ninguém apagar às cegas; a nova é só o
     nome. O id fica no elemento: é ele que casa a linha com o banco, e não a
     posição — renomear ou inserir no meio não troca as marcas de lugar. */
  function linhaChecklistForm(e) {
    var meta = e ? [e.status || (e.feito ? 'Concluída' : 'A fazer'), responsaveisDe(e),
      e.vence_em ? Club.fmtDataCurta(e.vence_em) : 'Sem prazo'].join(' · ') : '';
    var cor = e ? (Club.DEM_COR[e.status] || 'var(--faint)') : 'var(--faint)';
    return '<div class="ck-item' + (e && e.feito ? ' feito' : '') + '" data-ck-id="' + esc(e ? e.id : '') + '">' +
      '<span class="ck-dot" style="background:' + cor + '"></span>' +
      '<div class="ck-body"><input class="inp ck-inp" data-ck-titulo value="' + esc(e ? e.titulo : '') +
        '" placeholder="O que falta fazer? Enter acrescenta outra." autocomplete="off" aria-label="Nome da subtarefa">' +
        (meta ? '<span class="ck-meta">' + esc(meta) + '</span>' : '') + '</div>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-ck-remover aria-label="Remover subtarefa">' +
        ico('trash') + '</button>' +
    '</div>';
  }

  function atualizarTotalCk() {
    var t = $('ckTotal');
    if (t) t.textContent = document.querySelectorAll('#ckEditor .ck-item').length;
  }

  function acrescentarLinhaCk(depoisDe) {
    var editor = $('ckEditor');
    if (!editor) return;
    var tpl = document.createElement('div');
    tpl.innerHTML = linhaChecklistForm(null);
    var nova = tpl.firstChild;
    if (depoisDe && depoisDe.parentElement === editor) depoisDe.insertAdjacentElement('afterend', nova);
    else editor.appendChild(nova);
    atualizarTotalCk();
    nova.querySelector('[data-ck-titulo]').focus();
  }

  /* Remover subtarefa que já existe no banco pede um segundo clique, dizendo
     o que vai junto. A que acabou de ser digitada sai na hora. */
  function removerLinhaCk(item) {
    if (!item.dataset.ckId) { item.remove(); atualizarTotalCk(); return; }
    if (item.classList.contains('confirmando')) return;
    var titulo = item.querySelector('[data-ck-titulo]').value.trim();
    item.classList.add('confirmando');
    item.insertAdjacentHTML('beforeend', '<div class="ck-confirm">' + ico('alert') +
      '<span>Remover <b>' + esc(titulo || 'esta subtarefa') + '</b>? Saem junto a situação, o dono ' +
      'e o prazo dela. Vale ao salvar; não dá para desfazer depois.</span>' +
      '<button type="button" class="btn btn-sm btn-danger" data-ck-confirmar>Remover</button>' +
      '<button type="button" class="btn btn-sm" data-ck-manter>Manter</button></div>');
  }

  function lerChecklistForm() {
    return Array.prototype.map.call(document.querySelectorAll('#ckEditor .ck-item'), function (item) {
      return { id:item.dataset.ckId || null, titulo:item.querySelector('[data-ck-titulo]').value.trim() };
    }).filter(function (it) { return it.titulo; });
  }

  /* Casa pelo id, não pela posição: renomear atualiza a mesma linha, inserir
     no meio só empurra a ordem, e apagar apaga só a que saiu — com a situação,
     o dono e o prazo que ela carregava, e mais nada. */
  function sincronizarChecklist(demandId, itens, atuais, memberId) {
    var porId = {};
    (atuais || []).forEach(function (a) { porId[a.id] = a; });
    var acoes = [], novos = [];
    itens.forEach(function (it, i) {
      var a = it.id ? porId[it.id] : null;
      if (!a) { novos.push({ demand_id:demandId, titulo:it.titulo, ordem:i, member_id:memberId || null }); return; }
      if (a.titulo !== it.titulo || a.ordem !== i) {
        acoes.push(Club.data.demandSteps.save({ id:a.id, titulo:it.titulo, ordem:i }));
      }
    });
    (atuais || []).forEach(function (a) {
      if (!itens.some(function (it) { return it.id === a.id; })) acoes.push(Club.data.demandSteps.remove(a.id));
    });
    if (novos.length) acoes.push(Club.data.demandSteps.saveMany(novos));
    return Promise.all(acoes);
  }

  /* O que vai para o banco. Etapa só faz sentido dentro da frente. */
  function registroDemanda(base, memberId, artifactId, stepId) {
    var r = Object.assign({}, base, { member_id: memberId || null, artifact_id: artifactId || null });
    r.step_id = r.artifact_id ? (stepId || null) : null;
    return r;
  }

  function modalDemanda(d, prefill) {
    var novo = !d || !d.id;
    prefill = prefill || {};
    d = Object.assign({ titulo:'', descricao:'', status:'A fazer', prioridade:'Média',
               responsaveis:[], member_id:null, origem:'', vence_em:'', artifact_id:null, step_id:null },
               novo ? prefill : {}, d || {});
    var subAtuais = d.id ? etapasDaDemanda(d.id) : [];
    /* Quem veio da janela de detalhes volta para ela depois de salvar. Com o
       painel de pé não precisa: ele se redesenha sozinho. */
    var voltarPara = !novo && !st.painel ? st.detalheModal : null;
    var equipe = st.staff.filter(function (p) { return p.ativo; })
      .map(function (p) { return { value:p.id, label:p.nome }; });
    var ativos = st.members.filter(function (m) { return m.ativo; });

    function corDe(mapa, v, padrao) { return mapa[v] || padrao; }

    Club.modal.open({
      title: novo ? 'Nova demanda' : 'Editar demanda',
      sub: novo ? 'Quadro interno da equipe. Nenhum mentorado vê demandas — nem as ligadas a ele.'
                : d.titulo,
      largura: 780,
      submitLabel: novo ? 'Criar demanda' : 'Salvar',
      body:
        '<div class="demand-form">' +
          '<div class="demand-form-meta">' +
            campoPick('Frente', 'artifact_id', 'pkFrente', d.artifact_id || '',
              'Área da jornada onde a demanda vive. Mentorado + frente = trabalho daquele artefato para ele.') +
            campoPick('Etapa do checklist', 'step_id', 'pkEtapa', d.step_id || '') +
          '</div>' +
          '<div class="demand-form-title">' +
            Club.field('O que precisa ser feito', 'titulo', { value:d.titulo, required:true,
              placeholder:'Conectar o WhatsApp da clínica do Arthur' }) +
          '</div>' +
          '<div class="demand-form-meta">' +
            campoPick('Situação', 'status', 'pkStatus', d.status) +
            campoPick('Prioridade', 'prioridade', 'pkPrio', d.prioridade) +
            (equipe.length
              ? campoPick('Responsáveis', 'responsaveis', 'pkResp', (d.responsaveis || []).join(','))
              : '<div class="fld"><label>Responsáveis</label><div class="notice" style="margin:0">' + ico('alert') +
                '<div>Ninguém na equipe ainda. Cadastre pelo botão Equipe.</div></div>' +
                '<input type="hidden" name="responsaveis" value=""></div>') +
            Club.field('Prazo', 'vence_em', { value:d.vence_em || '', type:'date' }) +
            (novo
              ? campoPick('Para quais mentorados', 'membros', 'pkMembros', d.member_id || '')
              : campoPick('Mentorado', 'member_id', 'pkMembro', d.member_id || '')) +
            Club.field('Origem', 'origem', { value:d.origem || '', placeholder:'Reunião 30/07',
              hint:'De onde a demanda nasceu.' }) +
          '</div>' +
          /* O aviso do lote é fixo de propósito: mostrar e esconder blocos com o
             menu de mentorados aberto rola o formulário, e rolar fecha o menu. */
          (novo
            ? Club.checkbox('Criar para todos os mentorados ativos (' + ativos.length + ')', 'todos', false) +
              '<div class="notice" id="avisoLote">' + ico('users') + '<div style="flex:1;min-width:0">Vazio = demanda interna. Um mentorado = ' +
              'uma demanda dele. Vários = uma demanda por mentorado, independentes entre si: concluir ou editar ' +
              'uma não muda as outras.</div></div>'
            : '') +
          '<div class="demand-section"><h4>Descrição</h4>' +
            '<textarea name="descricao" class="inp" placeholder="Contexto, links, o que já foi tentado.">' +
            esc(d.descricao || '') + '</textarea></div>' +
          '<div class="demand-section"><h4>Checklist <span id="ckTotal">' + subAtuais.length + '</span></h4>' +
            '<div class="ck-editor" id="ckEditor">' + subAtuais.map(linhaChecklistForm).join('') + '</div>' +
            '<button type="button" class="add-sub" data-ck-add>' + ico('plus') + 'Acrescentar subtarefa</button>' +
            '<span class="hint">Cada linha vira um item do checklist da demanda. Situação, dono e prazo de ' +
              'cada item se ajustam na própria lista, depois de salvar.</span>' +
          '</div>' +
        '</div>',

      onSubmit: function (dados) {
        var titulo = String(dados.titulo || '').trim();
        if (!titulo) { Club.toast('A demanda precisa de um título.', 'alert'); return; }

        var alvos = novo
          ? (dados.todos ? ativos.map(function (m) { return m.id; })
                         : String(dados.membros || '').split(',').filter(Boolean))
          : [dados.member_id || null];
        if (!alvos.length) alvos = [null];

        var base = {
          titulo:titulo, descricao:dados.descricao, status:dados.status, prioridade:dados.prioridade,
          responsaveis:String(dados.responsaveis || '').split(',').filter(Boolean),
          origem:dados.origem, vence_em:dados.vence_em
        };
        var itens = lerChecklistForm();
        var botao = document.querySelector('.modal-f .btn-primary');
        if (botao) botao.disabled = true;

        var fluxo;
        if (!novo) {
          fluxo = Club.data.demands.save(Object.assign({ id:d.id }, registroDemanda(base, alvos[0], dados.artifact_id, dados.step_id)))
            .then(function (salva) { return sincronizarChecklist(salva.id, itens, subAtuais, salva.member_id); });
        } else if (alvos.length === 1) {
          fluxo = Club.data.demands.save(registroDemanda(base, alvos[0], dados.artifact_id, dados.step_id))
            .then(function (salva) { return sincronizarChecklist(salva.id, itens, [], salva.member_id); });
        } else {
          /* Em lote: um insert com todas as demandas, outro com todos os
             checklists. Duas idas ao banco, não sessenta. */
          fluxo = Club.data.demands.saveMany(alvos.map(function (m) {
            return registroDemanda(base, m, dados.artifact_id, dados.step_id);
          })).then(function (salvas) {
            var passos = [];
            salvas.forEach(function (s) {
              itens.forEach(function (it, i) {
                passos.push({ demand_id:s.id, titulo:it.titulo, ordem:i, member_id:s.member_id });
              });
            });
            return Club.data.demandSteps.saveMany(passos);
          });
        }

        fluxo.then(function () {
          Club.modal.close();
          var n = alvos.length;
          var msg = !novo ? 'Demanda atualizada.'
            : n > 1 ? n + ' demandas criadas, uma por mentorado.' : 'Demanda criada.';
          /* Quem cria para outra pessoa não vê a demanda em "Minhas". */
          if (novo && st.demVisao === 'minhas' && (!st.eu || base.responsaveis.indexOf(st.eu.id) === -1)) {
            msg += ' Aparece' + (n > 1 ? 'm' : '') + ' em "Todas".';
          }
          return recarregarDemandas(msg).then(function () {
            if (voltarPara && !st.painel && achar('demand', voltarPara.id)) {
              detalheDemanda(voltarPara.id, voltarPara.subId);
            }
          });
        }).catch(aviso);
      }
    });

    /* Os seletores só existem depois que o formulário está no DOM. */
    pickSimples('pkStatus', 'status', Club.DEM_STATUS.map(function (v) {
      return { value:v, label:v, color:corDe(Club.DEM_COR, v, 'var(--faint)') };
    }), d.status, { titulo:'Situação' });
    pickSimples('pkPrio', 'prioridade', Club.DEM_PRIORIDADES.map(function (v) {
      return { value:v, label:v, color:corDe(Club.DEM_PRIO_COR, v, 'var(--faint)') };
    }), d.prioridade, { titulo:'Prioridade' });
    if (equipe.length) {
      pickVarios('pkResp', 'responsaveis', equipe, d.responsaveis || [],
        { titulo:'Responsáveis', vazio:'Ninguém ainda' });
    }

    /* Frente e etapa: a etapa depende da frente, então trocar a frente
       redesenha o menu de etapas e zera a escolhida. */
    var etapaOculta = campoOculto('step_id');
    function montarEtapas(artifactId, stepId) {
      var host = $('pkEtapa');
      if (!host) return;
      host.innerHTML = '';
      if (etapaOculta) etapaOculta.value = stepId || '';
      if (!artifactId || !etapasDe(artifactId).length) {
        host.innerHTML = '<span class="hint">' + (artifactId ? 'Esta frente não tem checklist.' : 'Escolha a frente primeiro.') + '</span>';
        return;
      }
      pickSimples('pkEtapa', 'step_id', itensMenuEtapa(artifactId, stepId).map(function (i) {
        return { value:i.value, label:i.label };
      }), stepId || '', { titulo:'Etapa do checklist' });
    }
    pickSimples('pkFrente', 'artifact_id', itensMenuFrente(d.artifact_id, d.member_id).map(function (i) {
      return { value:i.value, label:i.label };
    }), d.artifact_id || '', { titulo:'Frente', onPick:function (v) { montarEtapas(v, ''); } });
    montarEtapas(d.artifact_id, d.step_id);

    if (novo) {
      var membros = ativos.map(function (m) { return { value:m.id, label:m.nome }; });
      var todos = campoOculto('todos');
      var pickM = pickVarios('pkMembros', 'membros', membros, d.member_id ? [d.member_id] : [],
        { titulo:'Para quais mentorados', vazio:'Nenhum — demanda interna', onPick:atualizarLote });
      function atualizarLote() {
        var n = todos && todos.checked ? ativos.length : (pickM ? pickM.valores().length : 0);
        if (pickM) pickM.travar(todos && todos.checked);
        var botao = document.querySelector('.modal-f .btn-primary');
        if (botao) botao.textContent = n > 1 ? 'Criar ' + n + ' demandas' : 'Criar demanda';
      }
      if (todos) todos.addEventListener('change', atualizarLote);
    } else {
      pickSimples('pkMembro', 'member_id',
        [{ value:'', label:'Nenhum — demanda interna' }].concat(st.members.map(function (m) {
          return { value:m.id, label:m.nome };
        })), d.member_id || '', { titulo:'Sobre qual mentorado' });
    }

    var campoTitulo = document.querySelector('#modalForm [name="titulo"]');
    if (campoTitulo) campoTitulo.focus();
  }

  /* O ✓ da linha é atalho para a coluna Situação: mesma gravação otimista, sem
     reler o painel inteiro. Antes, cada conclusão esperava dezoito consultas
     voltarem para a tela reagir — e a linha sumia sem aviso quando o filtro
     "Em aberto" estava ligado. */
  /* Demanda de rotina concluída: a próxima ocorrência nasce igual, com o
     prazo empurrado pela cadência da etapa a partir do maior entre o prazo
     atual e hoje. Sem cadência na etapa, vale uma semana. */
  function proximaOcorrencia(d, e, hojeISO) {
    var dias = e && e.cadencia_dias ? e.cadencia_dias : 7;
    var base = new Date((d.vence_em && d.vence_em > hojeISO ? d.vence_em : hojeISO) + 'T12:00:00');
    base.setDate(base.getDate() + dias);
    var iso = base.getFullYear() + '-' + String(base.getMonth() + 1).padStart(2, '0') + '-' +
      String(base.getDate()).padStart(2, '0');
    return {
      titulo: d.titulo, descricao: d.descricao || '', status: 'A fazer',
      prioridade: d.prioridade || 'Média', responsaveis: (d.responsaveis || []).slice(),
      member_id: d.member_id || null, artifact_id: d.artifact_id || null, step_id: d.step_id || null,
      origem: 'Rotina · ' + (e && e.titulo ? e.titulo : 'etapa'), vence_em: iso
    };
  }

  /* Concluir a demanda que nasceu de uma etapa é, quase sempre, concluir a
     etapa. Quase: por isso pergunta, não marca sozinha. */
  function etapaParaMarcar(d) {
    if (!d || !d.member_id || !d.step_id) return null;
    if (marcada(d.member_id, d.step_id)) return null;
    return { memberId:d.member_id, stepId:d.step_id };
  }

  function mudarStatus(id, status) {
    var d = achar('demand', id);
    if (!d) return;
    salvarDemanda(id, { status: status });
    if (status !== 'Concluída') { Club.toast('Demanda reaberta.'); return; }
    var etapa = d.step_id ? etapasDe(d.artifact_id).filter(function (x) { return x.id === d.step_id; })[0] : null;
    /* Quem concluiu de dentro da janela de detalhes volta para ela depois. */
    var det = st.detalheModal;
    function voltarAoDetalhe() { if (det && achar('demand', det.id)) detalheDemanda(det.id, det.subId); }

    if (etapa && Club.tipoEtapa(etapa) === 'rotina') {
      /* Rotina concluída pede a próxima ocorrência, não "marcar a etapa":
         marcar rotina é ligar ou desligar o acompanhamento, não concluir. */
      var prox = proximaOcorrencia(d, etapa, hojeISO());
      var cad = etapa.cadencia_dias ? Club.cadenciaRotulo(etapa.cadencia_dias).toLowerCase() : 'a cada 7 dias';
      Club.modal.open({
        title:'Criar a próxima ocorrência?',
        body:'<p>Rotina "' + esc(etapa.titulo) + '" · ' + esc(cad) + '. A próxima demanda nasce para ' +
          esc(Club.fmtDataCurta(prox.vence_em)) + ', com os mesmos responsáveis.</p>',
        submitLabel:'Criar a próxima',
        onSubmit:function () {
          Club.modal.close();
          Club.data.demands.save(prox).then(function () {
            return recarregarDemandas('Próxima ocorrência criada para ' + Club.fmtDataCurta(prox.vence_em) + '.');
          }).then(voltarAoDetalhe).catch(aviso);
        }
      });
    }

    /* Rotina já pediu a próxima ocorrência; não pergunta também "marcar a etapa". */
    var alvo = etapa && Club.tipoEtapa(etapa) === 'rotina' ? null : etapaParaMarcar(d);
    if (alvo) {
      /* Não é Club.modal.confirm: aquele é o diálogo de apagar, com botão
         vermelho "Remover". Aqui a ação afirmativa é marcar. */
      Club.modal.open({
        title:'Marcar a etapa também?',
        body:'<p>A demanda veio da etapa "' + esc(etapa ? etapa.titulo : 'do checklist') + '" de ' +
          esc(membro(alvo.memberId) || 'mentorado') + '. Marcar como feita na Progressão?</p>',
        submitLabel:'Marcar etapa',
        onSubmit:function () { Club.modal.close(); marcarEtapa(alvo.memberId, alvo.stepId); voltarAoDetalhe(); }
      });
    }
    Club.toast(st.demAbertas === 'open'
      ? 'Demanda concluída. Ela fica aqui até você trocar o filtro; depois, em "Todas".'
      : 'Demanda concluída.');
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
          .then(function () { Club.modal.close(); recarregarDemandas('Pessoa adicionada.'); })
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
                aviso:'Os artefatos que eram só dele saem junto.' },
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
                  return n ? 'As ' + n + ' frentes dela ficam "Sem área"; nada de progresso muda.' : '';
                } },
    material:  { store:'materials',  nome:function (r) { return r.titulo; },
                 aviso:'O arquivo sai do servidor junto.' },
    /* `recarregar` é opcional: quem mora na aba Demandas relê só o quadro. */
    demand:    { store:'demands',    nome:function (r) { return r.titulo; },
                 aviso:'As subtarefas dela saem junto.', recarregar:recarregarDemandas },
    staff:     { store:'staff',      nome:function (r) { return r.nome; },
                 aviso:'As demandas dele continuam, sem responsável.', recarregar:recarregarDemandas },
    /* Sem esta linha o clique em Editar/Responder morre em silêncio: achar()
       procura o store aqui e estoura antes de o modal abrir. */
    botExemplo: { store:'botExemplos', nome:function (r) { return r.comentario; },
                  aviso:'' },
    qr:         { store:'qrLinks',     nome:function (r) { return r.titulo; },
                  aviso:'Os scans registrados nele ficam, sem destino.' }
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
          .then(function () { (t.recarregar || recarregar)('Removido.'); })
          .catch(aviso);
      });
  }

  var MODAIS = { member:modalMembro, event:modalEvento,
                 artifact:modalArtefato, group:modalGrupo, material:modalMaterial,
                 demand:modalDemanda, botExemplo:modalBotExemplo, qr:modalQr };

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

    /* Checklist dentro do formulário da demanda. */
    var ckAdd = e.target.closest('[data-ck-add]');
    if (ckAdd) { acrescentarLinhaCk(null); return; }
    var ckRemover = e.target.closest('[data-ck-remover]');
    if (ckRemover) { removerLinhaCk(ckRemover.closest('.ck-item')); return; }
    var ckConfirmar = e.target.closest('[data-ck-confirmar]');
    if (ckConfirmar) { ckConfirmar.closest('.ck-item').remove(); atualizarTotalCk(); return; }
    var ckManter = e.target.closest('[data-ck-manter]');
    if (ckManter) {
      var itemCk = ckManter.closest('.ck-item');
      itemCk.classList.remove('confirmando');
      itemCk.querySelector('.ck-confirm').remove();
      return;
    }

    /* Detalhe: destacar em painel, voltar para a janela, fechar o painel. */
    var destacar = e.target.closest('[data-destacar]');
    if (destacar) { destacarDetalhe(); return; }
    var painelJanela = e.target.closest('[data-painel-janela]');
    if (painelJanela) { painelParaJanela(); return; }
    var painelFechar = e.target.closest('[data-painel-fechar]');
    if (painelFechar) { fecharPainel(); return; }

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

    var down = e.target.closest('[data-baixar]');
    if (down) { baixar(down.dataset.baixar); return; }

    var conc = e.target.closest('[data-concluir]');
    if (conc) { mudarStatus(conc.dataset.concluir, 'Concluída'); return; }

    var reab = e.target.closest('[data-reabrir]');
    if (reab) { mudarStatus(reab.dataset.reabrir, 'A fazer'); return; }

    var eq = e.target.closest('[data-equipe]');
    if (eq) { modalEquipe(); return; }

    var foco = e.target.closest('[data-foco]');
    if (foco) { aplicarFoco(foco.dataset.foco); return; }

    var focoLimpar = e.target.closest('[data-foco-limpar]');
    if (focoLimpar) { st.demFoco = ''; sincronizarHash(); renderDemandas(); return; }

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

    var abrirDem = e.target.closest('[data-abrir-demanda]');
    if (abrirDem) { var pd = abrirDem.dataset.abrirDemanda.split('|'); abrirDemandaDaEtapa(pd[0], pd[1]); return; }

    var verDem = e.target.closest('[data-ver-demandas]');
    if (verDem) { var pv = verDem.dataset.verDemandas.split('|'); verDemandasDaEtapa(pv[0], pv[1]); return; }

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

  /* Com um menu de pé dentro do formulário, Esc fecha só o menu: sem isto o
     mesmo Esc fecharia o formulário junto e levaria o que já estava digitado. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (document.querySelector('.menu')) {
      e.stopPropagation();
      Club.fecharMenu();
      return;
    }
    /* Esc dentro do painel destacado fecha o painel — só quando não há
       janela por cima, que é de quem o Esc é primeiro. */
    var modal = document.querySelector('.modal');
    var painel = $('painelDemanda');
    if (st.painel && painel && !painel.hidden && (!modal || modal.hidden) &&
        painel.contains(document.activeElement)) fecharPainel();
  }, true);

  /* Mesma regra para o mouse: o clique fora que derruba o menu (marcar vários
     responsáveis e clicar em qualquer lugar para sair) não pode cair no fundo
     escuro e fechar também o formulário. */
  var cliqueDerrubouMenu = false;
  document.addEventListener('mousedown', function (e) {
    var menu = document.querySelector('.menu');
    cliqueDerrubouMenu = !!(menu && !menu.contains(e.target) &&
      !(e.target.closest && e.target.closest('[data-menu-id]')));
  }, true);
  document.addEventListener('click', function (e) {
    if (!cliqueDerrubouMenu) return;
    cliqueDerrubouMenu = false;
    if (e.target.classList && e.target.classList.contains('modal')) e.stopPropagation();
  }, true);

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
    /* No checklist do formulário, Enter abre a próxima linha em vez de
       enviar o formulário: quem cadastra checklist cadastra vários de uma vez. */
    if (e.target.matches('[data-ck-titulo]') && e.key === 'Enter') {
      e.preventDefault();
      if (e.isComposing) return;
      acrescentarLinhaCk(e.target.closest('.ck-item'));
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

  $('filtroFrenteDem').addEventListener('change', function () {
    st.demFrente = this.value;
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


  /* ── partida ──────────────────────────────────────────────────────────── */

  function render() {
    renderNav();
    renderMembers();
    renderAgenda();
    renderArtifacts();
    renderMaterials();
    renderDemandas();
    renderIgMetricas();
    renderBotFila();
    renderBotExemplos();
    Club.graduacao.mountAdmin($('graduacaoAdmin'), st.members);
    renderQr();
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
      /* #demandas na URL abre direto no quadro: é o atalho que vai no favorito.
         #demandas?foco=atrasadas abre já no recorte. */
      var h = lerHash();
      st.demFoco = h.foco;
      render();
      go(h.secao === 'demandas' ? 'demands' : h.secao && document.querySelector('.view[data-view="' + h.secao + '"]') ? h.secao : 'farol');
      if (h.secao === 'demandas' && h.id && achar('demand', h.id)) detalheDemanda(h.id);
    });
  }).catch(falhou);

  /* Colar outro endereço do quadro na mesma aba, sem recarregar. */
  window.addEventListener('hashchange', function () {
    if (!sessao) return;
    var h = lerHash();
    if (h.secao === 'farol') {
      if (st.view !== 'farol') go('farol');
      else Club.farol.enter(location.hash);
      return;
    }
    if (h.secao !== 'demandas') return;
    if (h.foco !== st.demFoco) { st.demFoco = h.foco; renderDemandas(); }
    if (st.view !== 'demands') go('demands');
    if (h.id && h.id !== idEmDestaque() && achar('demand', h.id)) detalheDemanda(h.id);
  });
})();
