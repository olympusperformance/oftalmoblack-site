export const EVENTO='imersao-marketing-2026-10';
export const DIAS=['2026-10-22','2026-10-23','2026-10-24'];
export async function sha256(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function readAll(readPage){
 let rows=[],offset=0,target=null;
 while(true){
  const page=await readPage(offset);
  if(!Array.isArray(page.rows)||!Number.isInteger(page.total)||page.total<0||page.total>5000)throw new Error('incomplete_list');
  if(target===null)target=page.total;
  rows.push(...page.rows);offset+=page.rows.length;
  if(offset>=target)return rows;
  if(page.rows.length===0)throw new Error('incomplete_list');
 }
}
export function createHandler({keyHash,read,now=()=>new Date()}){
 const origins=new Set(['https://oftalmoblack.com.br','https://www.oftalmoblack.com.br']);
 return async req=>{
  const origin=req.headers.get('origin')||'';
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(origins.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,x-presenca-view-key','Access-Control-Allow-Methods':'POST, OPTIONS'});
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!origins.has(origin))return reply(403,{ok:false});
  if(req.method==='OPTIONS')return origins.has(origin)?new Response(null,{status:204,headers}):reply(403,{ok:false});
  if(req.method!=='POST')return reply(405,{ok:false});
  const key=req.headers.get('x-presenca-view-key')||'';
  if(!/^[a-f0-9]{64}$/.test(keyHash||'')||!/^[A-Za-z0-9_-]{40,80}$/.test(key)||await sha256(key)!==keyHash)return reply(401,{ok:false});
  try{
   const rows=await read();
   const presencas=rows.filter(r=>DIAS.includes(r.dia_presenca)).map(r=>({id:r.id,nome:r.nome||'Nome não informado',dia:r.dia_presenca,registrada_em:r.created_at}));
   return reply(200,{ok:true,evento:'Imersão Black · Outubro 2026',fuso:'America/Sao_Paulo',dias:DIAS,atualizado_em:now().toISOString(),presencas});
  }catch{return reply(503,{ok:false});}
 };
}
