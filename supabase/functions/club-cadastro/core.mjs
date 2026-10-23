export const SHEET = 'Club OftalmoBlack';
export const ATTRIBUTION = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','aid'];
export const HEADER = ['ID do cadastro','Recebido em (Brasília)','Nome completo','WhatsApp','Página',...ATTRIBUTION];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORIGINS = new Set(['https://oftalmoblack.com.br','https://www.oftalmoblack.com.br']);
export class InputError extends Error {}
function text(value,max,optional=false){
 if(optional&&value==null)return '';
 if(typeof value!=='string'||value.length>max||/[\x00-\x1F\x7F]/.test(value))throw new InputError('invalid_input');
 const clean=value.trim();if(!optional&&!clean)throw new InputError('invalid_input');return clean;
}
export function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new InputError('invalid_input');
 if(text(input.website,200,true))throw new InputError('invalid_input');
 const id=text(input.submission_id,36).toLowerCase();if(!UUID.test(id))throw new InputError('invalid_input');
 const nome=text(input.nome,160).replace(/\s+/g,' ');
 if(nome.length<3||nome.split(' ').length<2||!/^\p{L}[\p{L}\p{M}'’ .-]*\p{L}$/u.test(nome))throw new InputError('invalid_name');
 const whatsapp=text(input.whatsapp,16);if(!/^\+[1-9][0-9]{7,14}$/.test(whatsapp))throw new InputError('invalid_phone');
 if(input.pagina!=='/club/')throw new InputError('invalid_page');
 if(input.utm!=null&&(typeof input.utm!=='object'||Array.isArray(input.utm)))throw new InputError('invalid_input');
 const utm={};for(const key of ATTRIBUTION){const value=text(input.utm?.[key],250,true);if(value)utm[key]=value;}
 return {id,nome,whatsapp,pagina:'/club/',utm};
}
export async function digest(value){
 const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(data)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function ipHash(ip,secret){
 if(!secret)throw new Error('unconfigured');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const data=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ip));
 return [...new Uint8Array(data)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function sheetValues(row){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(row.created_at)).map(x=>[x.type,x.value]));
 return [row.id,`${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`,row.nome,row.whatsapp,row.pagina,...ATTRIBUTION.map(k=>row.utm?.[k]||'')];
}
export function equalSecret(a,b){
 if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;
}
export function createHandler({receive,queueSync,sync,env,hashIp=ipHash}){
 return async function handler(req){
  const origin=req.headers.get('origin')||'';
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(ORIGINS.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'});
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(req.method==='OPTIONS')return ORIGINS.has(origin)?new Response(null,{status:204,headers}):reply(403,{ok:false,error:'invalid_origin'});
  if(req.method==='GET')return reply(200,{ok:true,service:'club-cadastro',version:1});
  if(req.method!=='POST')return reply(405,{ok:false,error:'invalid_method'});
  if(new URL(req.url).searchParams.get('sync')==='1'){
   if(!equalSecret(req.headers.get('x-club-sync-token'),env.syncToken))return reply(401,{ok:false,error:'unauthorized'});
   try{return reply(200,{ok:true,...await sync()});}catch{return reply(503,{ok:false,error:'sync_unavailable'});}
  }
  if(!ORIGINS.has(origin))return reply(403,{ok:false,error:'invalid_origin'});
  if(!(req.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return reply(415,{ok:false,error:'invalid_format'});
  if(Number(req.headers.get('content-length')||0)>8192)return reply(413,{ok:false,error:'body_too_large'});
  let raw;try{raw=await req.text();}catch{return reply(400,{ok:false,error:'invalid_input'});}
  if(new TextEncoder().encode(raw).length>8192)return reply(413,{ok:false,error:'body_too_large'});
  let data;try{data=validate(JSON.parse(raw));}catch(error){return reply(400,{ok:false,error:error instanceof InputError?error.message:'invalid_input'});}
  try{
   const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
   const result=await receive(data,await digest(JSON.stringify(data)),await hashIp(ip,env.hashSecret));
   if(result==='conflict')return reply(409,{ok:false,error:'request_conflict'});
   if(result==='rate_limit')return reply(429,{ok:false,error:'rate_limit'});
   if(!['created','existing'].includes(result))throw new Error('receipt_unavailable');
   // Cadastro já durável: falha no agendamento do espelho não muda seu recibo.
   try{queueSync();}catch{}
   return reply(200,{ok:true,id:data.id});
  }catch{return reply(503,{ok:false,error:'unavailable'});}
 };
}
