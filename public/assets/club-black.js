/* Áreas do Método Faixa Preta. Fontes reais, escrita auditada e falhas isoladas. */
(function () {
  'use strict';
  var C=window.Club, M=C.metodo, esc=C.esc;
  var views=['subida','pendencias','ranking','vitrine','casos','encontro','iris','modulos','rede'];
  var labels={subida:'Subida: Rumo ao Olympus',pendencias:'Pendências',ranking:'Ranking Black',vitrine:'Vitrine Black',casos:'Protocolo Grau Zero',encontro:'Encontro Grau Zero',iris:'Íris Black',modulos:'Fábrica · Íris Black'};
  var state={options:null,member:null,period:M.quarter(),loading:true,error:null,data:{},crm:null,ig:[],request:0,active:'subida'};
  var overlay,drawer,previousFocus,drawerId=null,previousOverflow='';
  function fmt(n){return n==null?'—':Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2});}
  function date(s){return s?new Date(s.slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'Sem prazo';}
  function money(n){return n==null?'—':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});}
  function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Manaus',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function ok(r){if(r.error)throw new Error(r.error.message||'Não foi possível carregar os dados.');return r.data;}
  function rows(key){return state.data[key]||[];}
  function admin(){return !!state.options.admin;}
  function footer(){return '<footer class="cb-footer"><span>Club OftalmoPremium Black · Método Faixa Preta</span><span>Confidencial · Uso dos Mestres · Oss.</span></footer>';}
  function empty(s){return '<div class="cb-empty">'+esc(s)+'</div>';}
  function emptyCard(icon,title,description){return '<div class="cb-empty-card"><span class="cb-empty-icon" aria-hidden="true">'+C.icon(icon)+'</span><div><h3>'+esc(title)+'</h3><p>'+esc(description)+'</p></div></div>';}
  function button(text,action,value,primary){return '<button type="button" class="btn'+(primary?' btn-primary':'')+'" data-cb-'+action+'="'+esc(value||'')+'">'+esc(text)+'</button>';}
  function allPeriods(){var y=new Date().getFullYear(),ps=[];for(var a=y-1;a<=y+1;a++)for(var q=1;q<=4;q++)ps.push(a+'-T'+q);return ps;}
  function controls(){return '<div class="cb-tools">'+(admin()?'<label>Mestre<select class="inp" data-cb-member>'+state.options.members.filter(function(m){return m.ativo!==false;}).map(function(m){return '<option value="'+esc(m.id)+'"'+(m.id===state.member.id?' selected':'')+'>'+esc(m.nome)+'</option>';}).join('')+'</select></label>':'')+'<label>Trimestre<select class="inp" data-cb-period>'+allPeriods().map(function(p){return '<option'+(p===state.period?' selected':'')+'>'+p+'</option>';}).join('')+'</select></label>'+button('Atualizar','reload')+'</div>';}
  function head(key,sub){return '<div class="cb-head"><div><span class="cb-kicker">'+esc(state.member.nome)+' · '+state.period+'</span><h1>'+esc(labels[key]||key)+'</h1><p>'+esc(sub||'')+'</p></div>'+controls()+'</div>';}
  function score(){var q=Object.assign({},rows('quarters')[0]||{}),live=rows('history').find(function(r){return r.period===state.period;});if(live&&live.followers_source==='auto')q.followers_growth=live.followers_growth;return M.score(q,rows('missions').filter(function(m){return m.status!=='cancelled';}),rows('extras').filter(function(e){return e.period===state.period;}),rows('encontros'));}
  function hasScore(){return rows('quarters').length||rows('missions').length||rows('encontros').length||rows('extras').some(function(e){return e.period===state.period;});}
  function historical(){
    if(hasScore()||rows('history').some(function(r){return r.period===state.period;}))return null;
    var record=rows('legacy')[0],p=record&&record.snapshot&&(record.snapshot.periods||[]).find(function(p){return p.id===state.period&&p.state!=='future'&&typeof p.points==='number';});
    return p?{record:record,period:p}:null;
  }
  function grade(){var gs=rows('grades');var legacy=rows('legacy')[0];return gs.length?Math.max.apply(null,gs.map(function(g){return g.grade;})):Number(legacy&&legacy.snapshot&&legacy.snapshot.grade)||0;}
  function vouchers(){return rows('extras').filter(function(e){return e.kind==='referral'&&!rows('redemptions').some(function(r){return r.voucher_id===e.id&&r.status!=='cancelled';});}).length;}
  function accumulated(){
    var index=function(p){return Number(p.slice(0,4))*4+Number(p.slice(-1));},end=index(state.period),values={};
    var legacy=rows('legacy')[0];((legacy&&legacy.snapshot&&legacy.snapshot.periods)||[]).forEach(function(p){if(p.points!=null&&p.state!=='future')values[p.id]=p.points;});
    rows('history').forEach(function(r){values[r.period]=Number(r.total);});
    var periods=Object.keys(values).filter(function(p){return index(p)<=end&&index(p)>end-4;});
    return periods.length?periods.reduce(function(sum,p){return sum+values[p];},0):null;
  }
  function alerts(){
    var a=[],q=rows('quarters')[0];
    if(q&&q.orphan_leads>0)a.push(['D03',q.orphan_leads+' leads órfãos no Sistema']);
    if(q&&q.outcomes_percent!=null&&q.outcomes_percent<95)a.push(['D03','Desfechos registrados abaixo de 95%']);
    var received=M.number(metric('D07','bonus_recebidos').value),done=M.number(metric('D07','bonus_desfechos').value);
    if(received!==null&&done!==null&&received>done)a.push(['D07',(received-done)+' Leads Bônus sem desfecho']);
    if(q&&q.call_conversion!=null&&q.call_conversion<60)a.push(['D09','Chamada → consulta abaixo de 60%']);
    return a.length?'<div class="cb-section"><div><span class="cb-kicker">Leitura operacional</span><h2>Fila de decisão</h2></div></div><div class="cb-tools">'+a.map(function(x){return button(x[0]+' · '+x[1],'step',x[0]);}).join('')+'</div>':'';
  }
  function pending(){
    var items=M.pending(rows('missions'),[],[],[],today());
    (state.options.artifacts||[]).filter(function(a){return !a.archived_at&&a.tipo!=='interna'&&!a.somente_equipe&&(!a.member_id||a.member_id===state.member.id);}).forEach(function(a){
      var steps=(state.options.steps||[]).filter(function(s){return s.artifact_id===a.id;});
      var progress=(state.options.progress||[]).filter(function(p){return p.member_id===state.member.id;});
      var par=C.par(steps,function(id){return progress.some(function(p){return p.step_id===id&&p.feito;});});
      if(par.estado!=='travado'||!par.proxima||rows('missions').some(function(m){return m.artifact_step_id===par.proxima.id;}))return;
      items.push({id:'legacy-'+par.proxima.id,artifact_step_id:par.proxima.id,title:par.proxima.titulo,step:M.artifactSteps(a).find(function(id){return /^D\d{2}$/.test(id);})||null,source:a.nome+' · com o mentorado',status:'requested',due:null,requested:null,weight:null,late:0});
    });
    var q=rows('quarters')[0];
    if(q&&q.outcomes_percent!=null&&q.outcomes_percent<95)items.push({id:'routine-system',step:'D03',title:'Registrar os desfechos no Sistema Black',source:'Rotina · desfechos abaixo de 95%',requested:q.updated_at,weight:null,stake:'Até 5 pts · Sistema vivo',late:0});
    rows('encontros').forEach(function(e){
      [['publicized',e.publicized,'Divulgar a edição marcando @dralexsa'],['videos',e.video_group&&e.video_ads,'Enviar vídeos para grupo e tráfego'],['attended',e.attended,'Participar ao vivo do pitch']].forEach(function(x){
        if(!x[1])items.push({id:'edition-'+e.id+'-'+x[0],step:'D08',title:x[2],source:'Encontro · edição '+date(e.edition),due:e.edition,requested:e.updated_at,weight:null,stake:fmt(10/(rows('encontros').length*3))+' pts da rotina',late:Math.max(0,Math.floor((Date.parse(today())-Date.parse(e.edition))/86400000))});
      });
    });
    return items.sort(function(a,b){return (a.due||'9999').localeCompare(b.due||'9999');});
  }
  var selectedEdition='', activeDelivery=null;
  function catalog(step){return (C.stepChecklist||[]).filter(function(i){return i.step===step;});}
  function edition(){var es=rows('encontros').slice().sort(function(a,b){return b.edition.localeCompare(a.edition);});return es.find(function(e){return e.edition===selectedEdition;})||es[0];}
  function itemState(item){
    var ed=item.monthly&&edition(),key=item.monthly?(ed&&ed.edition):'';
    if(item.source==='MANUAL'){
      var r=rows('checklistProgress').find(function(r){return r.item_id===item.id&&r.edition===key;});if(r)return r;
      var fieldName={'D08-01':'publicized','D08-02':'video_group','D08-03':'video_ads','D08-04':'attended'}[item.id];
      if(ed&&fieldName&&ed[fieldName])return {done:true,updated_at:ed.updated_at,actor_name:'Equipe · '+String(ed.updated_by||'registro da edição').slice(0,36),evidence:ed.evidence};
      return {done:false};
    }
    if(item.id==='D07-04')return {done:['D03','D05','D06'].every(function(id){return status(id)==='audited';}),actor_name:'Sistema · auditorias dos degraus',note:'Derivado dos degraus D03, D05 e D06'};
    if(item.id==='D05-02'){var m=metric('D05','crescimento');if(m.source.indexOf('AUTO')===0&&m.value!=null)return {done:Number(m.value)>0,updated_at:m.stamp,actor_name:'Sistema · Instagram',note:fmt(m.value)+' seguidores no trimestre'};}
    return {done:false,note:'Aguardando leitura da integração'};
  }
  function completion(step){var items=catalog(step).filter(function(i){return !i.optional;});return {total:items.length,done:items.filter(function(i){return itemState(i).done;}).length};}
  function status(step){var c=completion(step);return c.total&&c.done===c.total?'audited':c.done?'running':'pending';}
  function visibleArtifacts(){return (state.options.artifacts||[]).filter(function(a){return !a.archived_at&&a.tipo!=='interna'&&(admin()||!a.somente_equipe)&&(!a.member_id||a.member_id===state.member.id);});}
  function artifactCards(list,back){return list.length?'<div class="cb-deliveries">'+list.map(function(a){var steps=(state.options.steps||[]).filter(function(s){return s.artifact_id===a.id;}),done=steps.filter(function(s){return (state.options.progress||[]).some(function(p){return p.member_id===state.member.id&&p.step_id===s.id&&p.feito;});}).length;return '<button class="cb-delivery" data-cb-artifact="'+esc(a.id)+'" data-back="'+esc(back||'')+'"><span><b>'+esc(a.nome)+'</b><small>'+done+' de '+steps.length+' etapas do processo'+(a.somente_equipe?' · Equipe':'')+'</small></span><span aria-hidden="true">↗</span></button>';}).join('')+'</div>':empty('Nenhuma entrega disponível.');}
  function checklistBody(id,items){
    var required=items.filter(function(i){return !i.optional;}),done=required.filter(function(i){return itemState(i).done;}).length;
    var body='<div class="cb-section"><h3>Conferência da entrega</h3><span class="cb-note">'+done+' de '+required.length+' itens obrigatórios</span></div>';
    if(id==='D08')body+='<label class="cb-note">Edição<select class="inp" data-cb-edition>'+rows('encontros').slice().sort(function(a,b){return b.edition.localeCompare(a.edition);}).map(function(e){return '<option value="'+esc(e.edition)+'"'+(edition()&&e.edition===edition().edition?' selected':'')+'>'+date(e.edition)+'</option>';}).join('')+'</select></label>'+(!edition()?empty('Nenhuma edição cadastrada neste trimestre. Cadastre a edição para conferir os itens mensais.'):'')+'<p class="cb-note">Cada edição tem seu próprio checklist; os registros anteriores são preservados.</p>';
    body+=items.map(function(item){var r=itemState(item),mission=rows('missions').find(function(m){return m.checklist_item_id===item.id;}),ritual=/^D11-0[1-7]$/.test(item.id);return '<article class="cb-check-item'+(r.done?' is-done':'')+'"><span class="cb-check-icon" aria-hidden="true">'+(r.done?'✓':'○')+'</span><div><b>'+esc(item.title)+'</b><div class="cb-item-meta"><span class="cb-source">'+esc(item.sourceDetail)+'</span><span>'+esc(item.owner)+'</span>'+(item.optional?'<span>Adicional · mínimo de 3 rituais</span>':'')+'</div><small>'+(r.done?'FEITO':'NÃO FEITO')+' · '+(r.updated_at?date(r.updated_at)+' · '+esc(r.actor_name||'Equipe Black'):'Sem marcação')+'</small>'+(r.note?'<p class="cb-note">'+esc(r.note)+'</p>':'')+(r.evidence?'<p class="cb-note">'+esc(r.evidence)+'</p>':'')+'<div class="cb-tools">'+(admin()&&item.source==='MANUAL'&&(!item.monthly||edition())?button('Conferir item','item',item.id):'')+(mission?button(admin()?'Ver missão':'Enviar evidência','mission',mission.id):admin()&&item.missionWeight!=null&&(!ritual||item.id==='D11-01')?button(ritual?'Solicitar missão · 3 rituais':'Solicitar missão','item-mission',item.id):'')+'</div></div></article>';}).join('');
    return body+'<p class="cb-note">A equipe confere os itens manuais. Itens automáticos dependem de uma leitura confirmada. Marcar o checklist não concede pontos: missões precisam ser solicitadas e verificadas.</p>';
  }
  function deliveries(step,artifacts){return M.deliveries(step,artifacts||visibleArtifacts());}
  function deliveryCards(step,artifacts){
    return deliveries(step,artifacts).map(function(d){
      var required=d.items.filter(function(i){return !i.optional;}),done=required.filter(function(i){return itemState(i).done;}).length;
      var a=d.artifact,steps=a&&state.options?(state.options.steps||[]).filter(function(s){return s.artifact_id===a.id;}):[];
      var part=C.par(steps,function(id){return state.member&&(state.options.progress||[]).some(function(p){return p.member_id===state.member.id&&p.step_id===id&&p.feito;});});
      var summary=state.loading?'Carregando andamento…':state.error?'Andamento indisponível':required.length?done+' de '+required.length+' itens conferidos':part.feitas+' de '+part.total+' etapas';
      var progress=required.length?done/required.length:(part.total?part.feitas/part.total:0);
      var label=a?(part.estado==='travado'?'Esperando você':part.estado==='entregue'?'Entregue':part.estado==='ativo'?'Ativo · acompanhamento':a.status||'A conferir'):(required.length&&done===required.length?'Conferida':done?'Em conferência':'A conferir');
      var color=a&&part.estado==='travado'?'var(--orange)':progress===1?'var(--success)':'var(--muted)';
      return '<button type="button" class="art art-compact" '+(a?'data-cb-artifact="'+esc(a.id)+'" data-delivery="'+esc(d.id)+'"':'data-cb-delivery="'+esc(d.id)+'"')+' data-back="'+esc(step)+'" aria-haspopup="dialog" aria-label="Ver detalhes de '+esc(d.name)+'"><div class="art-i">'+C.icon(a&&a.icone||'box')+'</div><p class="art-n">'+esc(d.name)+'</p><span class="cb-chip">'+esc(step)+'</span><div class="cb-bar" aria-hidden="true"><span style="width:'+(!state.loading&&!state.error?progress*100:0)+'%"></span></div><small class="cb-note">'+esc(summary)+'</small>'+(a&&steps.length&&required.length?'<small class="cb-note">Implantação: '+part.feitas+'/'+part.total+' etapas</small>':'')+(!state.loading&&!state.error?'<span class="art-st" style="color:'+color+'">'+esc(label)+'</span>':'')+'<span class="art-detail">Ver checklist <span aria-hidden="true">↗</span></span></button>';
    }).join('');
  }
  function stepDeliveries(id){
    var c=completion(id);
    return '<div class="cb-section"><h3>Entregas do '+(id==='TREINO'?'Treino':'degrau')+'</h3><span class="cb-note">'+c.done+' de '+c.total+' itens conferidos</span></div><div class="artgrid cb-delivery-grid">'+deliveryCards(id)+'</div>';
  }
  function openDelivery(id){
    if(state.loading||state.error){open('Entrega',empty(state.error||'Carregando entrega…'),id,true);return;}
    var d=deliveries(id.split('/')[0]).find(function(d){return d.id===id;});if(!d)return;
    activeDelivery=id;
    if(d.artifact){openArtifact(d.artifact.id,d.step,d);return;}
    open(d.name,button('← Voltar ao degrau','step',d.step)+'<p class="cb-note">'+esc(d.step)+' · '+esc(d.name)+'</p>'+checklistBody(d.step,d.items),id,true);
  }
  function deliveryUrl(value){
    if(!value)return null;
    try{var url=new URL(value,location.href);return /^https?:$/.test(url.protocol)?url.href:null;}catch(e){return null;}
  }
  function openArtifact(id,back,delivery){
    var a=visibleArtifacts().find(function(a){return a.id===id;});if(!a)return;
    var steps=C.ordenaEtapas((state.options.steps||[]).filter(function(s){return s.artifact_id===id;}));
    function progress(s){return (state.options.progress||[]).find(function(p){return p.member_id===state.member.id&&p.step_id===s;})||{};}
    var part=C.par(steps,function(id){return !!progress(id).feito;}),url=a.status!=='Bloqueado'&&deliveryUrl(a.url);
    var body=(back?button('← Voltar ao degrau','step',back):'')+
      (a.subtitulo?'<p>'+esc(a.subtitulo)+'</p>':'')+
      '<div class="cb-tools">'+(a.status?'<span class="cb-chip">'+esc(a.status)+'</span>':'')+
      M.artifactSteps(a).map(function(step){return '<span class="cb-chip">'+esc(step)+'</span>';}).join('')+'</div>'+
      (a.meta?'<p class="cb-note">'+esc(a.meta)+'</p>':'');
    if(url)body+='<p><a class="btn btn-primary" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Abrir entrega ↗</a></p>';
    if(steps.length)body+='<div class="cb-section"><h3>Checklist do processo</h3><span class="cb-note">'+part.feitas+' de '+part.total+' etapas de implantação</span></div>';
    var shown=steps.filter(function(s){var type=C.tipoEtapa(s);return admin()||(type!=='aceite'&&(type!=='opcional'||progress(s.id).feito)&&(type!=='rotina'||part.completo));});
    body+=shown.map(function(s){
      var p=progress(s.id),type=C.tipoEtapa(s),routine=type==='rotina',material=a.status!=='Bloqueado'&&deliveryUrl(s.url);
      return '<article class="cb-check-item'+(p.feito?' is-done':'')+'"><span class="cb-check-icon" aria-hidden="true">'+(routine?'↻':p.feito?'✓':'○')+'</span><div><b>'+esc(s.titulo)+'</b><small>'+
        (routine?'ACOMPANHAMENTO · '+esc(C.cadenciaRotulo(s.cadencia_dias)):p.feito?'FEITO':type==='trava'?'ESPERANDO VOCÊ':'NÃO FEITO')+(p.feito_em?' · '+date(p.feito_em):'')+'</small>'+
        (s.descricao?'<p class="cb-note">'+esc(s.descricao)+'</p>':'')+
        (material?'<a class="cb-link" href="'+esc(material)+'" target="_blank" rel="noopener noreferrer">Abrir material ↗</a>':'')+'</div></article>';
    }).join('')||empty('Este processo ainda não tem etapas disponíveis para exibição.');
    if(delivery&&delivery.items.length)body+=checklistBody(delivery.step,delivery.items);
    open(a.nome,body,delivery?delivery.id:null,true);
  }
  function itemForm(id){var item=(C.stepChecklist||[]).find(function(i){return i.id===id;});if(!item||item.source!=='MANUAL')return;if(item.monthly&&!edition())return;var r=itemState(item);open('Conferir entrega',form('<p>'+esc(item.title)+'</p><p class="cb-note">'+esc(item.owner)+' · data e autor registrados automaticamente.</p><input type="hidden" name="edition" value="'+esc(item.monthly&&edition()?edition().edition:'')+'">'+check('Entrega conferida e feita','done',r.done)+field('Evidência / observação (opcional)','evidence',r.evidence,'textarea'),'checklist',id));}
  function badge(s){return '<span class="cb-chip '+s+'">'+({pending:'Pendente',running:'Rodando',audited:'Auditado'}[s]||s)+'</span>';}
  function metric(step,key){
    var r=rows('steps').find(function(r){return r.method_step===step;});var val=r&&r.metrics&&r.metrics[key];
    var source='MANUAL',stamp=r&&r.updated_at;
    var q=rows('quarters')[0],qkey=scoreMetric(step,key);
    if(qkey){val=q&&q[qkey];stamp=q&&q.updated_at;}
    var live=rows('history').find(function(r){return r.period===state.period;});
    if(step==='D05'&&key==='crescimento'&&live&&live.followers_source==='auto'){val=live.followers_growth;source='AUTO · Instagram';stamp=state.ig.length?state.ig[state.ig.length-1].dia:null;}
    var f=state.crm&&state.crm.funnel&&state.crm.funnel.data&&state.crm.funnel.data.periodo;
    if(f&&step==='D03'&&key==='novos'){val=f.novos;source='AUTO · CRM';stamp=state.crm.updated_at;}
    if(f&&step==='D03'&&key==='comparecimento'){val=f.agendadas?f.realizadas/f.agendadas*100:null;source='AUTO · CRM';stamp=state.crm.updated_at;}
    if(f&&step==='D10'&&key==='cirurgias'){val=f.cirurgias;source='AUTO · CRM';stamp=state.crm.updated_at;}
    // Procedimentos e consultas têm unidades distintas; não dividir esses contadores.
    var last=state.ig[state.ig.length-1];
    if(last&&step==='D05'&&key==='seguidores'){val=last.seguidores;source='AUTO · Instagram';stamp=last.dia;}
    return {value:val==null||val===''?null:val,source:source,stamp:stamp};
  }
  function scoreMetric(step,key){return ({'D03/orfaos':'orphan_leads','D03/desfechos':'outcomes_percent','D05/crescimento':'followers_growth','D06/cpv_percent':'cpv_percent','D09/chamada_consulta':'call_conversion'})[step+'/'+key];}
  function metricText(m,unit){return m.value==null?'—':(typeof m.value==='number'?fmt(m.value):esc(m.value))+(unit?' <small>'+esc(unit)+'</small>':'');}
  function signal(step){
    if(pending().some(function(p){return p.step===step&&p.late>0;}))return ['crit','Pedido em atraso'];
    var key=step==='D09'?'chamada_consulta':step==='D06'?'cpv_percent':null;
    if(key){var n=M.number(metric(step,key).value);if(n!==null)return [(step==='D09'?n>=60:n<15)?'ok':'warn',(step==='D09'?n>=60:n<15)?'Na meta':'Abaixo da régua'];}
    return ['off','Aguardando leitura'];
  }
  function tile(step){var m=metric(step.id,step.metrics[0][0]),sig=signal(step.id);return '<button type="button" class="cb-card" data-cb-step="'+step.id+'"><div class="cb-card-top"><span class="cb-number">'+step.id.slice(1)+'</span><h3>'+esc(step.name)+'</h3></div>'+badge(status(step.id))+'<p class="cb-note">'+completion(step.id).done+' de '+completion(step.id).total+' itens</p><div class="cb-metric">'+metricText(m,step.metrics[0][2])+'<small>'+esc(step.metrics[0][1])+'</small></div><div class="cb-card-bottom"><span class="cb-dot '+sig[0]+'"></span><span class="cb-note">'+sig[1]+'</span><span class="cb-points">'+step.points+'</span></div></button>';}
  function pendingList(items){return items.length?items.map(function(p){return '<article class="cb-pending'+(p.late?' late':'')+'"><time>'+ (p.late?fmt(p.late)+' dias<br>de atraso':p.status==='submitted'?'Em verificação':p.due?'Até '+date(p.due):'Sem prazo')+'</time><div class="cb-pending-body"><b>'+esc(p.title)+'</b><small>'+esc(p.step||'Processos Black')+' · '+esc(p.source)+(p.requested?' · pedido em '+date(p.requested):' · prazo a definir')+'</small></div><span class="cb-chip">'+(p.stake?esc(p.stake):p.weight==null?'Peso a definir':p.weight===0?'Entrega Club · 0 pts':(p.weight===0.5?'Colaboração · ½':'Aplicação · 1')+' · '+fmt(score().asked?p.weight/score().asked*15:0)+' pts em jogo')+'</span>'+(p.step?button(p.status==='submitted'?'Ver evidência':'Abrir degrau','step',p.step):'<button class="btn" data-nav="artifacts">Abrir processo</button>')+(p.id&&rows('missions').some(function(m){return m.id===p.id;})?button(admin()?'Verificar':'Enviar evidência','mission',p.id):'')+(admin()&&p.artifact_step_id?button('Definir missão','legacy',p.artifact_step_id):'')+'</article>';}).join(''):empty('Nenhuma pendência solicitada para este trimestre. O que ainda não foi pedido não entra nesta lista.');}
  function modules(){return '<div class="cb-grid">'+[['fabrica','Fábrica de Conteúdo Black','Conteúdo com IA e avatar para Instagram, TikTok e YouTube.'],['iris','Íris Black','Assistente virtual para qualificação e agendamento, com transbordo para a equipe.']].map(function(m){var active=rows('extras').some(function(e){return e.kind==='module'&&e.reference===m[0];});return '<article class="cb-card cb-module"><span class="cb-kicker">Produto separado</span><h3>'+m[1]+'</h3><p>'+m[2]+'</p><span class="cb-chip">'+(active?'Ativado':'Não ativado')+'</span><p class="cb-note">Ativação vale +5 pts, uma vez, no trimestre da contratação.</p><div class="cb-tools">'+button(active?'Ver módulo':'Conhecer módulo','module',m[0])+'</div></article>';}).join('')+'</div>';}
  function subida(){var s=score(),p=pending(),g=grade(),h=historical();return '<div class="cb-hero">'+head('subida','Os 12 degraus do Método Faixa Preta. Seu próximo avanço começa pelo que já foi combinado.')+'</div><div class="cb-stats">'+[
    ['Sua graduação',g?g+'º grau':'Faixa preta','A faixa é uma só'],['Placar do trimestre',h?fmt(h.period.points)+' / 50':hasScore()?fmt(s.total)+' / 50':'—',h?'Apuração da planilha · meta 50':'Meta 50 · régua até 60'],['Pendências',p.length,'Pedidos em aberto'],['Vouchers',state.error?'—':vouchers(),'Uma indicação, um voucher'],['Acumulado · 4 trimestres',fmt(accumulated()),'Pontos para renovação']
  ].map(function(t){return '<div class="cb-stat"><small>'+t[0]+'</small><strong>'+t[1]+'</strong><span>'+t[2]+'</span></div>';}).join('')+'</div><div class="cb-section"><div><span class="cb-kicker">Seu próximo movimento</span><h2>Pendências</h2></div><button class="cb-link" data-nav="pendencias">Ver todas →</button></div>'+pendingList(p.slice(0,3))+alerts()+
  M.movements.map(function(m,i){return '<section><div class="cb-section"><div><span class="cb-kicker">Movimento 0'+(i+1)+'</span><h2>'+m+'</h2></div><span class="cb-note">'+M.steps.filter(function(s){return s.movement===m;}).map(function(s){return s.id;}).join(' · ')+'</span></div><div class="cb-grid'+(i===0?' cb-prepare':'')+'">'+M.steps.filter(function(s){return s.movement===m;}).map(tile).join('')+'</div></section>';}).join('')+
  '<div class="cb-section"><div><span class="cb-kicker">Transversais</span><h2>Em todos os degraus</h2></div></div><div class="cb-duo"><article class="cb-score-card"><h3>Treino de Competição</h3><p>Cultura Premium & Atendimento Premium + técnica das quatro funções. O D04 monta o time; o Treino o mantém afiado.</p><button class="btn" data-cb-step="TREINO">Abrir entregas do Treino</button></article><article class="cb-score-card"><h3>Cérebro Black · Auditoria</h3><p>Fontes, pareceres e missões verificadas. Leads Bônus liberados com D03, D05 e D06 auditados.</p><span class="cb-chip">'+(['D03','D05','D06'].every(function(id){return status(id)==='audited';})?'Leads Bônus elegíveis':'Auditoria necessária')+'</span></article></div><div class="cb-section"><div><span class="cb-kicker">Módulos à parte</span><h2>Amplie sua operação</h2></div></div>'+modules();}
  function pendencias(){return head('pendencias','O que já foi solicitado a você, ordenado pelo prazo, com os pontos em jogo.')+(admin()?'<div class="cb-tools">'+button('Solicitar missão','mission-new','',true)+'</div><br>':'')+pendingList(pending());}
  function placar(){var h=historical();if(h&&C.graduacao&&C.graduacao.summary)return head('Graduação','Apuração da planilha · a mesma base utilizada no Ranking Black.')+C.graduacao.summary(h.record,state.period);var s=score(),known=hasScore(),g=grade();return head('Graduação','Pontos premiam o trimestre. Graus premiam a carreira.')+'<div class="cb-hero"><span class="cb-kicker">Placar v2.2 · '+state.period+'</span><div class="cb-score">'+(C.graduacao&&C.graduacao.belt?C.graduacao.belt(g):'')+'<div><strong>'+ (known?fmt(s.total):'—')+'</strong><small> / 50 pontos</small></div><div><h3>'+ (g?g+'º grau':'Faixa preta · sem grau')+'</h3><p>'+(known&&s.total>=50?'Meta atingida · graduação sujeita à conferência do trimestre':known?'Faltam '+fmt(Math.max(0,50-s.total))+' pontos para a meta':'Aguardando a primeira apuração do trimestre')+'</p></div></div><div class="cb-bar"><span style="width:'+Math.min(100,s.total/50*100)+'%"></span></div><p class="cb-note">'+(s.complete?'Fontes da régua apuradas.':'Apuração parcial: fontes sem leitura aparecem como —.')+' Máximo de um grau por trimestre.</p></div><div class="cb-grid">'+[
    ['Rotina',known?fmt(s.routine)+' / 40':'—','Presença '+fmt(s.parts.attendance)+'/10 · Vídeos '+fmt(s.parts.videos)+'/10 · Encontro '+fmt(s.parts.encontro)+'/10 · Seguidores '+fmt(s.parts.followers)+'/5 · Sistema '+fmt(s.parts.system)+'/5'],
    ['Missões',known?fmt(s.missions)+' / 15':'—','Pesos concluídos ÷ pesos pedidos × 15. Aplicação = 1; colaboração = ½; entrega do Club = 0.'],
    ['Resultado',fmt(s.result)+' / 5','CPV-Cirurgia < 15% do ticket (D06) OU chamada → consulta ≥ 60% (D09). Um juiz já vale 5.'],
    ['Fora da régua',known?'+'+fmt(s.extra):'—','Bônus do Dr. Alex: 10. Indicação convertida: 25 + 1 voucher, sem teto. Ativação: +5 uma vez por módulo.']
  ].map(function(x){return '<article class="cb-score-card"><h3>'+x[0]+'</h3><strong>'+x[1]+'</strong><p>'+esc(x[2])+'</p></article>';}).join('')+'</div>'+(admin()?'<div class="cb-section cb-tools">'+button('Apurar rotina e resultado','quarter')+button('Registrar bônus / indicação / módulo','extra')+button('Registrar grau conferido','grade')+'</div>':'')+'<p class="cb-note">A presença e os créditos de vídeo usam a janela elegível do membro. Registros manuais são verificados pela equipe; uma evidência enviada pelo membro só pontua depois dessa conferência.</p>';}
  function ranking(){
    var heading=head('ranking','Os Mestres lado a lado, pelos pontos do trimestre. A mesma pontuação da Graduação, com cada conquista em destaque.');
    if(state.rankingLoading)return heading+'<div class="cb-loading" role="status">Carregando ranking…</div>';
    if(state.rankingError)return heading+'<div class="cb-notice" role="alert">Não foi possível carregar os pontos do ranking. '+button('Tentar novamente','reload')+'</div>';
    var list=rows('ranking'),own=list.find(function(r){return r.member_id===state.member.id;});
    var preview=list.some(function(r){return r.is_demo;})?'<div class="cb-notice">Este ranking inclui dados de prévia da Graduação, identificados em cada linha. Eles ainda não representam uma apuração validada.</div>':'';
    var cards=list.length?'<div class="cb-ranking-caption"><span>'+list.length+' Mestres no ranking</span><span>Variação em relação à semana anterior</span></div><ol class="cb-ranking-list" aria-label="Ranking do trimestre '+esc(state.period)+'">'+list.map(function(r){
      var source=r.source==='graduacao'?(r.is_demo?'Prévia da graduação':'Histórico da graduação'):'Placar v2.2';
      var isOwn=r.member_id===state.member.id,move=r.movement,variation=move==null?'Sem comparação semanal':move>0?'Subiu '+move+' posição(ões)':move<0?'Caiu '+Math.abs(move)+' posição(ões)':'Mesma posição';
      return '<li value="'+Number(r.position)+'" class="cb-ranking-card'+(r.position<=3?' cb-podium':'')+(isOwn?' cb-own':'')+'">'+
        '<div class="cb-rank-position"><span class="cb-rank" aria-label="'+Number(r.position)+'º lugar">'+Number(r.position)+'</span><span class="cb-rank-move '+(move>0?'up':move<0?'down':'stable')+'" aria-label="'+esc(variation)+'" title="'+esc(variation)+'">'+(move==null?'—':move>0?'↑ '+move:move<0?'↓ '+Math.abs(move):'→ 0')+'</span></div>'+
        '<span class="cb-rank-avatar" aria-hidden="true">'+esc(C.initials(r.alias))+'</span><div class="cb-rank-person"><div class="cb-rank-name"><strong>'+esc(r.alias)+'</strong>'+(isOwn?'<span class="cb-rank-you">'+(admin()?'Mestre selecionado':'Você está aqui')+'</span>':'')+'</div><small>'+source+(r.source==='graduacao'&&r.source_date?' · '+date(r.source_date):'')+(r.source!=='graduacao'&&!r.complete?' · Apuração parcial':'')+'</small></div>'+
        '<span class="cb-rank-grade'+(!r.grade?' no-grade':'')+'">'+(r.grade?Number(r.grade)+'º grau':'Sem grau')+'</span><div class="cb-rank-points"><strong>'+fmt(r.total)+'</strong><span>pts</span></div></li>';
    }).join('')+'</ol>':emptyCard('award','O ranking começa na apuração','Ainda não há pontuação na Graduação ou no placar v2.2 para este trimestre.');
    return heading+preview+(admin()?'<div class="cb-ranking-actions">'+button('Registrar referência semanal','rank-snapshot')+'</div>':'')+cards+(own?'<div class="cb-ranking-fixed"><span>'+own.position+'º · '+esc(state.member.nome)+'</span><b>'+fmt(own.total)+' pts</b></div>':'')+'<p class="cb-note">Variação semanal disponível após a primeira comparação registrada. A ausência de histórico aparece como —. Quando apurado, o placar v2.2 tem prioridade sobre a planilha.</p>';
  }
  function vitrine(){
    var eligible=score().total>=50||vouchers()>0,known=hasScore();
    var summary='<dl class="cb-vitrine-summary"><div><dt>'+C.icon('award')+' Vouchers disponíveis</dt><dd>'+vouchers()+'</dd><p>Uma indicação, um voucher.</p></div>'+
      '<div><dt>'+C.icon('award')+' Pontos para resgate</dt><dd>'+(known?fmt(score().total):'—')+' <small>/ 50</small></dd><p>Apuração do placar v2.2.</p></div>'+
      '<div class="cb-vitrine-status"><dt>'+C.icon('box')+' Sua Vitrine</dt><dd>'+(eligible?'Resgate disponível':known?'A caminho do resgate':'Aguardando apuração')+'</dd><p>'+(eligible?'Consulte as vagas e a janela de cada benefício.':'Os resgates dependem de pontos ou voucher e da abertura do estoque.')+'</p></div></dl>';
    var rewards=rows('rewards').map(function(r){
      var requested=rows('redemptions').some(function(d){return d.reward_id===r.id&&d.status!=='cancelled';});
      var open=new Date()>=new Date(r.opens_at)&&new Date()<=new Date(r.closes_at);
      return '<article class="cb-score-card"><span class="cb-kicker">'+esc(r.period)+'</span><h3>'+esc(r.title)+'</h3><p>'+esc(r.description)+'</p><strong>'+r.stock+' vagas</strong><p class="cb-note">Abertura: '+date(r.opens_at)+' · até '+date(r.closes_at)+'</p>'+
        (!requested&&eligible&&open&&r.stock>0?button('Solicitar resgate','redeem',r.id,true):'<span class="cb-chip">'+(requested?'Solicitado':!open?'Fora da janela':r.stock<=0?'Sem vagas':'Ainda não elegível')+'</span>')+'</article>';
    }).join('');
    return head('vitrine','Conquistas que abrem novas experiências. Vouchers primeiro; depois, a pontuação do trimestre.')+summary+
      '<div class="cb-section cb-vitrine-heading"><h2>Benefícios do trimestre</h2>'+(admin()?button('Cadastrar benefício','reward-new','',true):'')+'</div>'+
      (rewards?'<div class="cb-grid">'+rewards+'</div>':emptyCard('box','A próxima Vitrine está sendo preparada','A equipe ainda não publicou os benefícios deste trimestre. Quando o estoque abrir, as opções e os prazos aparecerão aqui.'))+
      '<div class="cb-section cb-vitrine-heading"><h2>'+(admin()?'Fila de resgates da Rede':'Meus resgates')+'</h2></div>'+redemptions()+
      '<p class="cb-note">Vaga não resgatada não acumula. O grau abre benefícios de carreira; o resgate da Vitrine depende de pontos ou voucher. As condições da viagem são publicadas junto ao benefício de cada trimestre.</p>';
  }
  function redemptions(){var rs=admin()?rows('queue').filter(function(d){return rows('rewards').some(function(r){return r.id===d.reward_id;});}).sort(function(a,b){var ap=rows('ranking').find(function(x){return x.member_id===a.member_id;}),bp=rows('ranking').find(function(x){return x.member_id===b.member_id;});return Number(!!b.voucher_id)-Number(!!a.voucher_id)||(bp?bp.total:0)-(ap?ap.total:0)||String(a.requested_at).localeCompare(String(b.requested_at));}):rows('redemptions');return rs.length?'<div class="cb-table-wrap"><table class="cb-table"><thead><tr><th>Benefício</th><th>Prioridade</th><th>Situação</th><th></th></tr></thead><tbody>'+rs.map(function(d){var r=rows('allRewards').find(function(r){return r.id===d.reward_id;});return '<tr><td>'+esc(r?r.title:'Benefício')+(admin()?'<small>'+esc((state.options.members.find(function(m){return m.id===d.member_id;})||{}).nome||'Mestre')+'</small>':'')+'<small>'+esc(r?r.period:'')+'</small></td><td>'+(d.voucher_id?'Voucher':'Pontuação')+'</td><td>'+({requested:'Na fila',confirmed:'Agendado',completed:'Concluído',cancelled:'Cancelado'}[d.status])+'</td><td>'+(admin()&&d.status==='requested'?button('Confirmar','redemption',d.id):admin()&&d.status==='confirmed'?button('Concluir','redemption',d.id):'')+'</td></tr>';}).join('')+'</tbody></table></div>':emptyCard('award','Nenhum resgate por enquanto',admin()?'As solicitações dos Mestres aparecerão aqui para acompanhamento e confirmação.':'Quando você solicitar um benefício, poderá acompanhar a confirmação por aqui.');}
  function encontro(){return head('encontro','Três entregas por edição: divulgação, vídeos para grupo e tráfego, presença no pitch.')+(admin()?button('Registrar edição / entregas','encontro-new')+'<br><br>':'')+(rows('encontros').length?'<div class="cb-grid">'+rows('encontros').map(function(e){var count=+e.publicized+ +(e.video_group&&e.video_ads)+ +e.attended;return '<article class="cb-score-card"><span class="cb-kicker">'+date(e.edition)+'</span><h3>'+count+' de 3 entregas</h3>'+[['Divulgou marcando @dralexsa',e.publicized],['Vídeo para o grupo',e.video_group],['Vídeo para o tráfego',e.video_ads],['Presença no pitch',e.attended]].map(function(x){return '<div class="cb-check">'+(x[1]?'✓':'○')+' '+x[0]+'</div>';}).join('')+'<p>Leads direcionados: '+fmt(e.leads)+'</p>'+(admin()?button('Atualizar','encontro-edit',e.id):'')+'</article>';}).join('')+'</div>':empty('Nenhuma edição registrada para você neste trimestre.'))+'<p class="cb-note">Os dois vídeos formam uma única entrega. A régua usa as edições elegíveis registradas pela equipe, incluindo as entregas ainda pendentes.</p>';}
  function iris(){var active=rows('extras').some(function(e){return e.kind==='module'&&e.reference==='iris';});return head('iris','Assistente virtual de atendimento · produto separado.')+(!active?modules():empty('Módulo ativado. As métricas agregadas da Íris aparecerão após a conexão da plataforma: conversas, SLA, qualificados, agendamentos, transbordo e registro no Sistema.'))+'<div class="cb-notice">A Íris identifica-se como assistente virtual, qualifica e agenda. Não faz conduta clínica nem promete resultados. Casos sensíveis são encaminhados a um humano. Este painel exibe somente agregados.</div>';}
  var indication=['Superfície','Astigmatismo e congruência','Endotélio','Pupila / Chord µ fotópica e mesópica','Aberrações: T.Sph, T.Coma, T.Tre, HOA total','Mácula','Nervo óptico'];
  var customization=['Profissão e demanda visual','Hobbies e distâncias prioritárias','Direção noturna','História cirúrgica ocular','Contraindicações e comorbidades','Dominância ocular','Expectativas e perfil visual'];
  var numericCriteria=[['endotelio','Endotélio · cél/mm²'],['ae','AE corneana · µm'],['hoa','RMS HOA · 4 mm · µm'],['coma','Coma · 4 mm · µm'],['trefoil','Trefoil · 4 mm · µm'],['macula','Mácula · grau 0–3'],['no','Nervo óptico · estágio 0–3']];
  function numericFields(eye){return '<fieldset><legend>'+eye+' · parâmetros do quadro de referência</legend>'+numericCriteria.map(function(n){return field(n[1],'parameter_'+eye+'_'+n[0],'','number');}).join('')+'<p class="cb-note">Deixe em branco o que não foi medido. Aberrações: informar abertura e sinal na descrição do critério.</p></fieldset>';}
  function numericRead(f,eye){return '<table class="cb-table"><thead><tr><th>Parâmetro</th><th>Valor</th><th>Referência</th></tr></thead><tbody>'+numericCriteria.map(function(n){var v=f['parameter_'+eye+'_'+n[0]],s=M.referenceSignal(n[0],v);return '<tr><td>'+esc(n[1])+'</td><td>'+esc(v==null||v===''?'—':v)+'</td><td><span class="cb-dot '+s+'"></span> '+({ok:'Favorável',warn:'Atenção',crit:'Maior preocupação',off:'Sem classificação'}[s])+'</td></tr>';}).join('')+'</tbody></table>';}
  function cases(){var cs=rows('cases');return head('casos','Ficha PGZ, exames, parecer e feedback reunidos na sua fila.')+button('Enviar caso clínico','case-new','',true)+'<br><br>'+(cs.length?'<div class="cb-table-wrap"><table class="cb-table"><thead><tr><th>Código</th><th>Enviado em</th><th>Situação</th><th></th></tr></thead><tbody>'+cs.map(function(c){return '<tr><td>'+esc(c.code)+'</td><td>'+date(c.created_at)+'</td><td>'+({waiting:'Aguardando análise',answered:'Respondido · aguardando feedback',completed:'Concluído'}[c.status])+'</td><td>'+button('Abrir caso','case',c.id)+'</td></tr>';}).join('')+'</tbody></table></div>':empty('Nenhum caso enviado. Use apenas código e iniciais; os exames devem estar desidentificados.'))+'<div class="cb-section"><h2>Quadro de referência rápida</h2></div>'+reference()+'<p class="cb-note">Parâmetros transcritos do material de referência fornecido pelo Club. A decisão de lente e o racional são registrados pelo médico responsável. Identificação por código/iniciais; exames somente com consentimento.</p>';}
  function reference(){return '<div class="cb-table-wrap"><table class="cb-table"><thead><tr><th>Critério</th><th>Favorável</th><th>Atenção</th><th>Maior preocupação</th></tr></thead><tbody>'+[
    ['Superfície','Estável, sem ceratite','BUT reduzido; MGD','Medidas instáveis'],['Congruência','Δ ≤ 0,5 D; eixo ≤ 15°','Rever aquisição','Divergência persistente'],['Endotélio','≥ 2.000 cél/mm²','1.500 a < 2.000','< 1.500'],['Pupila mesópica','Contextualizar com tarefa','> 6–6,5 mm','Sem corte isolado'],['Chord µ','Contextualizar alinhamento','Repetir e contextualizar','Sem corte isolado'],['AE corneana','Até 0,40 µm','> 0,40 a 0,50','> 0,60 · intervalo 0,50–0,60 sem corte fornecido'],['RMS HOA · 4 mm','< 0,30 µm','0,30 a < 0,50','≥ 0,50'],['Coma / Trefoil · 4 mm','< 0,20 µm','0,20 a < 0,30','≥ 0,30'],['Mácula / NO','Grau / estágio 0','Grau / estágio 1','Graus / estágios 2–3']
  ].map(function(r){return '<tr>'+r.map(function(v){return '<td>'+esc(v)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>';}
  function modulePage(){return head('modulos','Módulos à parte · produtos separados dos 12 degraus.')+modules()+'<div class="cb-section"><button class="btn" data-nav="iris">Abrir painel da Íris Black</button></div>';}
  function network(){
    if(!admin())return '';
    var members=state.options.members.filter(function(m){return m.ativo!==false;});
    return '<div class="cb-head"><div><span class="cb-kicker">Administração</span><h1>A Rede</h1><p>'+members.length+' membros ativos · cadastros e implantação.</p></div><button class="btn" data-nav="members">Abrir Progressão</button></div><div class="cb-table-wrap"><table class="cb-table"><thead><tr><th>Membro</th><th>Turma</th><th>Fase</th><th></th></tr></thead><tbody>'+members.map(function(m){return '<tr><td>'+esc(m.nome)+'</td><td>'+esc(m.turma||'—')+'</td><td>'+esc(m.fase||'—')+'</td><td><a class="cb-link" href="/membros/?membro='+encodeURIComponent(m.id)+'">Ver como membro</a></td></tr>';}).join('')+'</tbody></table></div>';
  }
  var renderers={subida:subida,pendencias:pendencias,ranking:ranking,vitrine:vitrine,casos:cases,encontro:encontro,iris:iris,modulos:modulePage,rede:network,graduacao:placar};
  function render(){
    Object.keys(renderers).forEach(function(key){var el=document.getElementById('black-'+key);if(!el)return;
      el.innerHTML=state.loading?'<div class="cb-loading" role="status">Carregando '+esc(labels[key]||'placar')+'…</div>':
        state.error?'<div class="cb-notice" role="alert">'+esc(state.error)+' '+button('Tentar novamente','reload')+'</div>':renderers[key]()+footer();
    });
    if(state.options&&state.options.onDeliveriesChange)state.options.onDeliveriesChange();
    document.querySelectorAll('[data-nav="pendencias"] .cb-badge').forEach(function(n){n.remove();});
    if(!state.loading&&!state.error&&pending().length)document.querySelectorAll('[data-nav="pendencias"]').forEach(function(n){var b=document.createElement('span');b.className='cb-badge';b.textContent=pending().length;n.appendChild(b);});
  }
  async function list(table,filters){var result=[],start=0;while(true){var q=C.sb.from(table).select('*').order(table==='cb_quarters'?'period':table==='cb_steps'?'method_step':'id');Object.keys(filters||{}).forEach(function(k){q=q.eq(k,filters[k]);});var chunk=ok(await q.range(start,start+999))||[];result=result.concat(chunk);if(chunk.length<1000)return result;start+=1000;}}
  async function load(){
    var version=++state.request,id=state.member.id,period=state.period;
    state.loading=true;state.error=null;state.rankingLoading=true;state.rankingError=false;state.data={};state.crm=null;state.ig=[];render();
    var tasks={checklistProgress:['cb_checklist_progress',{member_id:id}],quarters:['cb_quarters',{member_id:id,period:period}],steps:['cb_steps',{member_id:id}],missions:['cb_missions',{member_id:id,period:period}],extras:['cb_extras',{member_id:id}],encontros:['cb_encontros',{member_id:id,period:period}],grades:['cb_grades',{member_id:id}],redemptions:['cb_redemptions',{member_id:id}],cases:['cb_cases',{member_id:id}],files:['cb_case_files',{member_id:id}],allRewards:['cb_rewards',{}]};
    if(admin())tasks.queue=['cb_redemptions',{}];
    var keys=Object.keys(tasks);var results=await Promise.allSettled(keys.map(function(k){return list(tasks[k][0],tasks[k][1]);}));
    if(version!==state.request)return;
    var failed=[];results.forEach(function(r,i){if(r.status==='fulfilled')state.data[keys[i]]=r.value;else{state.data[keys[i]]=[];failed.push(keys[i]);}});
    state.data.rewards=rows('allRewards').filter(function(r){return r.period===period&&r.active;});
    if(failed.length)state.error='Algumas fontes do Método estão indisponíveis. A equipe precisa conferir a conexão e a atualização do painel. Nenhum dado de exemplo é exibido.';
    state.loading=false;render();
    var range=M.bounds(period);
    var others=await Promise.allSettled([
      C.sb.rpc('cb_ranking',{p_period:period}).then(ok),
      C.sb.from('member_graduations').select('member_id,source_date,is_demo,snapshot').eq('member_id',id).then(ok),
      C.sb.functions.invoke('farol-metricas',{body:{member_id:id,preset:'custom',from:range.start,to:range.end}}).then(ok),
      C.sb.from('instagram_serie').select('dia,seguidores').eq('member_id',id).gte('dia',range.start).lte('dia',range.end).order('dia').then(ok),
      C.sb.from('cb_scores').select('*').eq('member_id',id).order('period').then(ok)
    ]);
    if(version!==state.request)return;
    state.rankingLoading=false;state.rankingError=others[0].status!=='fulfilled';
    state.data.ranking=others[0].status==='fulfilled'?others[0].value:[];
    state.data.legacy=others[1].status==='fulfilled'?others[1].value:[];
    state.crm=others[2].status==='fulfilled'?others[2].value:null;state.ig=others[3].status==='fulfilled'?others[3].value:[];
    state.data.history=others[4].status==='fulfilled'?others[4].value:[];
    render(); if(drawerId){if(drawerId.includes('/'))openDelivery(drawerId);else if(/^D\d{2}$/.test(drawerId)||drawerId==='TREINO')openStep(drawerId);}
  }
  function open(title,body,id,popup){
    if(!drawer){previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;overlay=document.createElement('div');overlay.className='cb-overlay';drawer=document.createElement('aside');drawer.className='cb cb-drawer';drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-label',title);overlay.addEventListener('click',close);document.body.append(overlay,drawer);document.body.style.overflow='hidden';}
    drawerId=id||null;drawer.classList.toggle('cb-popup',!!popup);drawer.setAttribute('aria-label',title);drawer.innerHTML='<button type="button" class="cb-close" data-cb-close aria-label="Fechar painel">×</button><div class="cb-head"><h2>'+esc(title)+'</h2></div>'+(popup?'<div class="cb-popup-content">'+body+'</div>':body);drawer.scrollTop=0;drawer.querySelector('.cb-close').focus();
  }
  function close(){if(drawer&&/^#subida\/(D\d{2}|TREINO)/.test(location.hash))history.replaceState(null,'',location.pathname+location.search+'#subida');if(drawer)drawer.remove();if(overlay)overlay.remove();drawer=overlay=null;drawerId=null;activeDelivery=null;document.body.style.overflow=previousOverflow;if(previousFocus&&previousFocus.isConnected)previousFocus.focus();}
  function field(label,name,value,type,required){return '<label>'+esc(label)+(type==='textarea'?'<textarea name="'+name+'" maxlength="4000"'+(required?' required':'')+'>'+esc(value||'')+'</textarea>':'<input name="'+name+'" type="'+(type||'text')+'" value="'+esc(value==null?'':value)+'"'+(type==='number'?' step="any"':' maxlength="500"')+(required?' required':'')+'>')+'</label>';}
  function select(label,name,options,value){return '<label>'+esc(label)+'<select name="'+name+'">'+options.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(value)?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select></label>';}
  function check(label,name,value){return '<label class="cb-check"><input type="checkbox" name="'+name+'"'+(value?' checked':'')+'>'+esc(label)+'</label>';}
  function form(body,action,id){return '<form class="cb-form" data-cb-form="'+action+'" data-id="'+esc(id||'')+'">'+body+'<div class="cb-form-error" role="alert"></div><button class="btn btn-primary" type="submit">Salvar registro</button></form>';}
  function openStep(id,tab){
    activeDelivery=null;
    if(state.loading||state.error){open('Entregas do degrau',empty(state.error||'Carregando entregas…'),id);return;}
    if(id==='TREINO'){open('Treino de Competição',stepDeliveries(id),id);return;} var step=M.steps.find(function(s){return s.id===id;});if(!step)return;tab=tab||'audit';
    var record=rows('steps').find(function(s){return s.method_step===id;})||{};
    var body='<span class="cb-kicker">'+id+' · '+step.movement+'</span>'+badge(status(id))+'<p>'+esc(step.definition)+'</p><div class="cb-tabs" role="tablist">'+[['audit','Entregas'],['metrics','Métricas'],['points','Pontos & missões']].map(function(t){return '<button role="tab" aria-selected="'+(tab===t[0])+'" data-cb-tab="'+t[0]+'" data-step="'+id+'">'+t[1]+'</button>';}).join('')+'</div>';
    if(tab==='metrics')body+='<table class="cb-table"><thead><tr><th>O que o Cérebro lê</th><th>Valor</th><th>Fonte</th></tr></thead><tbody>'+step.metrics.map(function(x){var m=metric(id,x[0]);return '<tr><td>'+esc(x[1])+'</td><td>'+metricText(m,x[2])+'</td><td><span class="cb-source">'+m.source+'</span><small>'+ (m.stamp?date(m.stamp):'Não medido')+'</small></td></tr>';}).join('')+'</tbody></table><p class="cb-note">CRM e Instagram: '+state.period+'. Lançamentos manuais mostram a data da última conferência.</p>'+(admin()?button('Registrar métricas','step-edit',id):'');
    if(tab==='audit')body+=stepDeliveries(id);
    if(tab==='points')body+='<div class="cb-notice">'+esc(step.points)+'. Entregas do Club têm peso zero. Missões só entram na régua quando solicitadas e verificadas.</div>'+pendingList(pending().filter(function(m){return m.step===id;}))+(admin()?button('Solicitar missão neste degrau','mission-new',id):'');
    if(id==='D08')body+='<div class="cb-section"><button class="btn" data-nav="encontro" data-cb-dismiss>Abrir edições do Encontro Grau Zero</button></div>';
    open(id+' · '+step.name,body,id);
    history.replaceState(null,'',location.pathname+location.search+'#subida/'+id);
  }
  function editStep(id){var s=M.steps.find(function(s){return s.id===id;}),r=rows('steps').find(function(r){return r.method_step===id;})||{};open('Registrar · '+s.name,'<p class="cb-note">Métricas que pontuam são registradas na apuração do trimestre.</p>'+button('Apurar rotina e resultado','quarter')+form('<fieldset><legend>Métricas manuais</legend>'+s.metrics.filter(function(m){return !scoreMetric(id,m[0]);}).map(function(m){return field(m[1]+(m[2]?' ('+m[2]+')':''),'metric_'+m[0],r.metrics&&r.metrics[m[0]]);}).join('')+'</fieldset>'+field('Evidência / observação da conferência','evidence',r.evidence,'textarea',true),'step',id));}
  function missionForm(id,step,legacy){var m=rows('missions').find(function(m){return m.id===id;})||legacy||{};var body='';if(admin()){body='<input type="hidden" name="checklist_item_id" value="'+esc(m.checklist_item_id||'')+'"><input type="hidden" name="artifact_step_id" value="'+esc(m.artifact_step_id||'')+'">'+field('Missão solicitada','title',m.title,'text',true)+select('Degrau','method_step',M.steps.map(function(s){return [s.id,s.id+' · '+s.name];}),m.method_step||step||'D01')+select('Peso','weight',[[1,'Aplicação · 1'],[0.5,'Colaboração · ½'],[0,'Entregável do Club · 0']],m.weight==null?1:m.weight)+'<div class="cb-form-row">'+field('Data do pedido','requested_on',m.requested_on||today(),'date',true)+field('Prazo','due_on',m.due_on,'date',true)+'</div>'+select('Situação','status',[['requested','Solicitada'],['submitted','Evidência enviada'],['verified','Verificada'],['cancelled','Cancelada']],m.status||'requested');}else body='<p>'+esc(m.title)+'</p><p class="cb-note">A equipe verificará a evidência antes de concluir a missão e atualizar os pontos.</p>';body+=field('Evidência (descrição ou link de entrega)','evidence',m.evidence,'textarea',true);open(admin()?'Missão de execução':'Enviar evidência',form(body,'mission',legacy?null:m.id));}
  function quarterForm(){var q=rows('quarters')[0]||{};var fields=[['Presenças','attended'],['Encontros elegíveis','eligible'],['Créditos semanais de vídeo','video_credits'],['Semanas elegíveis','weeks'],['Crescimento de seguidores no trimestre','followers_growth'],['Leads órfãos','orphan_leads'],['Desfechos registrados (%)','outcomes_percent'],['CPV / ticket (%)','cpv_percent'],['Chamada → consulta (%)','call_conversion']];open('Apurar rotina e resultado · '+state.period,form('<p class="cb-note">Deixe em branco o que ainda não foi medido. Créditos de vídeo: até 1 por semana (3 ou mais vídeos). Encontro Grau Zero é apurado na área de edições.</p>'+fields.map(function(f){return field(f[0],f[1],q[f[1]],'number');}).join('')+select('SLA registrado','sla_recorded',[['','Não medido'],['true','Sim'],['false','Não']],q.sla_recorded==null?'':String(q.sla_recorded))+field('Fonte e evidência da apuração','evidence',q.evidence,'textarea',true),'quarter'));}
  function extraForm(kind,reference){open('Fora da régua · '+state.period,form(select('Fonte','kind',[['bonus','Bônus do Dr. Alex · 10'],['referral','Indicação convertida · 25 + voucher'],['module','Ativação de módulo · 5']],kind||'referral')+field('Referência única (para módulo: iris ou fabrica)','reference',reference,'text',true)+field('Evidência da concessão / conversão / contratação','evidence','','textarea',true),'extra'));}
  function encontroForm(id){var r=rows('encontros').find(function(e){return e.id===id;})||{};open('Encontro Grau Zero',form(field('Data da edição','edition',r.edition,'date',true)+check('Divulgou no perfil marcando @dralexsa','publicized',r.publicized)+check('Enviou vídeo para o grupo','video_group',r.video_group)+check('Enviou vídeo para o tráfego','video_ads',r.video_ads)+check('Presença ao vivo no pitch','attended',r.attended)+field('Leads direcionados à clínica','leads',r.leads,'number')+field('Evidência da conferência','evidence',r.evidence,'textarea',true),'encontro',id));}
  function rewardForm(){open('Publicar benefício',form(field('Benefício','title','','text',true)+field('Condições do resgate','description','','textarea',true)+field('Vagas disponíveis','stock','','number',true)+field('Abertura','opens_at','','datetime-local',true)+field('Encerramento','closes_at','','datetime-local',true),'reward'));}
  function caseForm(){open('Novo caso · Protocolo Grau Zero',form('<p class="cb-note">Use código e iniciais. Remova nome, CPF e outros identificadores dos PDFs antes de anexar. Limite: 150 MB por PDF.</p>'+field('Código MGZ','code','MGZ-','text',true)+'<div class="cb-form-row">'+field('Iniciais','initials','','text',true)+field('Idade','age','','number',true)+'</div>'+select('Sexo','sex',[['NI','Não informado'],['F','Feminino'],['M','Masculino']],'NI')+['OD','OE'].map(function(eye){return '<fieldset><legend>'+eye+'</legend>'+field('AVCC / Refração','avcc_'+eye,'','text',true)+field('Biomicroscopia','bio_'+eye,'','text',true)+indication.map(function(n,i){return field((i+1)+'. '+n,'ind_'+eye+'_'+i,'','text',true);}).join('')+'</fieldset>'+numericFields(eye);}).join('')+'<fieldset><legend>Sete critérios para customizar</legend>'+customization.map(function(n,i){return field((i+1)+'. '+n,'custom_'+i,'','text',true);}).join('')+'</fieldset>'+field('Pergunta / hipótese do Mestre','question','','textarea',true)+'<label>Exames PDF<input name="files" type="file" accept="application/pdf" multiple></label><label class="cb-check"><input name="consent" type="checkbox" required>Confirmo o consentimento e a desidentificação dos exames.</label>','case'));}
  function openCase(id){var c=rows('cases').find(function(c){return c.id===id;});if(!c)return;var f=c.form||{};var body='<span class="cb-chip">'+esc(c.code)+'</span><p>'+esc(c.initials)+' · '+c.age+' anos · '+esc(c.sex)+'</p><h3>Pergunta do Mestre</h3><p>'+esc(c.question)+'</p>'+['OD','OE'].map(function(eye){return '<details><summary>'+eye+' · indicação</summary><p>AVCC / Refração: '+esc(f['avcc_'+eye])+'</p><p>BIO: '+esc(f['bio_'+eye])+'</p>'+indication.map(function(n,i){return '<p><b>'+esc(n)+'</b><br>'+esc(f['ind_'+eye+'_'+i])+'</p>';}).join('')+numericRead(f,eye)+'</details>';}).join('')+'<details><summary>Customização</summary>'+customization.map(function(n,i){return '<p><b>'+esc(n)+'</b><br>'+esc(f['custom_'+i])+'</p>';}).join('')+'</details><div class="cb-section"><h3>Exames privados</h3></div>'+rows('files').filter(function(x){return x.case_id===id;}).map(function(x,i){return button('Exame '+(i+1)+' · '+fmt(x.size_bytes/1048576)+' MB','file',x.id);}).join('')+'<div class="cb-section"><h3>Anexar exames</h3></div>'+form('<label>PDFs desidentificados (até 150 MB)<input name="files" type="file" accept="application/pdf" multiple required></label>','case-files',id);
    if(c.lens)body+='<div class="cb-notice"><b>Decisão registrada: '+esc(c.lens)+'</b><br>'+esc(c.rationale)+'</div>';
    if(c.feedback)body+='<h3>Feedback pós-operatório</h3><p>'+esc(c.feedback)+'</p>';
    if(admin())body+=form(field('Decisão de lente','lens',c.lens,'text',true)+field('Racional do Dr. Alex','rationale',c.rationale,'textarea',true)+select('Situação','status',[['answered','Respondido · aguardando feedback'],['completed','Concluído']],c.status==='completed'?'completed':'answered')+field('Receita vinculada ao caso (R$)','revenue',c.revenue,'number'),'case-review',id);
    else if(c.status==='answered')body+=form(field('Feedback pós-operatório','feedback',c.feedback,'textarea',true),'case-feedback',id);
    open(c.code+' · Protocolo Grau Zero',body);
  }
  async function save(table,row,conflict){if(state.error)throw new Error('Atualize as fontes antes de salvar, para preservar os registros existentes.');var q=conflict?C.sb.from(table).upsert(row,{onConflict:conflict}):row.id?C.sb.from(table).update(row).eq('id',row.id):C.sb.from(table).insert(row);return ok(await q.select().single());}
  async function upload(caseId,files,progress){
    for(var i=0;i<files.length;i++){
      var file=files[i];if(file.type!=='application/pdf'||file.size>157286400)throw new Error('Envie PDFs de até 150 MB.');
      var session=ok(await C.sb.auth.getSession()).session;if(!session)throw new Error('Sessão expirada. Entre novamente.');
      var path=state.member.id+'/'+caseId+'/'+crypto.randomUUID()+'.pdf';
      var base=C.sb.supabaseUrl.replace(/\/$/,'');
      try{var host=new URL(base);if(/^[^.]+\.supabase\.co$/.test(host.hostname)){host.hostname=host.hostname.replace('.supabase.co','.storage.supabase.co');base=host.origin;}}catch(ignore){}
      var api=base+'/storage/v1/upload/resumable';
      var metadata={bucketName:'pgz-exams',objectName:path,contentType:'application/pdf',cacheControl:'3600'};
      var headers={'Authorization':'Bearer '+session.access_token,'Tus-Resumable':'1.0.0','Upload-Length':String(file.size),'Upload-Metadata':Object.keys(metadata).map(function(k){return k+' '+btoa(metadata[k]);}).join(',')};
      var created=await fetch(api,{method:'POST',headers:headers});if(!created.ok)throw new Error('Não foi possível iniciar o envio do PDF. Confira o limite de arquivos do projeto.');
      var location=created.headers.get('Location');if(!location)throw new Error('Servidor não retornou o endereço do upload.');
      var url=new URL(location,api);if(url.origin!==new URL(api).origin)throw new Error('Endereço de upload não autorizado.');
      var offset=0,retries=0;
      while(offset<file.size){
        progress.textContent='Enviando exame '+(i+1)+'/'+files.length+' · '+Math.round(offset/file.size*100)+'%';
        try{var result=await fetch(url.href,{method:'PATCH',headers:{'Authorization':headers.Authorization,'Tus-Resumable':'1.0.0','Upload-Offset':String(offset),'Content-Type':'application/offset+octet-stream'},body:file.slice(offset,offset+6*1024*1024)});if(!result.ok)throw new Error('Falha de conexão durante o upload.');var next=Number(result.headers.get('Upload-Offset'));if(!Number.isFinite(next)||next<=offset)throw new Error('Progresso de upload inválido.');offset=next;retries=0;}
        catch(err){if(++retries>2)throw new Error('O caso foi salvo, mas o PDF não terminou de enviar. Reabra o caso para anexar o exame.');var resume=await fetch(url.href,{method:'HEAD',headers:{'Authorization':headers.Authorization,'Tus-Resumable':'1.0.0'}});if(!resume.ok)throw err;var resumed=Number(resume.headers.get('Upload-Offset'));if(!Number.isFinite(resumed)||resumed<0||resumed>file.size)throw err;offset=resumed;}
      }
      await save('cb_case_files',{member_id:state.member.id,case_id:caseId,path:path,size_bytes:file.size});
    }
  }
  async function submit(f){
    var action=f.dataset.cbForm,d=Object.fromEntries(new FormData(f)),row={member_id:state.member.id},id=f.dataset.id,b=f.querySelector('[type=submit]'),error=f.querySelector('.cb-form-error');
    b.disabled=true;error.textContent='';
    try{
      if(action==='step'){var s=M.steps.find(function(s){return s.id===id;});row.method_step=id;var previous=rows('steps').find(function(r){return r.method_step===id;})||{};row.status=previous.status||'pending';row.checks=previous.checks||[];row.metrics={};s.metrics.filter(function(m){return !scoreMetric(id,m[0]);}).forEach(function(m){var v=d['metric_'+m[0]];row.metrics[m[0]]=v===''?null:M.number(v)==null?v:Number(v);});row.evidence=d.evidence;await save('cb_steps',row,'member_id,method_step');}
      if(action==='checklist'){var item=(C.stepChecklist||[]).find(function(i){return i.id===id;});if(!admin()||!item||item.source!=='MANUAL')throw new Error('Somente a equipe pode conferir itens manuais.');Object.assign(row,{item_id:id,edition:d.edition||'',done:!!d.done,evidence:d.evidence||null});await save('cb_checklist_progress',row,'member_id,item_id,edition');}
      if(action==='mission'){row.id=id||undefined;row.evidence=d.evidence;if(admin()){Object.assign(row,{period:state.period,title:d.title,artifact_step_id:d.artifact_step_id||null,checklist_item_id:d.checklist_item_id||null,method_step:d.method_step,weight:Number(d.weight),requested_on:d.requested_on,due_on:d.due_on,status:d.status});}else{row.status='submitted';}await save('cb_missions',row);}
      if(action==='quarter'){row.period=state.period;['attended','eligible','video_credits','weeks','followers_growth','orphan_leads','outcomes_percent','cpv_percent','call_conversion'].forEach(function(k){row[k]=M.number(d[k]);});row.sla_recorded=d.sla_recorded===''?null:d.sla_recorded==='true';row.evidence=d.evidence;await save('cb_quarters',row,'member_id,period');}
      if(action==='extra'){Object.assign(row,{period:state.period,kind:d.kind,reference:d.reference.trim(),evidence:d.evidence});await save('cb_extras',row);}
      if(action==='grade'){Object.assign(row,{period:state.period,grade:Number(d.grade),evidence:d.evidence});await save('cb_grades',row);}
      if(action==='encontro'){Object.assign(row,{id:id||undefined,period:state.period,edition:d.edition,publicized:!!d.publicized,video_group:!!d.video_group,video_ads:!!d.video_ads,attended:!!d.attended,leads:M.number(d.leads),evidence:d.evidence});await save('cb_encontros',row);}
      if(action==='reward')await save('cb_rewards',{period:state.period,title:d.title,description:d.description,stock:Number(d.stock),opens_at:new Date(d.opens_at).toISOString(),closes_at:new Date(d.closes_at).toISOString()});
      if(action==='case'){var files=Array.from(f.querySelector('[name=files]').files);files.forEach(function(x){if(x.type!=='application/pdf'||x.size>157286400)throw new Error('Envie apenas PDFs de até 150 MB.');});var payload={};Object.keys(d).filter(function(k){return /^(avcc_|bio_|ind_|custom_|parameter_)/.test(k);}).forEach(function(k){payload[k]=d[k];});Object.assign(row,{code:d.code,initials:d.initials,age:Number(d.age),sex:d.sex,form:payload,question:d.question,consent:!!d.consent});var created=await save('cb_cases',row);f.dataset.cbForm='case-files';f.dataset.id=created.id;await upload(created.id,files,error);}
      if(action==='case-files')await upload(id,Array.from(f.querySelector('[name=files]').files),error);
      if(action==='case-review')await save('cb_cases',{id:id,lens:d.lens,rationale:d.rationale,status:d.status,revenue:M.number(d.revenue)});
      if(action==='case-feedback')await save('cb_cases',{id:id,feedback:d.feedback});
      var returnDelivery=action==='checklist'?activeDelivery:null,returnStep=action==='checklist'?item.step:action==='encontro'?'D08':null;close();await load();if(returnDelivery)openDelivery(returnDelivery);else if(returnStep)openStep(returnStep);C.toast('Registro salvo.','check-circle');
    }catch(err){error.textContent=err.message||'Não foi possível salvar.';b.disabled=false;}
  }
  function install(options){
    var previous=state.member&&state.member.id;
    state.options=options;state.member=options.member||options.members.find(function(m){return m.id===previous&&m.ativo!==false;})||options.members.find(function(m){return m.ativo!==false;});if(!state.member)return;
    views.forEach(function(k){if(k==='rede'&&!admin())return;if(document.getElementById('black-'+k))return;var el=document.createElement('section');el.className='view';el.dataset.view=k;el.hidden=true;el.innerHTML='<div class="cb" id="black-'+k+'"></div>';document.querySelector('.main').appendChild(el);});
    var agenda=document.querySelector('[data-view=agenda]');if(agenda&&!agenda.querySelector('[data-nav=encontro]')){var shortcut=document.createElement('div');shortcut.className='cb-section';shortcut.innerHTML='<button class="btn" data-nav="encontro">Edições e entregas · Encontro Grau Zero</button>';agenda.prepend(shortcut);}
    var grad=document.querySelector('[data-view=graduacao]');if(grad&&!document.getElementById('black-graduacao')){var el=document.createElement('div');el.id='black-graduacao';el.className='cb';grad.prepend(el);}
    load();
  }
  function enter(key){state.active=key;if(!state.options)return;var parts=M.canonical(location.hash).split('/');if(key==='subida'&&parts[0]==='subida'&&/^(D(0[1-9]|1[0-2])|TREINO)$/.test(parts[1]||''))openStep(parts[1]);}
  document.addEventListener('submit',function(e){var f=e.target.closest('[data-cb-form]');if(f){e.preventDefault();submit(f);}});
  document.addEventListener('change',function(e){if(e.target.matches('[data-cb-edition]')){selectedEdition=e.target.value;render();if(activeDelivery)openDelivery(activeDelivery);else openStep('D08');}if(e.target.matches('[data-cb-member]')){state.member=state.options.members.find(function(m){return m.id===e.target.value;});close();load();}if(e.target.matches('[data-cb-period]')){state.period=e.target.value;close();load();}});
  document.addEventListener('keydown',function(e){if(!drawer)return;if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){var nodes=Array.from(drawer.querySelectorAll('button,input,select,textarea,a[href]')).filter(function(n){return !n.disabled&&n.offsetParent!==null;}),first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  document.addEventListener('click',async function(e){
    var el=e.target.closest('[data-cb-delivery],[data-cb-artifact],[data-cb-item],[data-cb-item-mission],[data-cb-legacy],[data-cb-rank-snapshot],[data-cb-step],[data-cb-tab],[data-cb-close],[data-cb-dismiss],[data-cb-reload],[data-cb-mission],[data-cb-mission-new],[data-cb-quarter],[data-cb-extra],[data-cb-grade],[data-cb-step-edit],[data-cb-module],[data-cb-encontro-new],[data-cb-encontro-edit],[data-cb-reward-new],[data-cb-redeem],[data-cb-redemption],[data-cb-case-new],[data-cb-case],[data-cb-file]');if(!el||!state.options)return;
    try{
      var d=el.dataset;
      if('cbClose'in d||'cbDismiss'in d)close();
      if('cbReload'in d)await load();
      if('cbStep'in d)openStep(d.cbStep);
      if('cbDelivery'in d)openDelivery(d.cbDelivery);
      if('cbArtifact'in d){if(d.delivery)openDelivery(d.delivery);else{activeDelivery=null;openArtifact(d.cbArtifact,d.back);}}
      if('cbTab'in d)openStep(d.step,d.cbTab);
      if('cbMission'in d)missionForm(d.cbMission);
      if(admin()){
        if('cbItem'in d)itemForm(d.cbItem);
        if('cbItemMission'in d){var item=C.stepChecklist.find(function(i){return i.id===d.cbItemMission;});if(item)missionForm(null,item.step,{checklist_item_id:item.id,title:item.id==='D11-01'?'Padronizar 3 rituais de encantamento':item.title,method_step:item.step,weight:item.missionWeight});}
        if('cbMissionNew'in d)missionForm(null,d.cbMissionNew);
        if('cbLegacy'in d){var legacy=pending().find(function(p){return p.artifact_step_id===d.cbLegacy;});missionForm(null,legacy.step,legacy);}
        if('cbStepEdit'in d)editStep(d.cbStepEdit);
        if('cbQuarter'in d)quarterForm();
        if('cbExtra'in d)extraForm();
        if('cbGrade'in d)open('Registrar grau conferido',form(field('Grau conferido (0–10)','grade',grade()+1,'number',true)+field('Parecer e evidência','evidence','','textarea',true),'grade'));
        if('cbEncontroNew'in d)encontroForm();
        if('cbEncontroEdit'in d)encontroForm(d.cbEncontroEdit);
        if('cbRewardNew'in d)rewardForm();
        if('cbRankSnapshot'in d){ok(await C.sb.rpc('cb_snapshot_ranking',{p_period:state.period}));C.toast('Referência semanal registrada.','check-circle');await load();}
        if('cbRedemption'in d){var redemption=rows('redemptions').concat(rows('queue')).find(function(r){return r.id===d.cbRedemption;});await save('cb_redemptions',{id:redemption.id,status:redemption.status==='requested'?'confirmed':'completed'});await load();}
      }
      if('cbModule'in d){var name=d.cbModule==='iris'?'Íris Black':'Fábrica de Conteúdo Black';open(name,artifactCards(visibleArtifacts().filter(function(a){return d.cbModule==='iris'?/íris|iris/i.test(a.nome):/f[aá]brica de conte[uú]do/i.test(a.nome);}),null)+'<p>Produto contratado e entregue à parte. A ativação vale +5 pontos, uma única vez, no trimestre da contratação.</p>'+(admin()?button('Registrar contratação','extra'):'<p>Fale com a equipe no seu grupo de Operação para conhecer o módulo e as condições de contratação.</p><button class="btn" data-nav="profile" data-cb-dismiss>Abrir contato do Club</button>'));}
      if('cbRedeem'in d){el.disabled=true;ok(await C.sb.rpc('cb_redeem',{p_reward:d.cbRedeem,p_member:state.member.id}));await load();}
      if('cbCaseNew'in d)caseForm();
      if('cbCase'in d)openCase(d.cbCase);
      if('cbFile'in d){var file=rows('files').find(function(f){return f.id===d.cbFile;});var url=ok(await C.sb.storage.from('pgz-exams').createSignedUrl(file.path,60));var a=document.createElement('a');a.href=url.signedUrl;a.target='_blank';a.rel='noopener noreferrer';a.click();}
    }catch(err){C.toast(err.message||'Não foi possível concluir a ação.','alert');el.disabled=false;}
  });
  C.black={deliveryCards:deliveryCards,install:install,enter:enter,selected:function(){return state.member&&state.member.id;},close:close};
})();
