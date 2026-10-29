import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,eventId} from '../supabase/functions/hands-on-capi/core.mjs';
const id='a416f94b-d3ea-4abc-9bad-a7fa99d73202';
const candidate={schema_version:1,produto:'hands_on_grau_zero',request_id:id,nome:'Pessoa Técnica',whatsapp:'5511999990000',crm:'999999',uf:'AM',experiencia_catarata:'ainda_nao_opero',cirurgias_mes:0,experiencia_lentes:'ainda_nao_implanto',oferta_premium:'nao',clinica:'nao',objetivo:'',page:'https://oftalmoblack.com.br/hands-on-grau-zero/',qa:true};
function harness(result={ok:true,request_id:id,status:'applied'}){
 const rows=new Map();let captures=0;
 const db={get:async key=>rows.get(key),insert:async row=>{rows.set(row.event_id,row);return row;},rate:async()=>true,claim:async()=>[],finish:async()=>{}};
 const env={anonKey:'public-key',crmEnabled:true,productionEnabled:true};
 const captureCrm=async(payload,mode)=>{captures++;assert.equal(mode,'qa');if(result instanceof Error)throw result;return result;};
 const handler=createHandler({env,db,captureCrm,fetcher:async()=>{throw new Error('spreadsheet_or_external_call_forbidden');}});
 const run=async(payload=candidate)=>{
  const r=await handler(new Request('https://web.test/',{method:'POST',headers:{origin:'https://oftalmoblack.com.br',apikey:'public-key','user-agent':'QA'},body:JSON.stringify(payload)}));return {status:r.status,body:await r.json()};
 };
 return {env,rows,run,get captures(){return captures;}};
}
test('principal confirma captura no CRM antes do Lead e nunca chama planilha',async()=>{
 const h=harness();const r=await h.run();assert.equal(r.body.ok,true);assert.equal(h.captures,1);
 assert.equal(r.body.capture_store,'crm');assert.equal(r.body.crm_status,'applied');
 const row=h.rows.get(eventId(id,'Lead'));assert.equal(row.capture_confirmed,true);assert.equal(row.sheet_confirmed,false);assert.equal(row.capture_store,'crm');
});
test('erro ou recibo divergente do banco não confirma nem emite Lead',async()=>{
 for(const receipt of [new Error('unavailable'),{ok:false},{ok:true,request_id:'other',status:'applied'}]){
  const h=harness(receipt);const r=await h.run();assert.equal(r.body.ok,false);assert.equal(h.rows.size,0);
 }
});
test('retry da captura confirmada mantém identidade e não repete integração',async()=>{
 const h=harness();const first=await h.run(),again=await h.run();assert.equal(first.body.request_id,again.body.request_id);assert.equal(h.captures,1);assert.equal(h.rows.size,1);
});
test('recibo de revisão conserva o estado na repetição',async()=>{
 const h=harness({ok:true,request_id:id,status:'review'});
 assert.equal((await h.run()).body.crm_status,'review');
 assert.equal((await h.run()).body.crm_status,'review');
});
test('integração indisponível fica fechada, sem usar receptor legado como fallback',async()=>{
 const h=harness();h.env.crmEnabled=false;assert.equal((await h.run()).status,503);assert.equal(h.captures,0);assert.equal(h.rows.size,0);
});
