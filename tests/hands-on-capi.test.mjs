import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,application,metaEvent,eventId} from '../supabase/functions/hands-on-capi/core.mjs';
const id='ec797901-a4bb-439f-9f3b-259ea5aa7bd8';
// This harness exercises the preserved spreadsheet receiver, now limited to v0.
const candidate={schema_version:1,produto:'hands_on_grau_zero',request_id:id,nome:'Teste Privado',whatsapp:'5511999990000',crm:'12345',uf:'AM',experiencia_catarata:'ainda_nao_opero',cirurgias_mes:0,experiencia_lentes:'ainda_nao_implanto',oferta_premium:'nao',clinica:'nao',objetivo:'Texto privado nunca enviado a Meta',page:'https://oftalmoblack.com.br/hands-on-grau-zero/v0/',utm_source:'ig',utm_medium:'stories'};
function harness(){
 const rows=new Map(),traffic=[],pending=[];let sheets=0,metaCalls=0,metaMode='ok',sheetMode='ok';
 const env={metaToken:'private-meta-token',dispatchKey:'dispatch-secret',testKey:'test-secret',anonKey:'public-anon',sheetEndpoint:'https://sheet.test/',productionEnabled:true};
 const db={
  get:async id=>rows.get(id),rate:async()=>true,
  insert:async row=>{if(!rows.has(row.event_id))rows.set(row.event_id,{...row,attempts:0,created_at:new Date().toISOString()});return rows.get(row.event_id);},
  claim:async()=>{const due=[...rows.values()].filter(x=>x.status==='pending');for(const r of due){r.status='processing';r.attempts++;}return due.map(x=>structuredClone(x));},
  finish:async(id,attempts,update)=>{const r=rows.get(id);if(r.attempts===attempts)Object.assign(r,update);}
 };
 const fetcher=async(url,options)=>{
  const body=JSON.parse(options.body);traffic.push({url,body});
  if(url===env.sheetEndpoint){sheets++;if(sheetMode==='failure')return Response.json({ok:false});return Response.json({ok:true,request_id:sheetMode==='wrong'?'wrong-id':body.request_id});}
  metaCalls++;if(metaMode==='network')throw new Error('network');
  return Response.json(metaMode==='blocked'?{error:{code:190}}:metaMode==='retry'?{error:{code:2,is_transient:true}}:{events_received:1,messages:[],fbtrace_id:'trace'},{status:metaMode==='ok'?200:400});
 };
 const handler=createHandler({env,db,fetcher,background:p=>pending.push(p)});
 const req=(body,extra={})=>new Request('https://edge.test/',{method:'POST',headers:{origin:'https://oftalmoblack.com.br',apikey:'public-anon','user-agent':'test-browser','x-forwarded-for':'192.0.2.10',...extra},body:JSON.stringify(body)});
 const run=async(body,extra)=>{const r=await handler(req(body,extra));return {status:r.status,body:await r.json()};};
 const drain=async()=>{while(pending.length)await Promise.all(pending.splice(0));};
 return {env,rows,traffic,handler,req,run,drain,get sheets(){return sheets;},get metaCalls(){return metaCalls;},set metaMode(x){metaMode=x;},set sheetMode(x){sheetMode=x;}};
}
test('saves the sheet before one Lead; retries do not save or send twice',async()=>{
 const h=harness();const a=await h.run(candidate);assert.equal(a.body.ok,true);assert.equal(h.sheets,1);await h.drain();assert.equal(h.metaCalls,1);
 const b=await h.run(candidate);await h.drain();assert.equal(b.body.request_id,id);assert.equal(h.sheets,1);assert.equal(h.metaCalls,1);
 const row=h.rows.get(eventId(id,'Lead'));assert.equal(row.sheet_confirmed,true);assert.equal(row.status,'accepted');assert(!row.event_payload.user_data);
 const sent=h.traffic.find(x=>x.url.includes('facebook')).body.data[0];assert.equal(sent.event_id,eventId(id,'Lead'));assert.match(sent.user_data.ph[0],/^[a-f0-9]{64}$/);
 for(const value of ['Teste Privado','12345','Texto privado','5511999990000'])assert(!JSON.stringify(sent).includes(value));
});
test('sheet failure or divergent receipt produces no Lead',async()=>{
 for(const mode of ['failure','wrong']){const h=harness();h.sheetMode=mode;const r=await h.run(candidate);await h.drain();assert.equal(r.body.ok,false);assert.equal(h.rows.size,0);assert.equal(h.metaCalls,0);}
});
test('changed payload cannot reuse a saved request id',async()=>{const h=harness();await h.run(candidate);await h.drain();const r=await h.run({...candidate,objetivo:'alterado'});assert.equal(r.status,409);assert.equal(h.sheets,1);});
test('Meta failure does not block saved application; retry keeps event_time and event_id',async()=>{
 const h=harness();h.metaMode='network';const r=await h.run(candidate);await h.drain();assert.equal(r.body.ok,true);assert.equal(h.rows.get(eventId(id,'Lead')).status,'pending');
 h.metaMode='ok';await h.run({op:'dispatch'},{'x-hogz-dispatch':'dispatch-secret'});assert.equal(h.metaCalls,2);
 const requests=h.traffic.filter(x=>x.url.includes('facebook'));assert.deepEqual(requests[0].body,requests[1].body);
});
test('permanent Meta error is retained as blocked',async()=>{const h=harness();h.metaMode='blocked';await h.run(candidate);await h.drain();assert.equal(h.rows.get(eventId(id,'Lead')).status,'blocked');});
test('public QA never exports; protected TEST persists its own test_event_code',async()=>{
 const qa=harness();await qa.run({...candidate,utm_source:'QA'});await qa.drain();assert.equal(qa.metaCalls,0);assert.equal(qa.rows.get(eventId(id,'Lead')).mode,'qa');
 const h=harness();assert.equal((await h.run({...candidate,test_event_code:'TEST123'})).status,403);
 assert.equal((await h.run({...candidate,test_event_code:'TEST123'},{'x-hogz-test':'test-secret'})).body.tracking_mode,'test');await h.drain();
 assert.equal(h.traffic.find(x=>x.url.includes('facebook')).body.test_event_code,'TEST123');
});
test('only PageView and ViewContent can be generated by the visit endpoint',async()=>{
 const h=harness();await h.run({op:'visit',page_id:id,event_name:'Purchase'});await h.drain();assert.equal(h.sheets,0);assert.equal(h.metaCalls,2);
 assert.deepEqual([...h.rows.values()].map(x=>x.event_name),['PageView','ViewContent']);
 await h.run({op:'visit',page_id:id});await h.drain();assert.equal(h.metaCalls,2);
});
test('unauthorized origins/keys cannot submit or dispatch',async()=>{
 const h=harness();for(const extra of [{origin:'https://evil.test'},{apikey:'wrong'}])assert.equal((await h.run(candidate,extra)).status,403);
 assert.equal((await h.run({op:'dispatch'})).status,401);assert.equal(h.sheets,0);
});
test('validation accepts non-surgeon and zero volume, rejects foreign page/invalid enums',()=>{
 assert.equal(application(candidate).cirurgias_mes,0);for(const change of [{uf:'ZZ'},{page:'https://evil.test/'},{crm:'abc'},{cirurgias_mes:-1}])assert.throws(()=>application({...candidate,...change}));
});
test('preserved v0 application receives one durable receipt and the same Lead on replay',async()=>{
 for(const host of ['oftalmoblack.com.br','www.oftalmoblack.com.br'])for(const suffix of ['','index.html']){
  const h=harness(),input={...candidate,page:`https://${host}/hands-on-grau-zero/v0/${suffix}`,utm_source:'qa'};
  const first=await h.run(input);assert.equal(first.status,200,JSON.stringify(first.body));
  const replay=await h.run(input);await h.drain();
  assert.equal(first.body.request_id,id);assert.equal(replay.body.event_id,eventId(id,'Lead'));
  assert.equal(h.sheets,1);assert.equal(h.rows.size,1);assert.equal(h.metaCalls,0);
 }
});
test('v0 allowlist rejects lookalike hosts, subpaths, queries and foreign protocols before saving',async()=>{
 for(const page of ['https://oftalmoblack.com.br.evil.test/hands-on-grau-zero/v0/',
  'https://oftalmoblack.com.br/hands-on-grau-zero/v0/other/',
  'https://oftalmoblack.com.br/hands-on-grau-zero/v0/?email=private@example.test',
  'http://oftalmoblack.com.br/hands-on-grau-zero/v0/']){
  const h=harness();assert.equal((await h.run({...candidate,page})).status,400);assert.equal(h.sheets,0);
 }
});
test('matching uses only hash of phone plus actual browser identifiers',async()=>{
 const h=harness();const e=await metaEvent('Lead',id,{fbp:'fb.1.12345.45678',fbc:'fb.1.12345.real-click',objetivo:'private'},h.req({}),Date.now(),'11999990000');
 assert.equal(e.user_data.fbc,'fb.1.12345.real-click');assert.equal(e.user_data.client_ip_address,'192.0.2.10');assert(!JSON.stringify(e).includes('private'));assert(!e.user_data.external_id);
});
test('production gate does not permit traffic before homologation',async()=>{
 const h=harness();h.env.productionEnabled=false;assert.equal((await h.run(candidate)).status,503);assert.equal(h.sheets,0);
 assert.equal((await h.run({...candidate,test_event_code:'TEST123'},{'x-hogz-test':'test-secret'})).body.ok,true);await h.drain();
});
test('TEST access can be revoked without affecting production or changing the dataset',async()=>{
 const h=harness();h.env.testKey='';assert.equal((await h.run({...candidate,test_event_code:'TEST123'},{'x-hogz-test':'test-secret'})).status,403);
 assert.equal((await h.run(candidate)).body.ok,true);await h.drain();assert.equal(h.metaCalls,1);
});
