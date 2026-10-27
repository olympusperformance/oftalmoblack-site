import {CATALOG} from '../_shared/member-profile-model.mjs';
const allowed=new Set(['https://oftalmoblack.com.br','https://www.oftalmoblack.com.br']);
export function createHandler({authorize,load}){return async req=>{
 const origin=req.headers.get('origin'),headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','vary':'Origin','access-control-allow-headers':'authorization, apikey, content-type','access-control-allow-methods':'POST, OPTIONS'};
 if(allowed.has(origin))headers['access-control-allow-origin']=origin;
 const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!allowed.has(origin))return reply(403,{error:'Origem não permitida.'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Método não permitido.'});
 try{
  const reader=req.body?.getReader(),chunks=[];let length=0;
  if(reader)while(true){const r=await reader.read();if(r.done)break;length+=r.value.byteLength;if(length>4096){await reader.cancel();return reply(413,{error:'Pedido muito longo.'});}chunks.push(r.value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply(400,{error:'Dados inválidos.'});}
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['member_id','sections'].includes(k))||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.member_id||''))return reply(400,{error:'Mentorado inválido.'});
  if(body.sections!==undefined&&(!Array.isArray(body.sections)||!body.sections.length||body.sections.length>14||body.sections.some(s=>!CATALOG.sections.some(x=>x.id===s))))return reply(400,{error:'Seção inválida.'});
  if(!await authorize(req.headers.get('authorization')||''))return reply(403,{error:'Perfil disponível para a equipe autorizada.'});
  const profile=await load(body.member_id,body.sections);return profile?reply(200,profile):reply(404,{error:'Mentorado não encontrado.'});
 }catch{return reply(503,{error:'Não foi possível carregar o perfil agora. Tente novamente.'});}
};}
