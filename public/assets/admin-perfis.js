import { renderMemberProfile, formatSourceDate } from './member-profile-view.js?v=2';
const $=s=>document.querySelector(s), C=window.Club, select=$('#member');
let member=null, loadNumber=0;
const date=v=>v ? new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' (Brasília)' : 'Data não informada';
function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
function message(text,error=false){$('#message').textContent=text;$('#message').className='message'+(error?' error':'');}
async function edge(body,endpoint='pre-diagnostico') {
  const {data,error}=await C.sb.auth.getSession();if(error||!data.session)throw Error('Sua sessão expirou. Entre novamente.');
  const r=await fetch(C.cfg.supabaseUrl+'/functions/v1/'+endpoint,{method:'POST',headers:{'content-type':'application/json',apikey:C.cfg.supabaseAnonKey,authorization:'Bearer '+data.session.access_token},body:JSON.stringify(body)});
  const out=await r.json();if(!r.ok)throw Error(out.error||'Não foi possível concluir.');return out;
}
async function load() {
  const turn=++loadNumber, id=select.value;member=id;
  $('#new-link').hidden=true;$('#link').value='';$('#issue').disabled=true;
  for(const s of ['#identity','#sources','#profile','#links'])$(s).replaceChildren();
  message('Carregando perfil…');
  try {
    const [profile,links]=await Promise.all([edge({member_id:id},'member-profile'),C.sb.from('member_intake_links').select('id,created_at,expires_at,revoked_at').eq('member_id',id).order('created_at',{ascending:false})]);
    if(turn!==loadNumber)return;if(links.error)throw links.error;
    if(profile.mentorado_id!==id || !profile.perfil_completo)throw Error('Resposta de perfil incompleta. Atualize a página.');
    const identity=el('section',null,'profile-card profile-heading');identity.append(el('h2',profile.nome));
    identity.append(el('p','Padrão '+profile.schema_version+' · '+Object.keys(profile.campos).length+' campos · '+profile.catalogo.sections.length+' áreas','meta'));
    const open=el('a','Consultar com o Cérebro','profile-chat-link');open.href='/membros/?membro='+encodeURIComponent(id)+'#cerebro';
    if(profile.campos['identidade.situacao_cadastro'].valor==='ativo')identity.append(open);
    $('#identity').append(identity);
    const onSource=async(source,target)=>{
      if(turn!==loadNumber)return;
      const b=el('p','Carregando registro original…','meta');target.append(b);
      try {
        const r=await C.sb.from('member_context_entries').select('data').eq('member_id',id).eq('id',source.id).single();
        if(turn!==loadNumber)return;if(r.error)throw r.error;
        b.replaceChildren(el('pre',JSON.stringify(r.data.data,null,2),'profile-source-raw'));
      }catch{if(turn===loadNumber)b.textContent='Não foi possível recuperar o registro original.';}
    };
    renderMemberProfile($('#profile'),profile,{onSource});
    for(const source of profile.fontes){const d=el('details',null,'profile-source');d.append(el('summary',source.source_ref||source.source_type),el('p','Referência: '+formatSourceDate(source)+' · Registrado: '+date(source.recorded_at),'meta'));
      if(/^[\da-f-]{36}$/i.test(source.id)){const b=el('button','Ver registro original','profile-source-button');b.type='button';b.addEventListener('click',()=>onSource(source,d));d.append(b);}$('#sources').append(d);}
    if(!links.data.length)$('#links').append(el('p','Nenhum link preparado.','meta'));
    for(const link of links.data){const row=el('div',null,'link-row'),active=!link.revoked_at&&new Date(link.expires_at)>new Date();row.append(el('span',(link.revoked_at?'Encerrado · ':active?'Válido até ':'Expirado em ')+date(link.expires_at)));
      if(active){const b=el('button','Encerrar link');b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await edge({action:'revoke',link_id:link.id});if(turn===loadNumber)await load();}catch(e){if(turn===loadNumber){message(e.message,true);b.disabled=false;}}});row.append(b);}$('#links').append(row);}
    const answers=profile.fontes.filter(s=>s.source_type==='pre_diagnostico').length;
    message(answers ? answers+' envios do formulário incorporados ao perfil. Equipe e agentes consultam este mesmo padrão.' : 'Nenhuma resposta do formulário recebida. O perfil reúne o que já temos; os demais campos continuam visíveis.');
  }catch(e){if(turn===loadNumber)message('Não foi possível carregar o perfil. '+e.message,true);}
  finally{if(turn===loadNumber)$('#issue').disabled=false;}
}
$('#issue').addEventListener('click',async()=>{
  const id=member,turn=loadNumber;$('#issue').disabled=true;
  try{const data=await edge({action:'issue',member_id:id});if(id!==member||turn!==loadNumber)return;await load();if(id!==member||loadNumber!==turn+1)return;$('#link').value=location.origin+'/pre-diagnostico/#t='+data.token;$('#new-link').hidden=false;message('Link preparado. Nenhuma mensagem foi enviada.');}
  catch(e){if(id===member&&loadNumber===turn)message(e.message,true);}
  finally{if(id===member&&loadNumber<=turn+1)$('#issue').disabled=false;}
});
$('#copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#link').value);message('Link copiado.');}catch{$('#link').select();message('Selecione e copie o link acima.');}});
select.addEventListener('change',()=>{history.replaceState(null,'','?m='+encodeURIComponent(select.value));load();});
$('#reload').addEventListener('click',load);
try{const session=await C.auth.require('admin');if(session){const r=await C.sb.from('members').select('id,nome').order('nome');if(r.error)throw r.error;for(const m of r.data){const o=el('option',m.nome);o.value=m.id;select.append(o);}const requested=new URLSearchParams(location.search).get('m');if(r.data.some(m=>m.id===requested))select.value=requested;$('#workspace').hidden=false;if(r.data.length)await load();else message('Cadastre primeiro o mentorado no Cérebro.');}}
catch(e){message(e.message,true);}
