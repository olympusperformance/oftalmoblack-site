import {createHandler} from './core.mjs';
const env={
  metaToken:Deno.env.get('HOGZ_META_TOKEN')||'',
  dispatchKey:Deno.env.get('HOGZ_DISPATCH_KEY')||'',
  testKey:Deno.env.get('HOGZ_TEST_KEY')||'',
  anonKey:Deno.env.get('HOGZ_PUBLIC_KEY')||'',
  sheetEndpoint:Deno.env.get('HOGZ_SHEET_ENDPOINT')||'',
  productionEnabled:Deno.env.get('HOGZ_PRODUCTION_ENABLED')==='true',
  crmEnabled:Deno.env.get('HOGZ_CRM_ENABLED')==='true'
};
const base=Deno.env.get('SUPABASE_URL')+'/rest/v1/';
const headers={'apikey':Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,'Authorization':'Bearer '+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'};
async function rest(path:string,method='GET',body?:unknown,prefer=''){
  const r=await fetch(base+path,{method,headers:{...headers,...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error('database_unavailable');
  return r.status===204?null:await r.json();
}
const db={
  get:async(id:string)=>(await rest('hogz_capi_outbox?event_id=eq.'+encodeURIComponent(id)+'&select=*'))[0],
  insert:async(row:Record<string,unknown>)=>{
    const result=await rest('hogz_capi_outbox?on_conflict=event_id','POST',row,'resolution=ignore-duplicates,return=representation');
    return result[0]||await db.get(String(row.event_id));
  },
  rate:(bucket:string,limit:number)=>rest('rpc/hogz_capi_rate','POST',{p_bucket:bucket,p_limit:limit}),
  claim:(limit:number)=>rest('rpc/hogz_capi_claim','POST',{p_limit:limit}),
  finish:(id:string,attempts:number,update:unknown)=>rest('hogz_capi_outbox?event_id=eq.'+encodeURIComponent(id)+'&attempts=eq.'+attempts,'PATCH',update)
};
const captureCrm=async(application:Record<string,unknown>,mode:string)=>{
  const key=Deno.env.get('HOGZ_CRM_INGEST_KEY')||'';
  if(key.length<32)throw new Error('crm_unavailable');
  const response=await fetch('https://nivzxddpiljajfjlpydj.supabase.co/functions/v1/b2b-application-intake',{
    method:'POST',headers:{'Content-Type':'application/json','x-hogz-crm-key':key},
    body:JSON.stringify({request_id:application.request_id,application,mode}),signal:AbortSignal.timeout(16000)
  });
  if(!response.ok)throw Object.assign(new Error('crm_unconfirmed'),{status:response.status===409?409:503});
  return await response.json();
};
const handler=createHandler({env,db,captureCrm,background:(p:Promise<unknown>)=>EdgeRuntime.waitUntil(p.catch(()=>{}))});
Deno.serve(handler);
