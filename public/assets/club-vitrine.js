/* Rodadas fechadas e respostas da Vitrine. Preferência não confirma benefício. */
(function(root){
 'use strict';
 var names={catarata:'Catarata',grau_zero:'Mentoria Grau Zero',passagem:'Passagem'};
 var statuses={received:'Resposta recebida',incomplete:'Resposta incompleta',postponed:'Pediu adiamento',declined:'Não vai usar',missing:'Sem resposta'};
 function label(period){var m=/^(\d{4})-T([1-4])$/.exec(period||'');return m?'T'+m[2]+'/'+m[1]:period;}
 function dates(value){return value?value.slice(0,10).split('-').reverse().join('/'):'A definir';}
 function points(value){return value==null?'Não apurado':Number(value).toLocaleString('pt-BR',{maximumFractionDigits:2})+' pts';}
 function compare(a,b){return Number(b.quarter_vouchers>0)-Number(a.quarter_vouchers>0)||(b.period_points==null?-1:b.period_points)-(a.period_points==null?-1:a.period_points);}
 function award(round,memberId){return ((round&&round.results)||[]).find(function(r){return r.member_id===memberId;});}
 function awardText(a){return a?names[a.benefit]+' · '+(a.offer||'data a confirmar'):'Sem benefício nesta rodada';}
 function results(round,esc){
  var rs=round.results||[];if(!rs.length)return '';
  var offers=round.offers||[];
  return '<div class="cb-section cb-vitrine-heading"><h2>Resultado</h2><span class="cb-note">Quem ganha o quê nesta rodada, pela ordem de pontos e pelas prioridades escolhidas.</span></div><div class="cb-vit-grid cb-vit-result">'+['catarata','grau_zero','passagem'].map(function(key){
   var won=rs.filter(function(r){return r.benefit===key;}),slots=offers.filter(function(o){return o.benefit===key;}).map(function(o){return {label:o.label,meta:(o.dates||'Data a definir')+(o.venue?' · '+o.venue:''),people:won.filter(function(r){return r.offer===o.label;})};});
   var loose=won.filter(function(r){return !slots.some(function(o){return o.label===r.offer;});});
   if(loose.length)slots.push({label:'Data a confirmar',meta:'Mês definido com a equipe',people:loose});
   var body=slots.map(function(o){return '<li><span><b>'+esc(o.label)+'</b><small>'+esc(o.meta)+'</small></span><span class="cb-vit-winners">'+(o.people.length?o.people.map(function(r){return '<b>'+esc(r.name)+'</b>'+(r.note?'<small>'+esc(r.note)+'</small>':'');}).join(''):'<small>Sem ganhador</small>')+'</span></li>';}).join('');
   return '<article class="cb-vit-card"><div class="cb-vit-top"><h3>'+names[key]+'</h3><span class="cb-vit-tag">'+won.length+' contemplado'+(won.length===1?'':'s')+'</span></div><ul class="cb-vit-slots">'+body+'</ul></article>';
  }).join('')+'</div>';
 }
 function choosePeriod(rounds,current){return rounds.some(function(r){return r.period===current;})?current:(rounds.filter(function(r){return r.status==='distributing';}).sort(function(a,b){return b.period.localeCompare(a.period);})[0]||rounds.slice().sort(function(a,b){return b.period.localeCompare(a.period);})[0]||{}).period;}
 function render(ctx){
  var C=root.Club,esc=C.esc,round=ctx.rounds.find(function(r){return r.period===ctx.period;});
  var header='<div class="cb-vit-head"><span class="cb-kicker">Benefícios do Club</span><h1>Vitrine Black</h1><p>O trimestre fecha, a Vitrine abre e as escolhas são distribuídas com os pontos e vouchers daquela rodada.</p></div>';
  if(ctx.error)return header+'<div class="cb-notice" role="alert">Não foi possível carregar a Vitrine. <button class="btn" data-cb-reload>Tentar novamente</button></div>';
  if(!round)return header+'<div class="cb-empty">Nenhuma rodada cadastrada.</div>';
  var scheduled=round.status==='scheduled',closed=round.status==='closed',rs=ctx.preferences.filter(function(p){return p.period===round.period;});
  var own=rs.find(function(p){return p.member_id===ctx.member.id;});
  var memberControl=ctx.admin?'<label>Mentorado<select class="inp" data-cb-member>'+ctx.members.filter(function(m){return m.ativo!==false;}).map(function(m){return '<option value="'+esc(m.id)+'"'+(m.id===ctx.member.id?' selected':'')+'>'+esc(m.nome)+'</option>';}).join('')+'</select></label>':'';
  var controls='<div class="cb-tools">'+memberControl+'<label>Vitrine do trimestre<select class="inp" data-cb-vitrine-period>'+ctx.rounds.slice().sort(function(a,b){return a.period.localeCompare(b.period);}).map(function(r){return '<option value="'+esc(r.period)+'"'+(r.period===round.period?' selected':'')+'>'+label(r.period)+' · '+({scheduled:'Abre em '+dates(r.opens_on),distributing:'Em distribuição',closed:'Distribuição encerrada'}[r.status])+'</option>';}).join('')+'</select></label><button class="btn" data-cb-reload>Atualizar</button></div>';
  var banner='<div class="cb-vit-elig"><span class="cb-kicker">'+label(round.period)+'</span><b>'+(scheduled?'Trimestre em andamento':closed?'Distribuição encerrada':round.responses_closed_at?'Respostas encerradas em '+dates(round.responses_closed_at):'Trimestre fechado · Em distribuição')+'</b><span class="cb-vit-open">'+(scheduled?'Abertura em <b>'+dates(round.opens_on)+'</b>':'Pontos e vouchers de '+['janeiro a março','abril a junho','julho a setembro','outubro a dezembro'][Number(round.period.slice(-1))-1])+'</span></div>';
  var intro=scheduled?'<p class="cb-note">Esta Vitrine ainda não abriu e está com zero vagas. Os benefícios serão liberados no fechamento do trimestre. A distribuição do trimestre passado continua na rodada anterior.</p>':'<p class="cb-note">Prioridade: voucher por indicação deste trimestre e, depois, pontos do trimestre. O acumulado serve somente para desconto na renovação.</p>';
  var offers=round.offers||[],total=offers.reduce(function(n,o){return n+(scheduled||closed?0:o.available);},0);
  var cards='<div class="cb-vit-grid">'+['catarata','grau_zero','passagem'].map(function(key){
   var group=offers.filter(function(o){return o.benefit===key;}),count=scheduled||closed?0:group.reduce(function(n,o){return n+o.available;},0);
   var body=scheduled?'Vagas a definir no fechamento do trimestre.':group.map(function(o){return '<li><span><b>'+esc(o.label)+'</b><small>'+esc(o.dates||'Data a definir')+(o.venue?' · '+esc(o.venue):'')+'</small></span><strong>'+Number(closed?0:o.available)+' '+(key==='passagem'?'passagem':'vagas')+'</strong></li>';}).join('');
   return '<article class="cb-vit-card"><div class="cb-vit-top"><h3>'+names[key]+'</h3><span class="cb-vit-tag">'+count+' '+(key==='passagem'?'passagem':'vagas')+'</span></div>'+(scheduled?'<p>'+body+'</p>':'<ul class="cb-vit-slots">'+body+'</ul>')+'<small>'+(scheduled?'Disponibilidade a definir para esta Vitrine.':key==='passagem'?'Benefício inclui somente a passagem.':key==='grau_zero'?'Espectador: teoria e prática acompanhada, sem operar.':'Duas vagas por turma nesta rodada.')+'</small><button class="btn" data-cb-vitrine-offer="'+key+'">Ver detalhes</button></article>';
  }).join('')+'</div>';
  var selected='<div class="cb-section cb-vitrine-heading"><h2>'+(ctx.admin?'Escolhas de '+esc(ctx.member.nome):'Minhas escolhas')+'</h2></div>';
  if(own)selected+='<div class="cb-vit-response"><div class="cb-vit-response-top"><b>'+statuses[own.response_status]+'</b><span>'+points(own.period_points)+' · '+(own.conferred_grade?own.conferred_grade+'º grau':'Sem grau')+' · '+own.quarter_vouchers+' voucher(s) do trimestre</span></div>'+((round.results||[]).length?'<p class="cb-vit-award">Resultado: <b>'+esc(awardText(award(round,own.member_id)))+'</b></p>':'')+'<p>'+(own.benefits.length?own.benefits.map(function(b,i){return (i+1)+'ª '+names[b];}).join(' → '):'Nenhuma preferência registrada.')+'</p><p class="cb-note">'+(own.pending_items.length?esc(own.pending_items.join(' · ')):'A escolha será confirmada pela equipe após a distribuição.')+'</p><button class="btn" data-cb-vitrine-choice="'+esc(own.id)+'">Ver resposta</button></div>';
  else selected+='<div class="cb-empty">'+(scheduled?'As escolhas desta rodada serão abertas no fim do trimestre.':'Nenhuma resposta registrada para este mentorado nesta rodada.')+'</div>';
  var team='';
  if(ctx.admin&&!scheduled){
   var answered=rs.filter(function(p){return p.response_status!=='missing';}).length,missing=rs.filter(function(p){return p.response_status==='missing';}).length;
   team='<div class="cb-section cb-vitrine-heading"><h2>Respostas da rodada</h2><span class="cb-note">'+answered+' responderam · '+missing+' sem resposta · '+total+' benefícios disponíveis</span></div><div class="cb-tools"><label>Situação<select class="inp" data-cb-vitrine-filter><option value="all">Todas as respostas</option>'+Object.keys(statuses).map(function(k){return '<option value="'+k+'"'+(ctx.filter===k?' selected':'')+'>'+statuses[k]+'</option>';}).join('')+'</select></label></div><div class="cb-table-wrap"><table class="cb-table cb-vit-responses"><thead><tr><th>Mentorado</th><th>Situação</th><th>Preferências</th><th>Pontos do trimestre</th>'+((round.results||[]).length?'<th>Resultado</th>':'')+'<th></th></tr></thead><tbody>'+rs.filter(function(p){return !ctx.filter||ctx.filter==='all'||p.response_status===ctx.filter;}).sort(compare).map(function(p){var member=ctx.members.find(function(m){return m.id===p.member_id;});return '<tr><td><b>'+esc(member?member.nome:'Mentorado')+'</b><small>'+(p.conferred_grade?p.conferred_grade+'º grau':'Sem grau')+' · '+p.quarter_vouchers+' voucher(s)</small></td><td>'+statuses[p.response_status]+(p.pending_items.length?'<small>'+p.pending_items.length+' pendência(s)</small>':'')+'</td><td>'+p.benefits.map(function(b,i){return '<small>'+(i+1)+'ª '+names[b]+'</small>';}).join('')+'</td><td>'+points(p.period_points)+'</td>'+((round.results||[]).length?'<td>'+esc(p.response_status==='received'||p.response_status==='incomplete'?awardText(award(round,p.member_id)):'—')+'</td>':'')+'<td><button class="btn btn-sm" data-cb-vitrine-choice="'+esc(p.id)+'">Ver resposta</button></td></tr>';}).join('')+'</tbody></table></div><p class="cb-note">A lista inclui respostas, adiamentos e recusas. Preferências registradas não reservam vagas nem confirmam benefícios.</p>';
  }
  return header+controls+banner+intro+(scheduled?'':results(round,esc))+((round.results||[]).length?'':cards)+selected+team;
 }
 var api={names:names,statuses:statuses,label:label,dates:dates,points:points,compare:compare,choosePeriod:choosePeriod,award:award,awardText:awardText,render:render};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root.Club)root.Club.vitrine=api;
})(typeof window==='undefined'?globalThis:window);
