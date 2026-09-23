/* Farol executivo: CRM, Instagram, entregas e graduação de um mentorado. */
(function () {
  'use strict';
  var C = window.Club = window.Club || {};
  var root, sources, selected = '', days = 30, request = 0;
  var clinic = null, graduation = null, clinicLoading = false, graduationLoading = false;
  var modalStack = [], modalReturnFocus = null;
  var esc = C.esc;
  var format = new Intl.NumberFormat('pt-BR');
  var money = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 });
  var moneyPrecise = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:2, maximumFractionDigits:2 });
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function number(value) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : format.format(Number(value)); }
  function moneyValue(value) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : money.format(Number(value)); }
  function moneyDetail(value) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : moneyPrecise.format(Number(value)); }
  function attendanceValid(a) {
    if (!a || a.attended == null || a.eligible == null || a.attended === '' || a.eligible === '') return false;
    var x = Number(a.attended), y = Number(a.eligible);
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y > 0 && x <= y;
  }
  function text(value) { return value === null || value === undefined || value === '' ? '—' : esc(String(value)); }
  function date(value) {
    if (!value) return '—';
    var s = String(value).slice(0, 10).split('-');
    return s.length === 3 ? s[2] + '/' + s[1] + '/' + s[0] : '—';
  }
  function members() { return sources.members().filter(function (m) { return m.ativo !== false; }); }
  function current() { return members().filter(function (m) { return m.id === selected; })[0] || null; }
  function storageKey() {
    var s = sources.session() || {};
    return 'ob-admin-farol:' + (s.userId || String(s.email || '').toLowerCase() || 'anon');
  }
  function saved() {
    try { return JSON.parse(localStorage.getItem(storageKey()) || '{}'); } catch (_) { return {}; }
  }
  function save() {
    try { localStorage.setItem(storageKey(), JSON.stringify({ memberId:selected, days:days })); } catch (_) { /* armazenamento opcional */ }
  }
  function hash() {
    var detail = modalStack.length ? '&detalhe=' + encodeURIComponent(modalStack[modalStack.length - 1]) : '';
    var next = '#farol/' + encodeURIComponent(selected) + '?dias=' + days + detail;
    if (location.hash !== next) history.replaceState(null, '', next);
  }
  function parseHash(h) {
    var match = /^#farol\/([^?]+)(?:\?(.+))?$/.exec(h || '');
    if (!match) return {};
    var id = '';
    try { id = decodeURIComponent(match[1]); } catch (_) { return {}; }
    var params = new URLSearchParams(match[2] || '');
    var detail = params.get('detalhe') || '';
    return { memberId:UUID.test(id) ? id : '', days:params.get('dias') === '7' ? 7 : 30,
      detail:/^[a-z]+(?::[a-zA-Z0-9-]+){0,2}$/.test(detail) ? detail : '' };
  }
  function percent(currentValue, previousValue) {
    if (currentValue == null || previousValue == null) return 'Sem comparativo';
    if (Number(previousValue) === 0) return 'Anterior: 0';
    var delta = Math.round((Number(currentValue) - Number(previousValue)) / Number(previousValue) * 100);
    return (delta > 0 ? '+' : '') + delta + '% vs. período anterior';
  }
  function skel(w, cls) { return '<span class="farol-skel' + (cls ? ' ' + cls : '') + '" style="width:' + w + '" aria-hidden="true"></span>'; }
  function clinicalData() { return clinic && clinic.funnel && clinic.funnel.status === 'ready' ? clinic.funnel.data : null; }
  function clinicalCard(label, field) {
    var data = clinicalData(), value = data && data.periodo && data.periodo[field];
    var before = data && data.anterior && data.anterior[field];
    return '<button class="farol-kpi" data-farol-detail="clinical:' + field + '"><span class="farol-label">' + label + '</span>' +
      '<strong>' + (clinicLoading ? skel('64%', 'farol-skel-num') : number(value)) + '</strong>' +
      '<small>' + (clinicLoading ? skel('82%') : text(data ? percent(value, before) : 'CRM indisponível')) + '</small></button>';
  }
  function igData() {
    var all = sources.instagram();
    var row = all.resumo.filter(function (r) { return r.member_id === selected; })[0];
    if (!row) return { error:all.indisponivel ? 'Fonte Instagram indisponível' : 'Conta Instagram sem vínculo ou sem coleta' };
    var end = clinic && clinic.period && clinic.period.date_end || new Date().toISOString().slice(0, 10);
    var start = new Date(end + 'T12:00:00Z'); start.setUTCDate(start.getUTCDate() - days + 1);
    var startISO = start.toISOString().slice(0, 10);
    var points = all.serie.filter(function (p) { return p.member_id === selected && p.username === row.username && p.dia >= startISO && p.dia <= end; });
    var measured = points.filter(function (p) { return p.seguidores_ganhos !== null && p.seguidores_ganhos !== undefined; });
    return { row:row, points:points, measured:measured,
      gains:measured.length ? measured.reduce(function (sum, p) { return sum + Number(p.seguidores_ganhos); }, 0) : null,
      partial:measured.length < days, stale:row.dia < end };
  }
  function spark(points) {
    var valid = points.filter(function (p) { return p.seguidores_ganhos !== null && p.seguidores_ganhos !== undefined; });
    if (!valid.length) return '<div class="farol-empty-spark">Sem série diária de ganhos</div>';
    var ceiling = Math.max.apply(null, valid.map(function (p) { return Math.abs(Number(p.seguidores_ganhos)); })) || 1;
    return '<div class="farol-spark" aria-label="Ganhos diários de seguidores">' + valid.map(function (p) {
      var val = Number(p.seguidores_ganhos);
      return '<button data-farol-detail="igday:' + esc(p.dia) + '" class="' + (val < 0 ? 'negative' : '') + '" style="height:' +
        Math.max(3, Math.round(Math.abs(val) / ceiling * 36)) + 'px" title="' + text(date(p.dia) + ': ' + val) + '" aria-label="Ver coleta de ' + date(p.dia) + '"></button>';
    }).join('') + '</div>';
  }
  function instagramCard() {
    var ig = igData();
    if (!ig.row) return '<section class="farol-card" data-farol-card="instagram"><div class="farol-card-head"><span>INSTAGRAM</span></div><button class="farol-unavailable farol-detail-button" data-farol-detail="instagram">' + text(ig.error) + '</button><button class="farol-link" data-farol-detail="instagram">Entender fonte ↗</button></section>';
    var r = ig.row;
    var detail = [
      ['Visualizações', r.visualizacoes], ['Alcance', r.alcance],
      ['Interações', r.interacoes], ['Visitas ao perfil', r.visitas_perfil]
    ];
    return '<section class="farol-card" data-farol-card="instagram"><div class="farol-card-head"><span>INSTAGRAM</span><small>@' + text(r.username) + ' · ' + date(r.dia) + '</small></div>' +
      '<div class="farol-ig-main"><button data-farol-detail="instagram"><span class="farol-label">Seguidores</span><strong>' + number(r.seguidores) + '</strong></button>' +
      '<button data-farol-detail="instagram"><span class="farol-label">Ganhos brutos · ' + days + ' dias</span><strong class="farol-gain">' + (ig.gains == null ? '—' : (ig.gains > 0 ? '+' : '') + number(ig.gains)) + '</strong></button></div>' +
      '<div class="farol-source">' + ig.measured.length + '/' + days + ' dias medidos' + (ig.partial ? ' · parcial' : '') + (ig.stale ? ' · último retrato ' + date(r.dia) : '') + '</div>' + spark(ig.points) +
      '<div class="farol-ig-details">' + detail.map(function (d) { return '<button data-farol-detail="instagram"><small>' + d[0] + ' · 7 dias</small><b>' + number(d[1]) + '</b></button>'; }).join('') + '</div>' +
      '<button class="farol-link" data-farol-ig-open>Ver histórico <span aria-hidden="true">↗</span></button></section>';
  }
  function deliveryCard() {
    var d = sources.entregas(selected);
    return '<section class="farol-card" data-farol-card="delivery"><div class="farol-card-head"><span>ENTREGAS DO CLUB</span><small>artefatos aceitos</small></div>' +
      '<button class="farol-delivery-main farol-detail-button" data-farol-detail="delivery"><strong>' + (d.pcts.length ? d.pct + '%' : '—') + '</strong><span>progresso médio</span></button>' +
      '<div class="farol-progress"><i style="width:' + (d.pcts.length ? d.pct : 0) + '%"></i></div>' +
      '<div class="farol-delivery-details"><button data-farol-detail="delivery:air"><b>' + d.noar + '</b> no ar</button><button data-farol-detail="delivery:team"><b>' + d.equipe + '</b> equipe</button><button class="farol-warn" data-farol-detail="delivery:blocked"><b>' + d.travados + '</b> travados</button></div>' +
      '<div class="farol-source">' + d.aceitos + ' aceitos' + (d.definir ? ' · ' + d.definir + ' a definir' : '') + '</div>' +
      '<button class="farol-link" data-farol-detail="delivery">Ver entregas <span aria-hidden="true">↗</span></button></section>';
  }
  function periodId(snapshot) {
    if (snapshot.currentPeriod) return snapshot.currentPeriod;
    var now = new Date(), quarter = Math.floor(now.getMonth() / 3) + 1;
    return now.getFullYear() + '-T' + quarter;
  }
  function graduationCard() {
    if (graduationLoading) return '<section class="farol-card is-loading" aria-busy="true" data-farol-card="graduation"><div class="farol-card-head"><span>GRADUAÇÃO</span>' + skel('92px') + '</div>' +
      '<div class="farol-grade"><div>' + skel('70px') + skel('78%', 'farol-skel-num') + '</div><div>' + skel('70px') + skel('46%', 'farol-skel-num') + '</div></div>' +
      skel('100%', 'farol-skel-bar') + skel('38%') + '<span class="farol-sr">Carregando graduação</span></section>';
    if (!graduation || !graduation.snapshot) return '<section class="farol-card" data-farol-card="graduation"><div class="farol-card-head"><span>GRADUAÇÃO</span></div><button class="farol-unavailable farol-detail-button" data-farol-detail="graduation">' + text(graduation && graduation.error || 'Sem apuração disponível') + '</button><button class="farol-link" data-farol-detail="graduation">Entender fonte ↗</button></section>';
    var s = graduation.snapshot, m = C.graduacao.model(s, periodId(s));
    var attendance = m.period && m.period.attendance;
    var attended = attendance && number(attendance.attended), eligible = attendance && number(attendance.eligible);
    return '<section class="farol-card" data-farol-card="graduation"><div class="farol-card-head"><span>GRADUAÇÃO</span><small>' + (graduation.is_demo ? '<b class="farol-preview">PRÉVIA</b> ' : '') + 'fonte ' + date(graduation.source_date) + '</small></div>' +
      '<div class="farol-grade"><button data-farol-detail="graduation"><span class="farol-label">' + text(m.period && m.period.label || periodId(s)) + '</span><strong>' + (m.points == null ? '—' : number(m.points)) + '<small> / 50 pts</small></strong></button>' +
      '<button data-farol-detail="graduation"><span class="farol-label">Grau atual</span><strong>' + number(m.grade) + '<small>º grau</small></strong></button></div>' +
      '<div class="farol-progress"><i style="width:' + m.percent + '%"></i></div>' +
      '<div class="farol-source">' + text(m.points == null ? 'Sem pontos neste trimestre' : m.missing === 0 ? 'Meta atingida' : 'Faltam ' + number(m.missing) + ' pts') + ' · ' + text(C.graduacao.beltName(m.grade)) + '</div>' +
      '<button class="farol-presence" data-farol-detail="presence"><span>Presença</span><b>' + (attendanceValid(attendance) ? attended + ' de ' + eligible + ' encontros' : 'Sem apuração') + '</b><span aria-hidden="true">↗</span></button>' +
      '<a class="farol-link" target="_blank" rel="noopener" href="/membros/?membro=' + encodeURIComponent(selected) + '#graduacao">Ver graduação ↗</a></section>';
  }
  function lateDemands() {
    return sources.demandas().filter(function (d) {
      return d.member_id === selected && C.DEM_ABERTOS.indexOf(d.status) !== -1 && d.vence_em && C.diffDays(d.vence_em) < 0;
    });
  }
  function attention() {
    var items = [], d = sources.entregas(selected), late = lateDemands();
    if (d.travados) items.push([d.travados + ' entrega' + (d.travados === 1 ? '' : 's') + ' travada' + (d.travados === 1 ? '' : 's'), 'progress']);
    if (late.length) items.push([late.length + ' demanda' + (late.length === 1 ? '' : 's') + ' vencida' + (late.length === 1 ? '' : 's'), 'demands']);
    if (clinic && clinic.status === 'unlinked') items.push(['Clínica sem vínculo no CRM', 'crm']);
    else if (clinic && clinic.error) items.push(['CRM indisponível', 'crm']);
    else if (clinic && clinic.funnel && clinic.funnel.status === 'error') items.push(['Funil do CRM indisponível', 'funnel']);
    if (clinic && clinic.commercial && clinic.commercial.status === 'error') items.push(['Valor comercial indisponível', 'commercial']);
    if (clinic && clinic.commercial && clinic.commercial.data && clinic.commercial.data.missing_price_count) items.push([clinic.commercial.data.missing_price_count + ' registro' + (clinic.commercial.data.missing_price_count === 1 ? '' : 's') + ' sem preço', 'commercial']);
    if (clinic && clinic.finance && clinic.finance.status === 'error') items.push(['Financeiro parcialmente indisponível', 'finance']);
    if (!igData().row) items.push(['Instagram sem vínculo ou indisponível', 'instagram']);
    if (graduation && !graduation.snapshot) items.push(['Graduação sem apuração', 'graduation']);
    return items.slice(0, 3);
  }
  function detailButton(id, label, secondary) {
    return '<button class="farol-detail-row" data-farol-detail="' + esc(id) + '"><span>' + text(label) + '</span><small>' + text(secondary) + '</small><b aria-hidden="true">›</b></button>';
  }
  function detailMetric(label, value) {
    return '<div class="farol-detail-metric"><span>' + text(label) + '</span><strong>' + text(value) + '</strong></div>';
  }
  function crmLink(path) {
    return '<p class="farol-modal-note">No Sistema Black, confira a clínica e o período selecionados. Esses filtros não são aplicados pelo link.</p>' +
      '<a class="farol-modal-link" href="https://sistema.oftalmoblack.com.br/' + path + '" target="_blank" rel="noopener">Abrir tela no Sistema Black ↗</a>';
  }
  function detailContent(id) {
    var bits = id.split(':'), kind = bits[0], data = clinicalData();
    var out = { title:'Detalhe', body:'', action:'' };
    if (kind === 'clinical') {
      var labels = { novos:'Novos leads', agendadas:'Agendadas', realizadas:'Realizadas', indicacoes:'Indicações', cirurgias:'Fechamentos' };
      out.title = labels[bits[1]] || 'Jornada clínica';
      out.body = '<div class="farol-detail-metrics">' + detailMetric('Neste período', number(data && data.periodo && data.periodo[bits[1]])) +
        detailMetric('Período anterior', number(data && data.anterior && data.anterior[bits[1]])) + '</div>' +
        '<p>Fluxo de pessoas que passaram por esta etapa na janela; “fechamentos” usa a etapa cirurgias do CRM. As etapas não formam uma taxa de conversão entre si.</p>' +
        '<p>Trilha de etapas desde ' + date(data && data.trilha_desde) + ' · conversas desde ' + date(data && data.dados_desde) + '.</p>';
      out.action = crmLink('metrics');
    } else if (kind === 'finance') {
      var f = clinic && clinic.finance, basis = bits[1] === 'received' ? 'received' : 'billed', r = f && f[basis];
      out.title = basis === 'billed' ? 'Faturado' : 'Recebido';
      out.body = '<div class="farol-detail-metrics">' + detailMetric('Neste período', moneyDetail(r && r.current && r.current.amount)) +
        detailMetric('Período anterior', moneyDetail(r && r.previous && r.previous.amount)) +
        detailMetric('Lançamentos', number(r && r.current && r.current.record_count)) + '</div>' +
        (r && r.current && r.current.record_count === 0 ? '<p class="farol-finance-warning">Sem lançamentos financeiros registrados nesta base e janela; este zero não confirma faturamento zero da clínica.</p>' : '') +
        '<p>' + (basis === 'billed' ? 'Cobranças líquidas por data do registro; canceladas e estornadas ficam fora.' : 'Pagamentos por data de recebimento, descontados os estornos registrados.') +
        ' Os dois totais representam populações diferentes e não devem ser subtraídos para calcular atraso.</p>' +
        (r && r.current && r.current.groups ? r.current.groups.map(function (g) {
          var label = { consultations:'Consultas', surgeries:'Cirurgias', exams:'Exames', other:'Outros' }[g.key] || g.key;
          return detailButton('financegroup:' + basis + ':' + g.key, label, moneyDetail(g.amount) + ' · ' + number(g.record_count) + ' lançamentos');
        }).join('') : '<p>Fonte financeira indisponível.</p>') +
        '<p class="farol-modal-note">Moedas diferentes de BRL: ' + number(r && r.other_currency_count) + '. Históricos sem vínculo financeiro, fora dos totais: ' + number(r && r.history_record_count) + '.</p>';
      out.action = crmLink('financeiro');
    } else if (kind === 'financegroup') {
      var basisGroup = bits[1], groupKey = bits[2], fin = clinic && clinic.finance && clinic.finance[basisGroup];
      var group = fin && fin.current && fin.current.groups && fin.current.groups.filter(function (g) { return g.key === groupKey; })[0];
      var prevGroup = fin && fin.previous && fin.previous.groups && fin.previous.groups.filter(function (g) { return g.key === groupKey; })[0];
      out.title = ({ consultations:'Consultas', surgeries:'Cirurgias', exams:'Exames', other:'Outros' })[groupKey] || 'Grupo financeiro';
      out.body = '<div class="farol-detail-metrics">' + detailMetric('Neste período', moneyDetail(group && group.amount)) +
        detailMetric('Período anterior', moneyDetail(prevGroup && prevGroup.amount)) +
        detailMetric('Lançamentos', number(group && group.record_count)) + '</div><p>Grupo agregado da base ' +
        (basisGroup === 'billed' ? 'faturado' : 'recebido') + '. Esta fonte não fornece registros individuais ao Farol.</p>';
      out.action = crmLink('financeiro');
    } else if (kind === 'commercial') {
      var c = clinic && clinic.commercial && clinic.commercial.data;
      out.title = 'Valor comercial';
      out.body = '<div class="farol-detail-metrics">' + detailMetric('Valor de catálogo', moneyDetail(c && c.total)) +
        detailMetric('Registros', number(c && c.count)) + detailMetric('Sem preço', number(c && c.missing_price_count)) + '</div>' +
        '<p>Consultas pela data de agendamento; exames e cirurgias pelo fechamento. É o valor de catálogo registrado, sem representar faturamento ou dinheiro recebido.</p>' +
        (c && c.groups ? c.groups.map(function (g) { return detailButton('commercialgroup:' + g.kind, g.kind, moneyDetail(g.amount) + ' · ' + number(g.count) + ' registros'); }).join('') : '<p>Fonte comercial indisponível.</p>');
      out.action = crmLink('metrics');
    } else if (kind === 'commercialgroup') {
      var groupC = clinic && clinic.commercial && clinic.commercial.data && clinic.commercial.data.groups.filter(function (g) { return g.kind === bits[1]; })[0];
      out.title = 'Comercial · ' + (bits[1] || 'grupo');
      out.body = '<div class="farol-detail-metrics">' + detailMetric('Valor', moneyDetail(groupC && groupC.amount)) +
        detailMetric('Registros', number(groupC && groupC.count)) + detailMetric('Sem preço', number(groupC && groupC.missing_price_count)) +
        '</div><p>Valor agregado. O Farol não recebe nomes de pacientes nem linhas individuais desta fonte.</p>';
      out.action = crmLink('metrics');
    } else if (kind === 'instagram') {
      var ig = igData(), rI = ig.row;
      out.title = 'Instagram';
      out.body = rI ? '<div class="farol-detail-metrics">' + detailMetric('Seguidores medidos', number(rI.seguidores)) +
        detailMetric('Ganhos brutos', number(ig.gains)) + detailMetric('Dias com coleta', ig.measured.length + ' de ' + days) + '</div>' +
        '<p>Ganhos vêm da soma dos dias medidos. Visualizações, alcance, interações e visitas são janelas de 7 dias do último retrato (' + date(rI.dia) + '). Não há curva reconstruída de seguidores.</p>' +
        ig.points.slice().reverse().map(function (p) { return detailButton('igday:' + p.dia, date(p.dia),
          'Ganhos ' + number(p.seguidores_ganhos) + ' · alcance diário ' + number(p.alcance_dia)); }).join('') : '<p>' + text(ig.error) + '.</p>';
      out.action = '<button class="farol-modal-link" data-farol-ig-open' + (rI ? '' : ' disabled') + '>Abrir histórico da conta ↗</button>';
    } else if (kind === 'igday') {
      var point = igData().points.filter(function (p) { return p.dia === bits[1]; })[0];
      out.title = 'Instagram · ' + date(bits[1]);
      out.body = point ? '<div class="farol-detail-metrics">' + detailMetric('Ganhos de seguidores', number(point.seguidores_ganhos)) +
        detailMetric('Alcance diário', number(point.alcance_dia)) + '</div><p>Valores reais da coleta deste dia. Campos sem coleta são exibidos como —.</p>' : '<p>Dia fora da série carregada.</p>';
      out.action = '<button class="farol-modal-link" data-farol-detail="instagram">Voltar à série do Instagram</button>';
    } else if (kind === 'delivery') {
      var arts = sources.artefatos(selected).filter(function (x) { return x.part.aceito; });
      if (bits[1] === 'blocked') arts = arts.filter(function (x) { return x.part.estado === 'travado'; });
      if (bits[1] === 'air') arts = arts.filter(function (x) { return C.NO_AR[x.part.estado]; });
      if (bits[1] === 'team') arts = arts.filter(function (x) { return !C.NO_AR[x.part.estado] && x.part.estado !== 'travado'; });
      out.title = 'Entregas' + (bits[1] ? ' · ' + ({ blocked:'travadas', air:'no ar', team:'com a equipe' }[bits[1]] || '') : '');
      out.body = '<p>Progresso médio dos artefatos aceitos, calculado com as regras da Progressão. Rotinas não entram no denominador do checklist.</p>' +
        (arts.length ? arts.map(function (x) { return detailButton('artifact:' + x.artifact.id, x.artifact.nome,
          C.rotuloPar(x.part) + ' · ' + (x.part.total ? x.part.feitas + '/' + x.part.total + ' etapas' : 'sem checklist')); }).join('') : '<p>Nenhum artefato nesta situação.</p>');
      out.action = '<button class="farol-modal-link" data-farol-progress>Abrir Progressão ↗</button>';
    } else if (kind === 'artifact') {
      var art = sources.artefatos(selected).filter(function (x) { return x.artifact.id === bits[1]; })[0];
      out.title = art ? art.artifact.nome : 'Artefato';
      out.body = art ? '<div class="farol-detail-metrics">' + detailMetric('Situação', C.rotuloPar(art.part)) +
        detailMetric('Etapas', art.part.feitas + '/' + art.part.total) + '</div><p>Checklist do par médico + artefato.</p>' +
        art.steps.map(function (s) { return '<div class="farol-detail-row farol-step"><span>' + text(s.titulo) + '</span><small>' +
          (s.feito ? 'Concluída' : 'Em aberto') + ' · ' + text(C.tipoEtapa(s)) + '</small></div>'; }).join('') +
        '<h3>Demandas relacionadas</h3>' + (art.demands.length ? art.demands.map(function (d) {
          return detailButton('demand:' + d.id, d.titulo, d.status || '—');
        }).join('') : '<p>Nenhuma demanda vinculada.</p>') : '<p>Artefato indisponível.</p>';
      out.action = '<button class="farol-modal-link" data-farol-progress>Abrir Progressão ↗</button>';
    } else if (kind === 'demand') {
      var dem = sources.demandas().filter(function (d) { return d.id === bits[1] && d.member_id === selected; })[0];
      out.title = dem ? dem.titulo : 'Demanda';
      out.body = dem ? '<div class="farol-detail-metrics">' + detailMetric('Situação', dem.status || '—') +
        detailMetric('Prazo', date(dem.vence_em)) + '</div><p>' + text(dem.descricao || 'Sem descrição') + '</p>' : '<p>Demanda indisponível.</p>';
      out.action = dem ? '<a class="farol-modal-link" href="/admin/#demandas/' + encodeURIComponent(dem.id) + '" target="_blank" rel="noopener">Abrir demanda em nova aba ↗</a>' : '';
    } else if (kind === 'graduation' || kind === 'presence' || kind === 'presenceperiod' || kind === 'criterion') {
      var snap = graduation && graduation.snapshot, mod = snap && C.graduacao.model(snap, periodId(snap));
      var pG = kind === 'presenceperiod' && snap ? (snap.periods || []).filter(function (p) { return p.id === bits[1]; })[0] : mod && mod.period;
      var att = pG && pG.attendance;
      var validAttendance = attendanceValid(att);
      var attLabel = validAttendance ? number(att.attended) + ' de ' + number(att.eligible) + ' encontros' : 'Sem apuração';
      var criterionLabels = { attendance:'Presença', followers:'Seguidores', videos:'Vídeos' };
      out.title = kind === 'presence' ? 'Presença' : kind === 'presenceperiod' ? 'Presença · ' + text(pG && pG.label || bits[1]) :
        kind === 'criterion' ? 'Critério · ' + (criterionLabels[bits[1]] || text(bits[1])) : 'Graduação';
      var sourceNote = '<p>' + (graduation && graduation.is_demo ? 'PRÉVIA · ' : '') + 'Fonte ' + date(graduation && graduation.source_date) +
        ' · ' + text(pG && pG.label || snap && periodId(snap)) + '.</p>';
      if (!snap) out.body = '<p>Sem apuração disponível.</p>';
      else if (kind === 'presence' || kind === 'presenceperiod') {
        out.body = sourceNote + '<div class="farol-detail-metrics">' + detailMetric('Presenças', attLabel) +
          detailMetric('Percentual', validAttendance ? Math.round(Number(att.attended) / Number(att.eligible) * 100) + '%' : '—') +
          detailMetric('Pontos na planilha', number(pG && pG.scores && pG.scores.attendance)) + '</div>' +
          (validAttendance ? '<div class="farol-progress"><i style="width:' + Math.max(0, Math.min(100, Number(att.attended) / Number(att.eligible) * 100)) + '%"></i></div>' : '') +
          '<p>Contagem agregada de encontros elegíveis e presenças. A planilha não traz a lista de reuniões; os pontos são os apurados na fonte.</p>' +
          (kind === 'presence' ? '<h3>Trimestres apurados</h3>' + (snap.periods || []).map(function (p) {
            return detailButton('presenceperiod:' + p.id, p.label || p.id,
              attendanceValid(p.attendance) ? number(p.attendance.attended) + ' de ' + number(p.attendance.eligible) + ' encontros' : 'Sem apuração');
          }).join('') : '');
      } else if (kind === 'criterion') {
        var criterion = bits[1], score = pG && pG.scores && pG.scores[criterion];
        var evidence = criterion === 'attendance' ? '<p>' + attLabel + (validAttendance ? ' · ' + Math.round(Number(att.attended) / Number(att.eligible) * 100) + '% de presença' : '') + '.</p>' :
          criterion === 'followers' ? '<p>Crescimento de seguidores na planilha: ' + number(pG && pG.followers && pG.followers.growth) + '. Esta apuração histórica é independente do retrato atual do Instagram.</p>' :
          criterion === 'videos' ? '<div class="farol-detail-metrics">' + detailMetric('Vídeos', number(pG && pG.videos && pG.videos.count)) +
            detailMetric('Créditos', number(pG && pG.videos && pG.videos.credits)) + detailMetric('Semanas', number(pG && pG.videos && pG.videos.weeks)) + '</div>' :
          '<p>Sem evidência detalhada disponível para este critério.</p>';
        out.body = sourceNote + '<div class="farol-detail-metrics">' + detailMetric('Pontos apurados', number(score)) + '</div>' + evidence +
          '<p>A pontuação é a registrada na planilha; o Farol não a recalcula.</p>';
      } else {
        out.body = sourceNote + '<div class="farol-detail-metrics">' + detailMetric('Pontos', mod.points == null ? '—' : number(mod.points) + ' / 50') +
          detailMetric('Grau atual', number(mod.grade) + 'º') + detailMetric('Presença', attLabel) + '</div>' +
          (pG && pG.scores ? Object.keys(pG.scores).map(function (key) {
            return detailButton('criterion:' + key, criterionLabels[key] || key, number(pG.scores[key]) + ' pontos');
          }).join('') : '<p>Critérios indisponíveis.</p>') +
          (pG && pG.referrals != null ? detailMetric('Indicações na planilha', number(pG.referrals)) : '') +
          (pG && pG.bonus != null ? detailMetric('Bônus na planilha', number(pG.bonus)) : '');
      }
      out.action = '<a class="farol-modal-link" href="/membros/?membro=' + encodeURIComponent(selected) + '#graduacao" target="_blank" rel="noopener">Abrir graduação em nova aba ↗</a>';
    } else if (kind === 'attention') {
      var target = bits[1];
      out.title = 'Atenção · ' + ({ demands:'demandas', progress:'entregas', instagram:'Instagram', graduation:'graduação', crm:'vínculo com CRM', funnel:'funil', commercial:'comercial', finance:'financeiro' })[target];
      var targetDetail = { progress:'delivery:blocked', instagram:'instagram', graduation:'graduation', funnel:'clinical:novos', commercial:'commercial', finance:'finance:billed' }[target];
      out.body = '<p>' + (target === 'crm' ? 'O vínculo ou a conexão da clínica não está disponível. Confira o cadastro do médico e tente novamente.' :
        'Fonte e registros relacionados a esta atenção.') + '</p>' +
        (target === 'demands' ? lateDemands().map(function (d) { return detailButton('demand:' + d.id, d.titulo, 'Venceu ' + date(d.vence_em)); }).join('') :
          targetDetail ? detailButton(targetDetail, 'Ver fonte relacionada', 'Abrir detalhe') : '');
      out.action = target === 'demands' ? '<button class="farol-modal-link" data-farol-demands>Abrir Demandas ↗</button>' :
        target === 'crm' || target === 'funnel' ? '<button class="farol-modal-link" data-farol-retry>Tentar novamente</button>' + crmLink('metrics') :
        target === 'finance' ? crmLink('financeiro') : '';
    }
    return out;
  }
  function drawModal() {
    if (!modalStack.length || !root) return;
    var id = modalStack[modalStack.length - 1], content = detailContent(id);
    var link = '#farol/' + encodeURIComponent(selected) + '?dias=' + days + '&detalhe=' + encodeURIComponent(id);
    root.insertAdjacentHTML('beforeend', '<div class="farol-modal-backdrop" data-farol-backdrop><div class="farol-modal" role="dialog" aria-modal="true" aria-label="' + text(content.title) + '">' +
      '<div class="farol-modal-top"><button data-farol-back' + (modalStack.length < 2 ? ' disabled' : '') + '>← Voltar</button><span>' + text(current() && current().nome) + ' · ' + days + ' dias</span><button data-farol-close aria-label="Fechar detalhe">×</button></div>' +
      '<h2>' + text(content.title) + '</h2><div class="farol-modal-scroll">' + content.body + content.action + '</div>' +
      '<div class="farol-modal-bottom"><a href="' + link + '" target="_blank" rel="noopener">Abrir este detalhe em nova aba ↗</a><button data-farol-close>Fechar</button></div></div></div>');
    var initialFocus = root.querySelector('.farol-modal [data-farol-close]');
    if (initialFocus) initialFocus.focus();
  }
  function openDetail(id) {
    if (!modalStack.length) modalReturnFocus = document.activeElement && document.activeElement.getAttribute('data-farol-detail');
    modalStack.push(id); hash(); render();
    var close = root.querySelector('[data-farol-close]'); if (close) close.focus();
  }
  function closeDetail(all) {
    if (all) modalStack = []; else modalStack.pop();
    hash(); render();
    if (modalStack.length) { var close = root.querySelector('[data-farol-close]'); if (close) close.focus(); }
    else {
      var prior = modalReturnFocus && Array.prototype.filter.call(root.querySelectorAll('[data-farol-detail]'), function (el) {
        return el.dataset.farolDetail === modalReturnFocus;
      })[0];
      if (!prior) prior = root.querySelector('[data-farol-member]');
      if (prior) prior.focus();
    }
  }
  function financeCell(label, key, currentValue, hint) {
    return '<button class="farol-finance-cell" data-farol-detail="' + key + '"><span class="farol-label">' + label + '</span><strong>' +
      (clinicLoading ? skel('58%', 'farol-skel-money') : moneyValue(currentValue)) + '</strong><small>' + (clinicLoading ? skel('74%') : text(hint)) + '</small></button>';
  }
  function foot() {
    var commercial = clinic && clinic.commercial && clinic.commercial.status === 'ready' ? clinic.commercial.data : null;
    var finance = clinic && clinic.finance;
    var billed = finance && finance.billed && finance.billed.current;
    var received = finance && finance.received && finance.received.current;
    var issues = attention();
    return '<div class="farol-foot"><div class="farol-finance' + (clinicLoading ? ' is-loading' : '') + '"' + (clinicLoading ? ' aria-busy="true"' : '') + '>' +
      financeCell('FATURADO · ' + days + ' DIAS', 'finance:billed', billed && billed.amount,
        billed ? billed.record_count === 0 ? 'Sem lançamentos financeiros registrados' : number(billed.record_count) + ' cobranças' : 'Financeiro indisponível') +
      financeCell('RECEBIDO · ' + days + ' DIAS', 'finance:received', received && received.amount,
        received ? received.record_count === 0 ? 'Sem lançamentos financeiros registrados' : number(received.record_count) + ' pagamentos / estornos' : 'Financeiro indisponível') +
      financeCell('VALOR COMERCIAL · ' + days + ' DIAS', 'commercial', commercial && commercial.total, commercial ? number(commercial.count) + ' registros comerciais' : 'CRM indisponível') + '</div>' +
      '<div class="farol-attention"><span class="farol-label">ATENÇÃO</span>' + (issues.length ? issues.map(function (i) {
        return '<button data-farol-detail="attention:' + i[1] + '">' + text(i[0]) + '<span aria-hidden="true">↗</span></button>';
      }).join('') : '<span class="farol-all-clear">Nenhuma atenção identificada nas fontes disponíveis</span>') + '</div></div>';
  }
  function render() {
    if (!root) return;
    var list = members(), m = current();
    if (!m) { root.innerHTML = '<div class="farol-empty">Nenhum médico ativo disponível.</div>'; return; }
    var position = list.indexOf(m), data = clinicalData();
    var source = clinicLoading ? null : clinic && clinic.status === 'unlinked' ? 'Clínica sem vínculo · CRM indisponível' : clinic && clinic.error ? clinic.error : clinic && clinic.clinic ? clinic.clinic.name : 'Clínica não informada';
    var windowLabel = clinic && clinic.period ? date(clinic.period.date_start || clinic.period.start) + '–' + date(clinic.period.date_end || clinic.period.end) : days + ' dias';
    var partial = data && clinic.period && ((data.trilha_desde && data.trilha_desde > clinic.period.start) || (data.dados_desde && data.dados_desde > clinic.period.start));
    root.innerHTML = '<div class="farol"><div class="farol-header"><div class="farol-heading"><span>VISÃO EXECUTIVA <i></i> FAROL</span><h1>' + text(m.nome) + '</h1><p>' + text(m.turma || 'Turma não informada') + ' <b>·</b> ' + (source === null ? '<span class="farol-loading-note"><i aria-hidden="true"></i>Carregando dados da clínica…</span>' : text(source)) + '</p></div>' +
      '<div class="farol-controls"><label class="farol-search">' + C.icon('search') + '<input type="search" data-farol-search placeholder="Buscar médico" aria-label="Buscar médico"></label>' +
      '<select data-farol-member aria-label="Selecionar médico">' + list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === selected ? ' selected' : '') + '>' + text(x.nome) + '</option>'; }).join('') + '</select>' +
      '<button data-farol-prev aria-label="Médico anterior"' + (!position ? ' disabled' : '') + '>‹</button><button data-farol-next aria-label="Próximo médico"' + (position === list.length - 1 ? ' disabled' : '') + '>›</button><button data-farol-retry aria-label="Atualizar Farol" title="Atualizar Farol">↻</button>' +
      '<div class="farol-days" aria-label="Período"><button data-farol-days="7" aria-pressed="' + (days === 7) + '">7 dias</button><button data-farol-days="30" aria-pressed="' + (days === 30) + '">30 dias</button></div></div></div>' +
      '<div class="farol-period"><span>' + text(windowLabel) + '</span>' + (partial ? '<b>Dados parciais desde ' + date(data.trilha_desde || data.dados_desde) + '</b>' : '') + (clinic && clinic.updated_at ? '<span>Atualizado ' + text(date(clinic.updated_at)) + '</span>' : '') + '</div>' +
      '<div class="farol-funnel' + (clinicLoading ? ' is-loading' : '') + '"' + (clinicLoading ? ' aria-busy="true"' : '') + '><div class="farol-section-title"><span>JORNADA CLÍNICA</span><small>Movimentos do período · CRM</small></div><div class="farol-kpis">' +
      [['Novos leads','novos'],['Agendadas','agendadas'],['Realizadas','realizadas'],['Indicações','indicacoes'],['Fechamentos','cirurgias']].map(function (x) { return clinicalCard(x[0], x[1]); }).join('') + '</div></div>' +
      '<div class="farol-cards">' + instagramCard() + deliveryCard() + graduationCard() + '</div>' + foot() +
      '<div class="farol-footer"><span>Fontes independentes · ausências exibidas como —</span><a href="https://sistema.oftalmoblack.com.br/metrics" target="_blank" rel="noopener">Abrir métricas no CRM ↗</a></div></div>';
    drawModal();
  }
  function load() {
    var version = ++request, id = selected, d = days;
    clinic = null; graduation = null; clinicLoading = true; graduationLoading = true; render();
    C.sb.functions.invoke('farol-metricas', { body:{ member_id:id, days:d } }).then(function (res) {
      if (version !== request) return;
      if (res.error) throw res.error;
      clinic = res.data; clinicLoading = false; render();
    }).catch(function (err) {
      if (version !== request) return;
      clinic = { error:err.message || 'CRM indisponível' }; clinicLoading = false; render();
    });
    C.sb.from('member_graduations').select('member_id,source_date,is_demo,snapshot').eq('member_id', id).maybeSingle().then(function (res) {
      if (version !== request) return;
      if (res.error) throw res.error;
      graduation = res.data || {}; graduationLoading = false; render();
    }).catch(function () {
      if (version !== request) return;
      graduation = { error:'Graduação indisponível' }; graduationLoading = false; render();
    });
  }
  function change(id, d) {
    if (!members().some(function (m) { return m.id === id; })) return;
    var changedMember = id !== selected;
    var changedDays = d !== days;
    selected = id; days = d;
    if (changedMember || changedDays) modalStack = [];
    save(); hash();
    if (changedMember || changedDays) load();
    else render();
  }
  function enter(h) {
    if (!root) return;
    var p = parseHash(h), pref = saved(), list = members();
    var id = p.memberId && list.some(function (m) { return m.id === p.memberId; }) ? p.memberId :
      selected || (pref.memberId && list.some(function (m) { return m.id === pref.memberId; }) ? pref.memberId : '') || (list[0] && list[0].id);
    var d = p.days || (pref.days === 7 ? 7 : 30);
    if (!id) { render(); return; }
    modalStack = p.detail ? [p.detail] : [];
    if (id !== selected || d !== days) { selected = id; days = d; save(); hash(); load(); }
    else { hash(); render(); }
  }
  function refresh() { if (root && selected) render(); }
  function mount(el, callbacks) {
    root = el; sources = callbacks;
    root.addEventListener('click', function (event) {
      if (event.target.hasAttribute('data-farol-backdrop')) { closeDetail(true); return; }
      var t = event.target.closest('button');
      if (!t && !event.target.closest('a')) {
        var card = event.target.closest('[data-farol-card]');
        if (card) { openDetail(card.dataset.farolCard); return; }
      }
      if (!t) return;
      if (t.hasAttribute('data-farol-close')) { closeDetail(true); return; }
      if (t.hasAttribute('data-farol-back')) { if (modalStack.length > 1) closeDetail(false); return; }
      if (t.hasAttribute('data-farol-retry')) { load(); return; }
      if (t.dataset.farolDetail) { openDetail(t.dataset.farolDetail); return; }
      if (t.dataset.farolDays) { change(selected, Number(t.dataset.farolDays)); return; }
      var list = members(), pos = list.findIndex(function (m) { return m.id === selected; });
      if (t.hasAttribute('data-farol-prev') && pos > 0) { change(list[pos - 1].id, days); return; }
      if (t.hasAttribute('data-farol-next') && pos < list.length - 1) { change(list[pos + 1].id, days); return; }
      if (t.hasAttribute('data-farol-ig-open')) { var ig = igData(); if (ig.row) { closeDetail(true); sources.abrirInstagram(ig.row.username); } return; }
      if (t.hasAttribute('data-farol-progress')) { closeDetail(true); sources.abrirProgressao(selected); return; }
      if (t.hasAttribute('data-farol-demands')) { closeDetail(true); sources.abrirDemandas(selected); return; }
      if (t.dataset.farolAttention === 'demands') sources.abrirDemandas(selected);
      if (t.dataset.farolAttention === 'progress') sources.abrirProgressao(selected);
      if (t.dataset.farolAttention === 'instagram') { var row = igData().row; if (row) sources.abrirInstagram(row.username); }
      if (t.dataset.farolAttention === 'graduation') window.open('/membros/?membro=' + encodeURIComponent(selected) + '#graduacao', '_blank', 'noopener');
      if (t.dataset.farolAttention === 'crm') window.open('https://sistema.oftalmoblack.com.br/metrics', '_blank', 'noopener');
    });
    root.addEventListener('change', function (event) {
      if (event.target.matches('[data-farol-member]')) change(event.target.value, days);
    });
    root.addEventListener('input', function (event) {
      if (!event.target.matches('[data-farol-search]')) return;
      var term = event.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      var select = root.querySelector('[data-farol-member]');
      Array.prototype.forEach.call(select.options, function (option) {
        var name = option.text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        option.hidden = name.indexOf(term) === -1 && option.value !== selected;
      });
    });
    root.addEventListener('keydown', function (event) {
      if (!modalStack.length) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDetail(true); return; }
      if (event.key !== 'Tab') return;
      var modal = root.querySelector('.farol-modal');
      var focusable = modal && modal.querySelectorAll('a[href],button:not([disabled]),select,input');
      if (!focusable || !focusable.length) return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  C.farol = { mount:mount, enter:enter, refresh:refresh };
})();
