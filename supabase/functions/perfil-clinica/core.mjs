export const VOLUMES=['1_5','6_10','11_20','mais_20'];
export const FATURAMENTOS=['ate_50','50_100','100_200','200_500','acima_500'];
export const DESAFIOS=['atrair_particulares','converter_cirurgias','faturamento_margem','equipe_processos','dependencia','outro'];
export class InputError extends Error {}
function text(value,max,required=true){
  if(typeof value!=='string'){if(!required&&value==null)return null;throw new InputError('Campo inválido.');}
  const clean=value.trim();
  if(clean.length>max|| (required&&!clean)||/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(clean))throw new InputError('Campo inválido.');
  return clean||null;
}
export function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new InputError('Dados inválidos.');
  const id=text(input.submission_id,36);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new InputError('Identificador inválido.');
  const nome=text(input.nome,160),email=text(input.email,254).toLowerCase(),whatsapp=text(input.whatsapp,20);
  if(nome.length<2||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)||!/^\+[1-9][0-9]{7,14}$/.test(whatsapp))throw new InputError('Confira seu nome, e-mail e WhatsApp.');
  if(typeof input.lentes_premium!=='boolean')throw new InputError('Informe se realiza cirurgias com lentes premium.');
  if(input.lentes_premium&&!VOLUMES.includes(input.volume_lentes))throw new InputError('Informe o volume mensal.');
  if(!FATURAMENTOS.includes(input.faturamento))throw new InputError('Informe a faixa de faturamento.');
  if(!Array.isArray(input.desafios)||input.desafios.length<1||input.desafios.length>6||input.desafios.some(x=>!DESAFIOS.includes(x)))throw new InputError('Marque pelo menos um desafio.');
  const desafios=[...new Set(input.desafios)].sort();
  const outro=desafios.includes('outro')?text(input.outro_desafio,500):null;
  const origem=['stories','presencial','direto'].includes(input.origem)?input.origem:'direto';
  const utm={};
  for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','aid']){
    const val=input.utm?.[key];if(val!=null&&val!=='')utm[key]=text(val,250);
  }
  const pagina=text(input.pagina||'/perfil-clinica/',200);
  if(!pagina.startsWith('/')||pagina.includes('?')||pagina.includes('#'))throw new InputError('Página inválida.');
  return {id:id.toLowerCase(),nome,email,whatsapp,lentes_premium:input.lentes_premium,volume_lentes:input.lentes_premium?input.volume_lentes:null,faturamento:input.faturamento,desafios,outro_desafio:outro,origem,utm,pagina};
}
export async function digest(value){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function ipHash(ip,secret){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const result=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ip));
 return [...new Uint8Array(result)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
const labels={...Object.fromEntries(VOLUMES.map((v,i)=>[v,['1 a 5','6 a 10','11 a 20','Mais de 20'][i]])),...Object.fromEntries(FATURAMENTOS.map((v,i)=>[v,['Até R$50 mil','R$50 a 100 mil','R$100 a 200 mil','R$200 a 500 mil','Acima de R$500 mil'][i]])),...Object.fromEntries(DESAFIOS.map((v,i)=>[v,['Atrair mais pacientes particulares','Converter mais consultas em cirurgias','Aumentar o faturamento e a margem de lucro','Organizar a equipe e os processos','Fazer a clínica depender menos de mim','Outro'][i]]))};
export function sheetValues(row){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(row.created_at)).map(p=>[p.type,p.value]));
 const serial=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second))/86400000+25569;
 return [row.id,serial,row.nome,row.email,row.whatsapp,row.lentes_premium?'Sim':'Não',row.volume_lentes?labels[row.volume_lentes]:'',labels[row.faturamento],row.desafios.map(x=>labels[x]).join('; '),row.outro_desafio||'',row.origem,...['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].map(x=>row.utm?.[x]||''),row.pagina];
}
export async function ensureSheetCapacity(google,token,lastRow){
 const metadata=await google('?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))',token);
 const sheet=metadata.sheets?.find(s=>s.properties.title==='Cadastros');
 if(!sheet)throw new Error('sheet_unavailable');
 const count=sheet.properties.gridProperties.rowCount;
 if(lastRow>count){
  // Concorrência pode apenas reservar linhas extras; append nunca encolhe a grade.
  await google(':batchUpdate',token,{requests:[{appendDimension:{sheetId:sheet.properties.sheetId,dimension:'ROWS',length:Math.max(1000,lastRow-count)}}]},'POST');
 }
}
export function createHandler({receive,queueSync,sync,env,hashIp=ipHash}){
 const origins=new Set(['https://oftalmoblack.com.br','https://www.oftalmoblack.com.br']);
 return async function handler(req){
  const origin=req.headers.get('origin')||'';
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(origins.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'});
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(req.method==='OPTIONS')return origins.has(origin)?new Response(null,{status:204,headers}):reply(403,{ok:false,error:'Origem inválida.'});
  if(req.method!=='POST')return reply(405,{ok:false,error:'Método inválido.'});
  if(new URL(req.url).searchParams.get('sync')==='1'){
    if(!env.syncToken||req.headers.get('x-perfil-sync-token')!==env.syncToken)return reply(401,{ok:false});
    try{return reply(200,{ok:true,...await sync()});}catch{return reply(503,{ok:false,error:'Sincronização indisponível.'});}
  }
  if(!origins.has(origin))return reply(403,{ok:false,error:'Origem inválida.'});
  if(!(req.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return reply(415,{ok:false,error:'Formato inválido.'});
  if(Number(req.headers.get('content-length')||0)>8192)return reply(413,{ok:false,error:'Envio muito grande.'});
  let raw;try{raw=await req.text();}catch{return reply(400,{ok:false,error:'Envio inválido.'});}
  if(new TextEncoder().encode(raw).length>8192)return reply(413,{ok:false,error:'Envio muito grande.'});
  let data;try{data=validate(JSON.parse(raw));}catch(error){return reply(400,{ok:false,error:error instanceof InputError?error.message:'Dados inválidos.'});}
  try{
    const fingerprint=await hashIp((req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim(),env.hashSecret);
    const result=await receive(data,await digest(JSON.stringify(data)),fingerprint);
    if(result==='conflict')return reply(409,{ok:false,error:'As respostas mudaram. Atualize a página e envie novamente.'});
    if(result==='rate_limit')return reply(429,{ok:false,error:'Muitos envios neste momento. Aguarde um pouco e tente novamente.'});
    queueSync();
    return reply(200,{ok:true,id:data.id});
  }catch{return reply(503,{ok:false,error:'Não foi possível confirmar o envio. Tente novamente.'});}
 };
}
