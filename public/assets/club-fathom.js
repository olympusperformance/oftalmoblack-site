(function(){
  'use strict';
  var C=window.Club,esc=C.esc,$=function(id){return document.getElementById(id);};
  var actions=[],staff=[],members=[],demands=[],filter='pending',busy=false;
  var labels={needs_identity:'Responsável a definir',needs_confirmation:'Confirmar se ainda é pendência',approved:'Aprovada · criada no quadro',linked:'Aprovada · vinculada à existente',context:'Contexto · sem demanda'};
  function options(rows,current,placeholder){return '<option value="">'+esc(placeholder)+'</option>'+rows.map(function(r){return '<option value="'+esc(r.id)+'"'+(r.id===current?' selected':'')+'>'+esc(r.nome||r.titulo)+'</option>';}).join('');}
  function name(rows,id,fallback){var r=rows.find(function(r){return r.id===id;});return r?r.nome:fallback;}
  function pending(a){return a.status==='needs_identity'||a.status==='needs_confirmation';}
  function message(s,error){$('fathomMessage').textContent=s;$('fathomMessage').className=error?'fathom-error':'';}
  async function allRows(query){var data=[],offset=0;while(true){var r=await query().range(offset,offset+999);if(r.error)throw r.error;data=data.concat(r.data);if(r.data.length<1000)return {data:data};offset+=1000;}}
  async function load(){
    if(busy)return;busy=true;$('fathomRefresh').disabled=true;
    try{
      var results=await Promise.all([allRows(function(){return C.sb.from('fathom_actions').select('*').order('occurred_at',{ascending:false}).order('id');}),C.sb.from('staff').select('id,nome').eq('ativo',true).order('nome'),C.sb.from('members').select('id,nome').eq('ativo',true).order('nome'),allRows(function(){return C.sb.from('demands').select('id,titulo,member_id,responsaveis,status').is('excluida_em',null).order('id');})]);
      results.forEach(function(r){if(r.error)throw r.error;});actions=results[0].data;staff=results[1].data;members=results[2].data;demands=results[3].data;
      var selected=$('fathomMeeting').value,seen={};$('fathomMeeting').innerHTML='<option value="">Todas as reuniões</option>'+actions.filter(function(a){if(seen[a.extraction_id])return false;seen[a.extraction_id]=true;return true;}).map(function(a){return '<option value="'+esc(a.extraction_id)+'">'+esc(date(a.occurred_at)+' · '+a.meeting_title)+'</option>';}).join('');
      $('fathomMeeting').value=seen[selected]?selected:'';
      message(actions.filter(pending).length+' ações para definir · '+actions.filter(function(a){return a.demand_id;}).length+' aprovadas · '+actions.filter(function(a){return a.status==='context';}).length+' de contexto');render();
    }catch(e){message('Não foi possível carregar: '+e.message,true);}finally{busy=false;$('fathomRefresh').disabled=false;}
  }
  function date(s){return new Date(s).toLocaleString('pt-BR',{timeZone:'America/Manaus',dateStyle:'short',timeStyle:'short'});}
  function render(){
    var meeting=$('fathomMeeting').value,rows=actions.filter(function(a){return (!meeting||a.extraction_id===meeting)&&(filter==='pending'?pending(a):filter==='approved'?!!a.demand_id:a.status==='context');});
    var last='';$('fathomList').innerHTML=rows.length?rows.map(function(a){var header='';if(a.extraction_id!==last){last=a.extraction_id;header='<h2 class="fathom-meeting">'+esc(date(a.occurred_at)+' · '+a.meeting_title)+'</h2>';}
      var source=/^https:\/\/fathom\.video\/calls\/\d+(?:[/?#].*)?$/.test(a.source_url)?'<a href="'+esc(a.source_url)+'" target="_blank" rel="noopener noreferrer">Ver reunião</a>':'';
      return header+'<article class="fathom-card" data-id="'+esc(a.id)+'"><span class="fathom-state">'+esc(labels[a.status])+'</span><h3>'+esc(a.titulo)+'</h3><div class="fathom-meta"><span>'+esc(name(members,a.member_id,'Sem mentorado vinculado'))+'</span><span>'+a.record_indices.length+' registro(s) de origem</span>'+source+'</div><p>'+esc(a.reason)+'</p><details><summary>Ver evidências da conversa</summary>'+a.evidence.map(function(e){return '<blockquote>'+esc(e.quote)+'<small>'+esc((e.speaker_name||'Falante')+' · '+(e.timestamp||'Trecho '+e.segment_id))+'</small></blockquote>';}).join('')+'</details>'+(pending(a)?'<form class="fathom-form"><label>Responsável do nosso time<select class="inp" name="staff" required>'+options(staff,null,'Selecione o integrante')+'</select></label><label>Mentorado, se houver<select class="inp" name="member">'+options(members,a.member_id,'Demanda interna / sem vínculo')+'</select></label><label>Demanda equivalente<select class="inp" name="demand"><option value="">Criar demanda</option></select></label>'+(a.status==='needs_confirmation'?'<label class="fathom-confirm"><input type="checkbox" name="confirm" required>Confirmo que esta ação é uma pendência do nosso time.</label>':'')+'<div class="fathom-actions"><button type="submit" class="btn btn-primary">Atribuir e aprovar</button><button type="button" class="btn" data-dismiss="external">É ação da clínica</button><button type="button" class="btn" data-dismiss="suggestion">Não é mais pendência</button></div><p role="status" class="fathom-feedback"></p></form>':a.demand_id?'<p>Responsável: <strong>'+esc(name(staff,a.staff_id,'Integrante cadastrado'))+'</strong></p><a class="btn" href="/admin/#demandas">Ver no quadro de demandas</a>':'')+'</article>';
    }).join(''):'<p class="fathom-empty">Nenhuma ação nesta seleção.</p>';
  }
  function candidates(form){var sid=form.elements.staff.value,mid=form.elements.member.value||null;form.elements.demand.innerHTML=options(demands.filter(function(d){return d.member_id===mid&&(d.responsaveis||[]).indexOf(sid)!==-1;}),null,'Criar demanda');}
  async function save(form,patch){
    var card=form.closest('[data-id]'),a=actions.find(function(a){return a.id===card.dataset.id;}),feedback=form.querySelector('.fathom-feedback');
    var controls=Array.from(form.querySelectorAll('button,input,select'));controls.forEach(function(b){b.disabled=true;});feedback.textContent='Salvando…';
    try{
      var r=await C.sb.from('fathom_actions').update(patch).eq('id',a.id).eq('status',a.status).select('id,status,demand_id');
      if(r.error)throw r.error;if(!r.data.length)throw Error('Este item já foi alterado. Atualize a lista.');
      await load();message(r.data[0].demand_id?'Ação aprovada e vinculada ao quadro.':'Ação mantida como contexto, sem criar demanda.');
    }catch(e){feedback.textContent=e.message;feedback.classList.add('fathom-error');controls.forEach(function(b){b.disabled=false;});}
  }
  $('fathomTabs').addEventListener('click',function(e){var b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(function(x){x.setAttribute('aria-selected',String(x===b));});render();});
  $('fathomMeeting').addEventListener('change',render);$('fathomRefresh').addEventListener('click',load);
  $('fathomList').addEventListener('change',function(e){if(e.target.name==='staff'||e.target.name==='member')candidates(e.target.form);});
  $('fathomList').addEventListener('submit',function(e){e.preventDefault();var f=e.target;if(!f.reportValidity())return;save(f,{staff_id:f.elements.staff.value,member_id:f.elements.member.value||null,demand_id:f.elements.demand.value||null,status:'approved',disposition:'pending'});});
  $('fathomList').addEventListener('click',function(e){var b=e.target.closest('[data-dismiss]');if(b)save(b.form,{status:'context',disposition:b.dataset.dismiss});});
  C.auth.require('admin').then(function(s){if(s)load();}).catch(function(e){message(e.message,true);});
})();
