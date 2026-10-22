/* Receptor preparado, sem emissor ativo. Só origens; valores vêm da API. */
const keys=['utm_source','utm_medium','utm_campaign','utm_content'];
function reply(status,message){return new Response(JSON.stringify({message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
async function equal(a,b){const e=new TextEncoder(),hash=async x=>new Uint8Array(await crypto.subtle.digest('SHA-256',e.encode(x)));const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;}
async function boundedBody(req){const reader=req.body?.getReader();if(!reader)throw Error('empty');let size=0,parts=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw Error('too_large');}parts.push(value);}const raw=new Uint8Array(size);let offset=0;for(const part of parts){raw.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder().decode(raw));}
export function createHandler({secret,url,key,fetcher=fetch}={}){return async function(req){
 if(!secret||secret.length<32||!url||!key)return reply(503,'not_configured');
 if(req.method!=='POST')return reply(405,'method_not_allowed');
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'')||new URL(req.url).searchParams.get('key')||'';
 if(token.length>200||!await equal(token,secret))return reply(401,'unauthorized');
 let body;try{body=await boundedBody(req);}catch{return reply(400,'invalid_body');}
 if(body?.type!=='sale')return reply(202,'ignored');
 const pid=Number(body.product?.id),sid=Number(body.sale?.id);
 if(![199173,199893].includes(pid))return reply(202,'ignored_product');
 if(!Number.isSafeInteger(sid)||sid<=0||!/^\d+$/.test(String(body.sale?.id)))return reply(422,'invalid_sale');
 if(body.sale?.product_id&&Number(body.sale.product_id)!==pid)return reply(422,'conflicting_product');
 if(!Array.isArray(body.saleMetas))return reply(202,'no_origin');
 const record={sale_id:sid,product_id:pid,origin_mode:'greenn_webhook'},seen=new Set();keys.forEach(k=>record[k]='');
 for(const m of body.saleMetas){
  if(!keys.includes(m.meta_key))continue;
  if(m.sale_id!=null&&Number(m.sale_id)!==sid)return reply(422,'conflicting_sale');
  const value=m.meta_value==null?'':String(m.meta_value);
  if(!/^[A-Za-z0-9_-]{0,180}$/.test(value)||seen.has(m.meta_key)&&record[m.meta_key]!==value)return reply(422,'invalid_origin');
  seen.add(m.meta_key);record[m.meta_key]=value;
 }
 if(!keys.some(k=>record[k]))return reply(202,'no_origin');
 try{const result=await fetcher(url.replace(/\/$/,'')+'/rest/v1/book_sale_attributions?on_conflict=sale_id',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(record)});if(!result.ok)return reply(503,'storage_unavailable');}
 catch{return reply(503,'storage_unavailable');}
 return reply(200,'origin_saved');
};}
