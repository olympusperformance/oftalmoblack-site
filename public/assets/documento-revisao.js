(function () {
'use strict';
const C=window.Club, gate=document.getElementById('gate'), status=document.getElementById('status'), reader=document.getElementById('reader'), form=document.getElementById('login-form'), retry=document.getElementById('retry');
let busy=false;
function message(text){status.textContent=text;status.hidden=false;}
function clean(markup){
 const parsed=new DOMParser().parseFromString(markup,'text/html');
 parsed.querySelectorAll('script,iframe,object,embed,base,form,meta,link,svg,math,style,template,img,video,audio,source').forEach(n=>n.remove());
 parsed.querySelectorAll('*').forEach(el=>Array.from(el.attributes).forEach(a=>{
  if(/^on/i.test(a.name)||['srcdoc','src','style','xlink:href'].includes(a.name)||(a.name==='href'&&!/^(https?:|mailto:|tel:|#|\/)/i.test(a.value)))el.removeAttribute(a.name);
 }));
 parsed.querySelectorAll('a[target="_blank"]').forEach(a=>a.rel='noopener noreferrer');
 return parsed.body.innerHTML;
}
async function load(){
 if(busy)return;busy=true;retry.hidden=true;reader.replaceChildren();reader.hidden=true;
 message('Abrindo o material…');
 try{
  const session=await C.auth.ready();
  if(!session){gate.hidden=false;form.hidden=false;message('Entre com sua conta do Club OftalmoBlack para abrir o material.');return;}
  form.hidden=true;
  if(session.role!=='admin'){gate.hidden=false;message('Este material está em revisão pela equipe.');return;}
  const response=await C.sb.from('materials').select('id,titulo,arquivo_path,visivel_para').eq('id',document.body.dataset.material).maybeSingle();
  if(response.error||!response.data)throw new Error('Acesso ao material indisponível.');
  const file=await C.sb.storage.from('materiais').download(response.data.arquivo_path);
  if(file.error||!file.data)throw new Error('Não foi possível abrir o conteúdo.');
  const text=await file.data.text();
  if(!text.includes('data-onboarding-report="v3"'))throw new Error('Formato do material não reconhecido.');
  reader.innerHTML=clean(text);gate.hidden=true;reader.hidden=false;document.title=response.data.titulo+' | Olympus';
  const copy=reader.querySelector('[data-copy-link]');
  if(copy)copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname);copy.textContent='Link copiado';}catch{copy.textContent='Copie o endereço do navegador';}});
  const open=document.getElementById('print-page');if(open)open.addEventListener('click',()=>window.print());
 }catch(err){gate.hidden=false;message('Não foi possível abrir o material agora. Confira sua conexão e tente novamente.');retry.hidden=false;}
 finally{busy=false;}
}
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;message('Entrando…');
 try{await C.auth.login(form.elements.email.value,form.elements.password.value);form.elements.password.value='';await load();}
 catch(err){message(err.message||'Não foi possível entrar.');}
 finally{button.disabled=false;}
});
retry.addEventListener('click',load);
if(!C||C.configError){message('Não foi possível carregar o acesso. Recarregue a página.');form.hidden=true;}else load();
})();
