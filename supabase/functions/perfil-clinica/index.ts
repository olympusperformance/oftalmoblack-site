import { createHandler, sheetValues, ensureSheetCapacity } from './core.mjs';

const env = (key: string) => Deno.env.get(key) || '';
const dbUrl = env('SUPABASE_URL');
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
const sheetId = env('PERFIL_SHEET_ID');
const sheetSa = env('PERFIL_GOOGLE_SA');
const syncToken = env('PERFIL_SYNC_TOKEN');
const dbHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

async function db(path: string, body: unknown, method = 'POST') {
  const res = await fetch(`${dbUrl}/rest/v1/${path}`, { method, headers: dbHeaders, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error('database_unavailable');
  return res.status === 204 ? null : await res.json();
}

let googleCache = { token: '', expires: 0 };
function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''); }
const enc = (s: string) => new TextEncoder().encode(s);
async function googleToken() {
  if (googleCache.token && googleCache.expires > Date.now() + 60000) return googleCache.token;
  const sa = JSON.parse(sheetSa);
  const now = Math.floor(Date.now()/1000);
  const body = `${b64(enc(JSON.stringify({alg:'RS256',typ:'JWT'})))}.${b64(enc(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})))}`;
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')), c=>c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const assertion = `${body}.${b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc(body))))}`;
  const res = await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(12000)});
  if(!res.ok) throw new Error('google_auth');
  const json=await res.json();
  if(!json.access_token) throw new Error('google_auth');
  googleCache={token:json.access_token,expires:Date.now()+(json.expires_in||3600)*1000};
  return googleCache.token;
}

async function google(path: string, token: string, body?: unknown, method?: string) {
  const separator=path.startsWith('?')||path.startsWith(':')?'':'/';
  const res=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${separator}${path}`,{method:method||(body?'PUT':'GET'),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  if(!res.ok) throw new Error(res.status===403?'sheet_access':'sheet_unavailable');
  return res.json();
}

async function sync() {
  if(!sheetId||!sheetSa) throw new Error('sheet_not_configured');
  const rows=await db('rpc/black_perfil_sync_claim',{});
  if(!rows.length) return {synced:0,pending:0};
  const batchToken=await googleToken();
  await ensureSheetCapacity(google,batchToken,Math.max(...rows.map((r: {sheet_row: number})=>Number(r.sheet_row))));
  let synced=0,pending=0;
  for(const row of rows){
    try{
      const token=await googleToken();
      const range=encodeURIComponent(`Cadastros!A${row.sheet_row}:Q${row.sheet_row}`);
      const current=await google(`values/${range}`,token);
      // A aba é gerenciada e protegida. Nunca sobrescrever outro cadastro
      // caso alguém reorganize linhas manualmente.
      if(current.values?.[0]?.some((v: unknown)=>v!=null&&v!=='')&&current.values[0][0]!==row.id) throw new Error('sheet_row_conflict');
      const result=await google(`values/${range}?valueInputOption=RAW`,token,{range:`Cadastros!A${row.sheet_row}:Q${row.sheet_row}`,majorDimension:'ROWS',values:[sheetValues(row)]});
      if(result.updatedCells!==17) throw new Error('sheet_ack');
      await db(`black_perfis_clinica?id=eq.${row.id}`,{synced_at:new Date().toISOString(),sync_lock_until:null,sync_error:null},'PATCH');
      synced++;
    }catch(error){
      const safe = ['google_auth','sheet_access','sheet_unavailable','sheet_row_conflict','sheet_ack'].includes(error.message)?error.message:'sync_unavailable';
      const delay=Math.min(60,5*Math.pow(2,Math.min(row.sync_attempts-1,4)));
      await db(`black_perfis_clinica?id=eq.${row.id}`,{sync_lock_until:null,sync_error:safe,next_sync_at:new Date(Date.now()+delay*60000).toISOString()},'PATCH');
      pending++;
    }
  }
  return {synced,pending};
}

const handler=createHandler({
  env:{syncToken,hashSecret:serviceKey},
  receive:(data: unknown,hash: string,ip: string)=>db('rpc/black_perfil_receber',{p_payload:data,p_hash:hash,p_ip_hash:ip}),
  sync,
  queueSync:()=>EdgeRuntime.waitUntil(sync().catch(()=>{})),
});
Deno.serve(handler);
