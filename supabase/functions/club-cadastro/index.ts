import {createHandler, SHEET, HEADER, sheetValues} from './core.mjs';

const env=(key:string)=>Deno.env.get(key)||'';
const dbUrl=env('SUPABASE_URL');
const serviceKey=env('SUPABASE_SERVICE_ROLE_KEY');
// Credenciais já usadas pelo cadastro B2B. Nenhuma alteração nos receptores legados.
const sheetId=env('PERFIL_SHEET_ID');
const sheetSa=env('PERFIL_GOOGLE_SA');
const dbHeaders={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'};

async function db(path:string,body:unknown,method='POST'){
 const res=await fetch(`${dbUrl}/rest/v1/${path}`,{method,headers:dbHeaders,body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw new Error('database_unavailable');
 return res.status===204?null:res.json();
}
let cache={token:'',expires:0};
const enc=(s:string)=>new TextEncoder().encode(s);
function b64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
async function googleToken(){
 if(cache.token&&cache.expires>Date.now()+60000)return cache.token;
 if(!sheetId||!sheetSa)throw new Error('sheet_not_configured');
 const sa=JSON.parse(sheetSa),now=Math.floor(Date.now()/1000);
 const claim=`${b64(enc(JSON.stringify({alg:'RS256',typ:'JWT'})))}.${b64(enc(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})))}`;
 const der=Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const assertion=`${claim}.${b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc(claim))))}`;
 const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw new Error('google_auth');const data=await res.json();if(!data.access_token)throw new Error('google_auth');
 cache={token:data.access_token,expires:Date.now()+(data.expires_in||3600)*1000};return cache.token;
}
async function google(path:string,token:string,body?:unknown,method?:string){
 const separator=path.startsWith('?')||path.startsWith(':')?'':'/';
 const res=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${separator}${path}`,{method:method||(body?'PUT':'GET'),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw new Error(res.status===403?'sheet_access':'sheet_unavailable');return res.json();
}
const sheetRange=(start:number,end=start)=>`'${SHEET}'!A${start}:K${end}`;
async function ensureSheet(token:string,lastRow:number){
 const metadata=await google('?fields=sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))',token);
 let sheet=metadata.sheets?.find((s:any)=>s.properties.title===SHEET)?.properties;
 if(!sheet){
  const used=new Set(metadata.sheets.map((s:any)=>s.properties.sheetId));
  let id=202610230;while(used.has(id))id++;
  try{
   await google(':batchUpdate',token,{requests:[
    {addSheet:{properties:{sheetId:id,title:SHEET,gridProperties:{rowCount:1000,columnCount:11,frozenRowCount:1}}}},
    {updateCells:{start:{sheetId:id,rowIndex:0,columnIndex:0},rows:[{values:HEADER.map(title=>({userEnteredValue:{stringValue:title},userEnteredFormat:{textFormat:{bold:true}}}))}],fields:'userEnteredValue,userEnteredFormat.textFormat.bold'}},
    {setBasicFilter:{filter:{range:{sheetId:id,startRowIndex:0,startColumnIndex:0,endColumnIndex:11}}}},
    {updateDimensionProperties:{range:{sheetId:id,dimension:'COLUMNS',startIndex:0,endIndex:1},properties:{hiddenByUser:true},fields:'hiddenByUser'}},
    {addProtectedRange:{protectedRange:{range:{sheetId:id},description:'Aba gerenciada pelo cadastro Club. Use visualizações de filtro; não reorganize linhas físicas.',warningOnly:true}}}
   ]},'POST');
   sheet={sheetId:id,rowCount:1000,gridProperties:{rowCount:1000,columnCount:11}};
  }catch{
   // Corrida de criação: só adota a aba se outro worker já instalou o cabeçalho exato.
   const fresh=await google('?fields=sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))',token);
   sheet=fresh.sheets?.find((s:any)=>s.properties.title===SHEET)?.properties;
   if(!sheet)throw new Error('sheet_unavailable');
  }
 }
 const header=await google(`values/${encodeURIComponent(sheetRange(1))}`,token);
 if(JSON.stringify(header.values?.[0])!==JSON.stringify(HEADER))throw new Error('sheet_schema');
 if(lastRow>sheet.gridProperties.rowCount)await google(':batchUpdate',token,{requests:[{appendDimension:{sheetId:sheet.sheetId,dimension:'ROWS',length:Math.max(1000,lastRow-sheet.gridProperties.rowCount)}}]},'POST');
}
const safeErrors=new Set(['google_auth','sheet_access','sheet_unavailable','sheet_schema','sheet_not_configured','sheet_row_conflict','sheet_ack']);
async function sync(){
 const rows=await db('rpc/black_club_sync_claim',{});
 if(!rows.length)return {synced:0,pending:0};
 let synced=0,pending=0,setupError='';
 try{await ensureSheet(await googleToken(),Math.max(...rows.map((r:any)=>Number(r.sheet_row))));}catch(error){setupError=safeErrors.has(error.message)?error.message:'sync_unavailable';}
 for(const row of rows){
  const target=`black_club_cadastros?id=eq.${row.id}&sync_attempts=eq.${row.sync_attempts}&synced_at=is.null`;
  try{
   if(setupError)throw new Error(setupError);
   const token=await googleToken(),range=sheetRange(row.sheet_row);
   const current=await google(`values/${encodeURIComponent(range)}`,token);
   if(current.values?.[0]?.some((v:unknown)=>v!=null&&v!=='')&&current.values[0][0]!==row.id)throw new Error('sheet_row_conflict');
   const result=await google(`values/${encodeURIComponent(range)}?valueInputOption=RAW`,token,{range,majorDimension:'ROWS',values:[sheetValues(row)]});
   if(result.updatedCells!==HEADER.length)throw new Error('sheet_ack');
   await db(target,{synced_at:new Date().toISOString(),sync_lock_until:null,sync_error:null},'PATCH');synced++;
  }catch(error){
   const errorCode=safeErrors.has(error.message)?error.message:'sync_unavailable';
   const delay=Math.min(60,5*2**Math.min(row.sync_attempts-1,4));
   await db(target,{sync_lock_until:null,sync_error:errorCode,next_sync_at:new Date(Date.now()+delay*60000).toISOString()},'PATCH');pending++;
  }
 }
 return {synced,pending};
}
Deno.serve(createHandler({
 env:{syncToken:env('PERFIL_SYNC_TOKEN'),hashSecret:serviceKey},
 receive:(data:unknown,hash:string,ip:string)=>db('rpc/black_club_receber',{p_payload:data,p_hash:hash,p_ip_hash:ip}),
 sync,
 queueSync:()=>EdgeRuntime.waitUntil(sync().catch(()=>{}))
}));
