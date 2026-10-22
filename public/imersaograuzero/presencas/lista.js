(()=>{'use strict';
 const $=id=>document.getElementById(id),endpoint='https://zpyxnkuvircukjlfexrv.supabase.co/functions/v1/black-presencas-lista';
 const key=new URLSearchParams(location.hash.slice(1)).get('acesso')||'';
 if(!/^[A-Za-z0-9_-]{40,80}$/.test(key))return;
 const sharedLink=location.origin+location.pathname+'#acesso='+encodeURIComponent(key);
 let data=[],busy=false,loaded=false;
 const clock=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(Array.from($('day').options).some(o=>o.value===today))$('day').value=today;
 function render(){
  const day=$('day').value,term=$('search').value.trim().toLocaleLowerCase('pt-BR');
  const all=data.filter(r=>r.dia===day),rows=all.filter(r=>r.nome.toLocaleLowerCase('pt-BR').includes(term));
  $('total').textContent=String(all.length);$('total-label').textContent=(all.length===1?'presença em ':'presenças em ')+day.slice(8,10)+'/'+day.slice(5,7);$('rows').replaceChildren();
  for(const r of rows){const tr=document.createElement('tr'),nome=document.createElement('td'),time=document.createElement('td');nome.textContent=r.nome;time.className='time';time.textContent=clock.format(new Date(r.registrada_em));tr.append(nome,time);$('rows').append(tr);}
  $('empty').hidden=rows.length>0;$('empty').textContent=term?'Nenhum participante encontrado.':'Nenhuma presença registrada neste dia.';
 }
 async function refresh(){
  if(busy||document.hidden)return;busy=true;$('refresh').disabled=true;
  try{const r=await fetch(endpoint,{method:'POST',headers:{'x-presenca-view-key':key},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
   if(r.status===401||r.status===403){loaded=false;data=[];$('rows').replaceChildren();$('dashboard').hidden=true;$('locked').hidden=false;$('locked').querySelector('p').textContent='Este acesso não está disponível. Peça à organização um novo link.';return;}
   const json=await r.json();if(!r.ok||json.ok!==true||!Array.isArray(json.presencas))throw new Error('unavailable');
   data=json.presencas;loaded=true;$('locked').hidden=true;$('dashboard').hidden=false;render();$('status').classList.remove('error');$('status').textContent='Atualizado às '+clock.format(new Date(json.atualizado_em))+', horário de Brasília.';
  }catch{if(!loaded){$('locked').querySelector('p').textContent='Não foi possível atualizar agora. Tentaremos novamente em 30 segundos.';}else{$('status').classList.add('error');$('status').textContent='Não foi possível atualizar. A lista abaixo mostra a última consulta; tente Atualizar.';}}
  finally{busy=false;$('refresh').disabled=false;}
 }
 $('day').addEventListener('change',render);$('search').addEventListener('input',render);$('refresh').addEventListener('click',refresh);$('print').addEventListener('click',()=>window.print());
 $('share').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(sharedLink);$('status').textContent='Link copiado. Compartilhe somente com a equipe responsável.';}catch{$('status').textContent='Copie o endereço completo desta página para compartilhar com a equipe.';}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(refresh,30000);refresh();
})();
