export class InputError extends Error {}
export const EVENTO='imersao-marketing-2026-10';
export function validate(input,authenticated=false){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new InputError('Dados inválidos.');
 if(typeof input.submission_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.submission_id))throw new InputError('Identificador inválido.');
 let nome=null,email=null;
 if(!authenticated&&input.nome!=null){
  if(typeof input.nome!=='string'||/[\x00-\x1f\x7f]/.test(input.nome))throw new InputError('Confira seu nome completo.');
  nome=input.nome.normalize('NFKC').trim().replace(/\s+/g,' ');
  if(nome.length<2||nome.length>160||!/[\p{L}].*[\p{L}]/u.test(nome)||/^(dr|dra)\.?$/i.test(nome))throw new InputError('Confira seu nome completo.');
 }else if(!authenticated){
  email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
  if(!email||email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new InputError('Confira o e-mail de cadastro.');
 }
 const utm={};
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){
  const v=input.utm?.[key];if(v==null||v==='')continue;
  if(typeof v!=='string'||v.length>250||/[\x00-\x1f]/.test(v))throw new InputError('Origem inválida.');
  utm[key]=v.trim();
 }
 const pagina=input.pagina||'/perfil-clinica/nivel-1/';
 if(typeof pagina!=='string'||pagina.length>200||!pagina.startsWith('/')||/[?#\x00-\x1f]/.test(pagina))throw new InputError('Página inválida.');
 // Omitir nome nos contratos antigos preserva o hash e os retries já emitidos.
 return {id:input.submission_id.toLowerCase(),evento:EVENTO,...(nome?{nome}:{}),email,origem:['stories','presencial','direto'].includes(input.origem)?input.origem:'presencial',utm,pagina};
}
export async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function ipHash(ip,secret){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ip)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function sheetValues(row){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(row.created_at)).map(x=>[x.type,x.value]));
 const date=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)/86400000+25569;
 const [year,month,day]=row.dia_presenca.split('-').map(Number);
 const presenceDay=Date.UTC(year,month-1,day)/86400000+25569;
 const method={sessao_autenticada:'Sessão autenticada',email_informado:'E-mail informado',nome_informado:'Nome informado'}[row.identificacao];
 return [row.id,date,row.evento,row.nome||'',row.email||'',row.member_id||'',method,row.member_id?'Associado ao cadastro':'Conferir cadastro',row.origem,...['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].map(k=>row.utm?.[k]||''),row.pagina,presenceDay];
}
export async function ensureSheetCapacity(google,token,lastRow){
 const meta=await google('?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))',token);
 const p=meta.sheets?.find(s=>s.properties.title==='Presenças')?.properties;
 if(!p)throw new Error('sheet_unavailable');
 if(lastRow>p.gridProperties.rowCount)await google(':batchUpdate',token,{requests:[{appendDimension:{sheetId:p.sheetId,dimension:'ROWS',length:Math.max(1000,lastRow-p.gridProperties.rowCount)}}]},'POST');
}
export function createHandler({receive,resolveUser,queueSync,sync,env}){
 const origins=new Set(['https://oftalmoblack.com.br','https://www.oftalmoblack.com.br']);
 return async req=>{
  const origin=req.headers.get('origin')||'';
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(origins.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-member-token','Access-Control-Allow-Methods':'POST, OPTIONS'});
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(req.method==='OPTIONS')return origins.has(origin)?new Response(null,{status:204,headers}):reply(403,{ok:false});
  if(req.method!=='POST')return reply(405,{ok:false});
  if(new URL(req.url).searchParams.get('sync')==='1'){
   if(!env.syncToken||req.headers.get('x-perfil-sync-token')!==env.syncToken)return reply(401,{ok:false});
   try{return reply(200,{ok:true,...await sync()});}catch{return reply(503,{ok:false});}
  }
  if(!origins.has(origin))return reply(403,{ok:false});
  if(!(req.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return reply(415,{ok:false});
  if(Number(req.headers.get('content-length')||0)>4096)return reply(413,{ok:false});
  let raw;try{raw=await req.text();}catch{return reply(400,{ok:false});}
  if(new TextEncoder().encode(raw).length>4096)return reply(413,{ok:false});
  try{
   let userId=null;
   const token=req.headers.get('x-member-token');
   if(token){
    if(token.length>8192)return reply(401,{ok:false,code:'identity_required'});
    userId=await resolveUser(token);
    if(!userId)return reply(401,{ok:false,code:'identity_required'});
   }
   const data=validate(JSON.parse(raw),!!userId);
   const hash=await digest(JSON.stringify({...data,userId}));
   const ip=await ipHash((req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim(),env.hashSecret);
   const result=await receive(data,hash,ip,userId);
   if(result?.status==='identity_required')return reply(401,{ok:false,code:'identity_required'});
   if(result?.status==='conflict')return reply(409,{ok:false});
   if(result?.status==='rate_limit')return reply(429,{ok:false});
   if(!['created','existing'].includes(result?.status)||!/^\d{4}-\d{2}-\d{2}$/.test(result?.day||''))throw new Error('receipt_unavailable');
   queueSync();
   // Mesmo retorno para e-mails associados e não associados: sem consulta pública da base.
   return reply(200,{ok:true,id:data.id,day:result.day});
  }catch(error){return reply(error instanceof InputError||error instanceof SyntaxError?400:503,{ok:false});}
 };
}
