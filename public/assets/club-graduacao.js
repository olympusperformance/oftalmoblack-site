/* Graduação Black: prévia da planilha. Dados individuais vêm do banco com RLS. */
(function () {
  'use strict';
  var C = window.Club = window.Club || {};
  var META = 50;
  var esc = C.esc;
  var statusLabels = { ready:'Meta atingida', near:'Reta final', progress:'Em progresso', starting:'Acompanhar', missing:'Sem apuração', future:'Ainda não começou' };
  var periods = [
    { id:'2026-T2', label:'Abr–jun 2026' }, { id:'2026-T3', label:'Jul–set 2026' },
    { id:'2026-T4', label:'Out–dez 2026' }, { id:'2027-T1', label:'Jan–mar 2027' }
  ];
  function fmt(n) { return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits:1 }); }
  function money(n) { return Number(n || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 }); }
  function round(n) { return Math.round((n + Number.EPSILON) * 10) / 10; }
  function scoreStatus(points) { return points == null ? 'missing' : points >= 50 ? 'ready' : points >= 35 ? 'near' : points >= 20 ? 'progress' : 'starting'; }
  function beltName(grade) {
    return grade === 10 ? 'Faixa dourada' : grade === 9 ? 'Faixa vermelha' : grade === 8 ? 'Coral vermelha e branca' : grade === 7 ? 'Coral vermelha e preta' : 'Faixa preta';
  }
  function degreeLabel(grade) { return grade ? grade + 'º grau' : 'Sem grau'; }
  function model(snapshot, periodId) {
    var s = snapshot || {};
    var p = (s.periods || []).filter(function (q) { return q.id === periodId; })[0];
    var grade = Math.max(0, Math.min(10, Number(s.grade) || 0));
    var points = p && p.state !== 'future' ? p.points : null;
    return { snapshot:s, period:p, grade:grade, points:points,
      missing:points == null ? null : Math.max(0, round(META - points)),
      percent:points == null ? 0 : Math.max(0, Math.min(100, points / META * 100)),
      status:p && p.state === 'future' ? 'future' : scoreStatus(points) };
  }
  function belt(grade, compact) {
    var stripes = grade <= 6 ? grade : 0;
    return '<div class="gr-belt' + (compact ? ' gr-belt-small' : '') + ' gr-belt-' + grade + '" role="img" aria-label="' + esc(beltName(grade) + ', ' + degreeLabel(grade)) + '">' +
      '<span class="gr-belt-weave"></span><span class="gr-belt-brand">BLACK</span><span class="gr-belt-rank">' +
      Array.from({ length:stripes }, function () { return '<i></i>'; }).join('') + '</span></div>';
  }
  function progress(percent, label) {
    return '<div class="gr-track" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + round(percent) + '"><span style="width:' + percent + '%"></span></div>';
  }
  function badge(status) { return '<span class="gr-status gr-status-' + status + '">' + statusLabels[status] + '</span>'; }
  function periodSelect(id) {
    return '<label class="gr-period">Trimestre<select class="inp" data-gr-period>' + periods.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === id ? ' selected' : '') + '>' + p.label + '</option>';
    }).join('') + '</select></label>';
  }
  function top(id) {
    return '<div class="gr-toolbar"><p class="gr-demo"><span></span>Prévia da graduação <small>Dados da planilha de 10/09/2026 · sem atualização automática</small></p>' + periodSelect(id) + '</div>';
  }
  function journey(grade) {
    var labels = ['Preta','Preta','Preta','Preta','Preta','Preta','Coral','Coral','Vermelha','Dourada'];
    return '<section class="gr-journey"><div class="gr-section-head"><div><h2>Um grau de cada vez</h2><p>Os pontos renovam a cada ciclo. Sua graduação fica com você.</p></div></div>' +
      '<ol class="gr-degrees">' + labels.map(function (label, i) {
        return '<li class="gr-degree gr-degree-' + (i + 1) + (i < grade ? ' is-earned' : '') + '"><span>' + (i + 1) + 'º</span><b>' + label + '</b><small>' +
          (i < grade ? 'Na sua faixa' : i === 6 ? '+ 2 anos' : i === 7 ? '+ 3 anos' : i === 8 ? '+ 4 anos' : i === 9 ? 'Dr. Alex' : '50 pts / tri') + '</small></li>';
      }).join('') + '</ol><p class="gr-caption">Até o 6º grau: no máximo um grau por trimestre. O 7º, 8º e 9º também exigem tempo de Black. A faixa dourada é conferida pelo Dr. Alex.</p></section>';
  }
  function criterion(icon, name, points, description, action, note) {
    var known = points != null;
    return '<article class="gr-criterion"><div class="gr-criterion-head"><span class="gr-icon">' + C.icon(icon) + '</span><h3>' + name + '</h3><div class="gr-criterion-score">' + (known ? fmt(points) : '—') + '<small>' + (name === 'Indicações' ? ' pts' : ' / 20 pts') + '</small></div></div>' +
      '<p class="gr-criterion-data">' + esc(description) + '</p>' + (name !== 'Indicações' ? progress(known ? Math.min(100, points / 20 * 100) : 0, name) : '') +
      '<p class="gr-action">' + C.icon(known && points >= 20 && name !== 'Indicações' ? 'check-circle' : 'chevron-right') + '<span>' + esc(action) + '</span></p>' +
      (note ? '<small class="gr-caption">' + esc(note) + '</small>' : '') + '</article>';
  }
  function criteria(p) {
    var scores = p.scores || {}, a = p.attendance || {}, f = p.followers || {}, v = p.videos || {};
    var attendance = a.eligible ? fmt(a.attended) + ' de ' + fmt(a.eligible) + ' encontros registrados' : 'Presença ainda não apurada';
    var followerGoal = (f.growth || 0) < 2500 ? 2500 : 5000;
    var followerAction = scores.followers >= 20 ? 'Você já atingiu o teto deste critério.' : f.growth == null ? 'Aguarde a apuração do crescimento no trimestre.' :
      'Mais ' + fmt(Math.max(0, followerGoal - f.growth)) + ' seguidores para chegar a ' + (followerGoal === 2500 ? '10' : '20') + ' pontos.';
    return '<div class="gr-section-head"><div><h2>De onde vêm seus pontos</h2><p>Você pode combinar os critérios para chegar aos 50 pontos.</p></div></div><div class="gr-criteria">' +
      criterion('calendar', 'Presença', scores.attendance, attendance,
        scores.attendance >= 20 ? 'Teto atingido. Continue participando dos encontros.' : 'Participe dos encontros e confirme sua presença com a equipe.',
        'Presenças ÷ encontros elegíveis × 20. Conta a partir da sua entrada.') +
      criterion('users', 'Seguidores', scores.followers, f.growth == null ? 'Crescimento ainda não apurado' : (f.growth >= 0 ? '+' : '') + fmt(f.growth) + ' seguidores no trimestre', followerAction,
        '+2.500 = 10 pontos. +5.000 = 20 pontos. Vale o crescimento, não o total do perfil.') +
      criterion('play', 'Vídeos', scores.videos, v.count == null ? 'Publicações ainda não apuradas' : fmt(v.count) + ' vídeos · ' + fmt(v.credits) + ' créditos de semana',
        scores.videos >= 20 ? 'Você atingiu o teto de constância deste período.' : 'Publique 3 vídeos por semana, mantendo a constância.',
        'Cada semana vale até 1 crédito. Muitos vídeos de uma vez não compensam semanas sem postar.') +
      criterion('users', 'Indicações', p.referrals == null ? null : p.referrals * 50,
        p.referrals == null ? 'Indicações ainda não apuradas' : fmt(p.referrals) + ' indicações convertidas',
        'Cada indicação que fecha no Grau Zero ou Black vale 50 pontos + 1 voucher.',
        'Sem limite de pontos. A equipe confirma a conversão.') + '</div>' +
      (p.bonus ? '<div class="gr-bonus">' + C.icon('award') + '<div><b>+' + fmt(p.bonus) + ' pontos de bônus</b><p>' + esc(p.bonusReason || 'Reconhecimento registrado na planilha') + '</p></div><small>Já incluídos no total do trimestre</small></div>' : '');
  }
  function rules() {
    return '<details class="gr-details"><summary>Como funciona a graduação</summary><div class="gr-rules">' +
      '<p><b>50 pontos = um grau.</b> A meta vale para cada trimestre do calendário: jan–mar, abr–jun, jul–set e out–dez. Mesmo com mais de 100 pontos, você ganha no máximo um grau naquele trimestre.</p>' +
      '<p><b>Sua faixa é permanente.</b> Todos começam na faixa preta lisa. Os graus conquistados não são perdidos quando os pontos zeram na renovação anual.</p>' +
      '<p><b>Entrou no meio do trimestre?</b> A presença e a constância dos vídeos consideram a sua janela de participação. A meta para o grau continua sendo 50 pontos.</p>' +
      '<p><b>Bônus.</b> Pontos concedidos pelo Dr. Alex entram no trimestre. Palestras antigas já pontuadas foram mantidas; a partir de out–dez/2026, palestrar é um benefício, sem pontuação automática.</p>' +
      '<p><b>Esta é uma prévia.</b> Os valores reproduzem a planilha enviada. Datas de entrega dos graus ainda precisam ser registradas pela equipe.</p></div></details>';
  }
  function benefits(s) {
    return '<details class="gr-details"><summary>Seus pontos no ciclo e benefícios</summary><div class="gr-rules"><div class="gr-benefits">' +
      '<div><small>Pontuação para renovação na planilha</small><b>' + fmt(s.annualPoints) + ' pts</b></div>' +
      '<div><small>Desconto previsto na renovação</small><b>' + money(s.renewalDiscount) + '</b></div>' +
      '<div><small>Vouchers registrados</small><b>' + fmt(s.vouchers) + '</b></div></div>' +
      '<p>A Vitrine abre no fim do trimestre para quem atingiu 50 pontos ou tem voucher. Os benefícios dependem de disponibilidade; quem tem voucher escolhe primeiro.</p>' +
      '<p>Na renovação, 100 pontos dão R$ 15 mil de desconto; 150 dão R$ 25 mil; 200 dão R$ 35 mil; 250 dão R$ 45 mil; 300 dão R$ 55 mil; e 350 dão R$ 60 mil. Valores de prévia, conforme o painel da planilha.</p></div></details>';
  }
  function renderMember(root, record, id) {
    var s = record && record.snapshot;
    if (!s) {
      root.innerHTML = '<div class="gr-empty">' + C.icon('award') + '<h2>Sua graduação começa aqui</h2><p>A equipe ainda não incluiu sua pontuação nesta prévia. Assim que ela for apurada, você verá sua faixa e os próximos passos.</p></div>' + rules();
      return;
    }
    var m = model(s, id), ready = m.status === 'ready', future = m.status === 'future';
    var nextDegree = Math.min(10, m.grade + 1);
    var headline = ready ? 'Meta do trimestre atingida' : future ? 'Um novo trimestre pela frente' : 'Faltam ' + fmt(m.missing) + ' pontos';
    var sub = ready ? 'Este trimestre já conta para a graduação mostrada ao lado. A entrega do grau será confirmada pela equipe.' :
      future ? 'A apuração deste período ainda não começou. Sua graduação conquistada permanece.' :
      'para buscar o ' + nextDegree + 'º grau na sua faixa.';
    root.innerHTML = top(id) + '<section class="gr-hero"><div class="gr-belt-panel"><span class="gr-eyebrow">SUA GRADUAÇÃO</span>' + belt(m.grade) +
      '<h2>' + beltName(m.grade) + '</h2><p class="gr-grade-name">' + (m.grade ? degreeLabel(m.grade) : 'O primeiro grau começa aqui') + '</p>' +
      '<p class="gr-caption">Graduação da planilha' + (s.recordedDegrees < m.grade ? ' · entrega sem data registrada' : '') + '</p></div>' +
      '<div class="gr-progress-panel"><div class="gr-progress-top"><span class="gr-eyebrow">' + esc(m.period ? m.period.label : '') + '</span>' + badge(m.status) + '</div>' +
      '<div class="gr-big-points">' + (m.points == null ? '—' : fmt(m.points)) + '<span> / 50 <small>pontos</small></span></div>' + progress(m.percent, 'Meta de pontos do trimestre') +
      '<h2>' + headline + '</h2><p>' + sub + '</p><div class="gr-hero-foot">' + C.icon('award') + '<span>Um trimestre. Uma oportunidade de ganhar um grau.</span></div></div></section>' +
      (!future && m.period ? criteria(m.period) : '<p class="gr-future-note">Selecione jul–set/2026 para ver os pontos e próximos passos da prévia atual.</p>') +
      journey(m.grade) + benefits(s) + rules();
    root.onchange = function (event) {
      if (!event.target.matches('[data-gr-period]')) return;
      renderMember(root, record, event.target.value);
      root.querySelector('[data-gr-period]').focus();
    };
  }
  function renderAdmin(root, records, members, state) {
    var byId = {};
    records.forEach(function (r) { byId[r.member_id] = r; });
    var rows = members.filter(function (m) { return m.ativo !== false; }).map(function (member) {
      return { member:member, record:byId[member.id], model:model(byId[member.id] && byId[member.id].snapshot, state.period) };
    });
    var counts = {};
    rows.forEach(function (r) { counts[r.model.status] = (counts[r.model.status] || 0) + 1; });
    root.innerHTML = top(state.period) + '<div class="gr-radar">' + [
      ['ready','Podem graduar','50 pontos ou mais'],['near','Na reta final','De 35 a 49,9 pontos'],
      ['progress','Em progresso','De 20 a 34,9 pontos'],['starting','Acompanhar','Abaixo de 20 pontos']
    ].map(function (item) {
      return '<button class="gr-radar-card gr-radar-' + item[0] + '" data-gr-status="' + item[0] + '" aria-pressed="' + (state.status === item[0]) + '"><span>' + item[1] + '</span><b>' + (counts[item[0]] || 0) + '</b><small>' + item[2] + '</small></button>';
    }).join('') + '</div><div class="gr-list-toolbar"><label class="gr-search">' + C.icon('search') + '<input class="inp" type="search" data-gr-search placeholder="Buscar mentorado" aria-label="Buscar mentorado" value="' + esc(state.search) + '"></label><button class="btn btn-sm" data-gr-all>Ver todos</button><span class="gr-caption" data-gr-count></span></div><div data-gr-table></div>' +
      '<p class="gr-caption">A meta libera no máximo um grau por trimestre. O grau atual segue o painel da planilha; a data de entrega ainda precisa ser registrada.</p>';
    function table() {
      var term = state.search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      var shown = rows.filter(function (r) {
        return (state.status === 'all' || r.model.status === state.status) && r.member.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().indexOf(term) !== -1;
      }).sort(function (a, b) { return (b.model.points == null ? -1 : b.model.points) - (a.model.points == null ? -1 : a.model.points) || a.member.nome.localeCompare(b.member.nome, 'pt-BR'); });
      root.querySelector('[data-gr-count]').textContent = shown.length + ' mentorados';
      root.querySelector('[data-gr-table]').innerHTML = shown.length ? '<div class="gr-table-wrap"><table class="gr-table"><thead><tr><th>Mentorado / graduação</th><th>Pontos no trimestre</th><th>Faltam para 50</th><th>Situação</th><th><span class="gr-sr-only">Abrir graduação</span></th></tr></thead><tbody>' + shown.map(function (r) {
        var m = r.model;
        return '<tr><td><b>' + esc(r.member.nome) + '</b><small>' + (r.record ? esc(beltName(m.grade) + ' · ' + degreeLabel(m.grade)) : 'Aguardando apuração') + '</small></td><td><strong>' + (m.points == null ? '—' : fmt(m.points) + ' pts') + '</strong>' + progress(m.percent, 'Meta de ' + r.member.nome) + '</td><td>' + (m.missing == null ? '—' : fmt(m.missing) + ' pts') + '</td><td>' + badge(m.status) + '</td><td><a class="btn btn-sm" href="/membros/?membro=' + encodeURIComponent(r.member.id) + '#graduacao">Ver graduação ' + C.icon('chevron-right') + '</a></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="gr-empty"><p>Nenhum mentorado neste filtro.</p></div>';
    }
    table();
    root.oninput = function (event) { if (event.target.matches('[data-gr-search]')) { state.search = event.target.value; table(); } };
    root.onchange = function (event) {
      if (event.target.matches('[data-gr-period]')) { state.period = event.target.value; state.status = 'all'; renderAdmin(root, records, members, state); root.querySelector('[data-gr-period]').focus(); }
    };
    root.onclick = function (event) {
      var filter = event.target.closest('[data-gr-status]'), all = event.target.closest('[data-gr-all]');
      if (!filter && !all) return;
      state.status = all || state.status === filter.dataset.grStatus ? 'all' : filter.dataset.grStatus;
      renderAdmin(root, records, members, state);
      var focus = root.querySelector(all ? '[data-gr-all]' : '[data-gr-status="' + filter.dataset.grStatus + '"]');
      if (focus) focus.focus();
    };
  }
  function load(root, member, members) {
    var requestId = String(Date.now()) + Math.random();
    root.dataset.grRequest = requestId;
    root.innerHTML = '<p class="gr-loading" role="status">Carregando sua graduação…</p>';
    var query = C.sb.from('member_graduations').select('member_id,source_date,is_demo,snapshot');
    if (member) query = query.eq('member_id', member.id);
    return query.then(function (result) {
      if (result.error) throw new Error(result.error.message);
      if (root.dataset.grRequest !== requestId) return;
      if (member) renderMember(root, (result.data || [])[0], '2026-T3');
      else renderAdmin(root, result.data || [], members, { period:'2026-T3', status:'all', search:'' });
    }).catch(function () {
      if (root.dataset.grRequest !== requestId) return;
      root.innerHTML = '<div class="gr-empty"><h2>Não foi possível carregar a graduação</h2><p>Tente novamente em instantes.</p><button class="btn" data-gr-retry>Tentar novamente</button></div>';
      root.onclick = function (event) { if (event.target.closest('[data-gr-retry]')) load(root, member, members); };
    });
  }
  C.graduacao = { model:model, status:scoreStatus, beltName:beltName,
    mountMember:function (root, member) { return load(root, member); },
    mountAdmin:function (root, members) { return load(root, null, members); },
    renderMember:renderMember, renderAdmin:renderAdmin };
})();
