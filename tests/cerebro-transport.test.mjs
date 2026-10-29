import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {setupChat,answer} from './helpers/chat-handler.mjs';

const dataSource=readFileSync(new URL('../public/assets/club-data.js',import.meta.url),'utf8');
const uiSource=readFileSync(new URL('../public/assets/membros.js',import.meta.url),'utf8');
const history=[{role:'user',content:'Base anterior'},{role:'assistant',content:'100 leads, sem coorte.'}];
const result=(q='Pergunta')=>({resposta:'Resposta recuperada',historico:[...history,{role:'user',content:q},{role:'assistant',content:'Resposta recuperada'}]});
function client(fetcher,extra={}){
 const requests=[],logs=[],timers=new Map();let timerId=0;
 const Club={cfg:{supabaseUrl:'https://example.test'},sb:{auth:{getSession:async()=>({data:{session:{access_token:'PRIVATE_TOKEN',user:{id:'actor'}}}})}}};
 const context={window:{Club,crypto:globalThis.crypto},AbortController,
  setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),
  console:{warn:line=>logs.push(JSON.parse(line))},
  fetch:async(url,options)=>{requests.push(options);return fetcher(url,options);},...extra};
 vm.runInNewContext(dataSource,context);
 return {Club,requests,logs,timers,context};
}
test('rejeição de fetch vira falha recuperável sem expor mensagem bruta nem repetir POST',async()=>{
 const s=client(()=>{throw new TypeError('Failed to fetch PRIVATE_DETAIL');});
 await assert.rejects(s.Club.data.cerebro.perguntar('PRIVATE_QUESTION',history),e=>{
  assert.equal(e.code,'CHAT_NETWORK');assert.equal(e.retryable,true);
  assert.doesNotMatch(e.message,/Failed to fetch|PRIVATE/);return true;
 });
 assert.equal(s.requests.length,1);assert.equal(s.timers.size,0);
 assert.equal(s.logs[0].phase,'request');
 assert.equal(s.logs[0].request_id,JSON.parse(s.requests[0].body).request_id);
 assert.doesNotMatch(JSON.stringify(s.logs),/PRIVATE_|Base anterior|100 leads/);
});
test('corpo interrompido após HTTP 200 não vira resposta concluída',async()=>{
 const s=client(()=>({ok:true,status:200,json:async()=>{throw new TypeError('Failed to fetch');}}));
 await assert.rejects(s.Club.data.cerebro.perguntar('Pergunta',history),e=>e.code==='CHAT_NETWORK'&&e.retryable);
 assert.equal(s.logs[0].phase,'response');assert.equal(s.timers.size,0);
});
test('prazo do cliente aborta leitura pendente e libera nova tentativa',async()=>{
 const s=client((_url,{signal})=>({ok:true,status:200,json:()=>new Promise((_,reject)=>signal?.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))))}));
 const pending=s.Club.data.cerebro.perguntar('Pergunta',history);
 await new Promise(r=>setImmediate(r));assert.equal(s.timers.size,1);
 [...s.timers.values()][0]();
 await assert.rejects(pending,e=>e.code==='CHAT_TIMEOUT'&&e.retryable);
 assert.equal(s.requests[0].signal.aborted,true);assert.equal(s.timers.size,0);
});
for(const status of [429,502,503]){
 test('HTTP '+status+' sem JSON permite recuperação manual',async()=>{
  const s=client(()=>new Response('<html>gateway</html>',{status}));
  await assert.rejects(s.Club.data.cerebro.perguntar('Pergunta'),e=>e.code==='CHAT_HTTP_ERROR'&&e.retryable);
  assert.equal(s.requests.length,1);assert.equal(s.timers.size,0);
 });
}
for(const body of [null,{}, {resposta:'',historico:history},{resposta:'Parece OK',historico:[]},{resposta:'Parece OK',historico:[{role:'assistant',content:'órfão'}]}]){
 test('sucesso incompleto não apaga o histórico: '+JSON.stringify(body),async()=>{
  const s=client(()=>Response.json(body));
  await assert.rejects(s.Club.data.cerebro.perguntar('Pergunta',history),e=>e.code==='CHAT_INVALID_RESPONSE'&&e.retryable);
 });
}
test('403 não oferece retry mesmo com sinalização equivocada do corpo',async()=>{
 const s=client(()=>Response.json({erro:'Sem permissão',tentar_novamente:true},{status:403}));
 await assert.rejects(s.Club.data.cerebro.perguntar('Pergunta'),e=>e.retryable===false);
 assert.equal(s.requests.length,1);
});
test('cliente e UI recuperam a pergunta com contexto sem duplicar bolha ou incluir o erro',async()=>{
 let fail=true;
 const s=client(()=>{if(fail){fail=false;throw new TypeError('Failed to fetch');}return Response.json(result('Continue'));});
 const chat={falas:[{quem:'eu',texto:'Base anterior'},{quem:'ele',texto:'100 leads, sem coorte.'}],historico:structuredClone(history),pensando:false};
 const input={value:'',disabled:false,focus(){}},flow={innerHTML:'',scrollHeight:0};
 Object.assign(s.context,{chat,admin:false,st:{},$:(id)=>id==='chatInput'?input:flow,esc:String,ico:()=>'',bolha:(_who,text)=>text,Club:s.Club});
 vm.runInNewContext(uiSource.slice(uiSource.indexOf('  function renderChat('),uiSource.indexOf('  function renderGrupo(')),s.context);
 s.context.perguntar('Continue');await new Promise(r=>setImmediate(r));
 assert.match(flow.innerHTML,/data-chat-retry/);assert.equal(input.disabled,false);assert.deepEqual(chat.historico,history);
 s.context.perguntar('Continue',3);await new Promise(r=>setImmediate(r));
 assert.deepEqual(chat.falas.map(f=>f.texto),['Base anterior','100 leads, sem coorte.','Continue','Resposta recuperada']);
 const bodies=s.requests.map(r=>JSON.parse(r.body));assert.deepEqual(bodies[1].historico,history);
 assert.equal(bodies[1].pergunta,'Continue');assert.notEqual(bodies[0].request_id,bodies[1].request_id);
 assert.doesNotMatch(JSON.stringify(chat.historico),/Failed|NETWORK/);
 assert.equal(chat.pensando,false);assert.doesNotMatch(flow.innerHTML,/data-chat-retry/);
});
test('servidor correlaciona início e sucesso sem registrar pergunta ou resposta',async()=>{
 const id='12345678-1234-4234-8234-123456789012';
 const app=await setupChat({model:()=>answer('PRIVATE_ANSWER')});
 const r=await app.ask([],'PRIVATE_QUESTION',{request_id:id}),d=await r.json();
 assert.equal(d.request_id,id);
 const logs=app.logs.map(row=>JSON.parse(row[0])).filter(x=>x.evento==='cerebro_request');
 assert.deepEqual(logs.map(x=>x.estado),['started','completed']);
 assert.ok(logs.every(x=>x.request_id===id));
 assert.doesNotMatch(JSON.stringify(app.logs),/PRIVATE_|user-token|fixture-secret/);
});
test('servidor registra falha de transporte ao provedor sem vazar erro original',async()=>{
 const app=await setupChat({model:()=>{throw new TypeError('PRIVATE_UPSTREAM');}});
 const r=await app.ask([],'PRIVATE_QUESTION',{request_id:'invalid\nPRIVATE_INPUT'}),d=await r.json();
 assert.match(d.request_id,/^[0-9a-f-]{36}$/);assert.equal(r.status,502);
 const logs=app.logs.map(row=>JSON.parse(row[0])).filter(x=>x.evento==='cerebro_request');
 assert.equal(logs.at(-1).estado,'failed');assert.equal(logs.at(-1).codigo,'CHAT_FAILED');
 assert.doesNotMatch(JSON.stringify(app.logs)+JSON.stringify(d),/PRIVATE_|fixture-secret/);
});
test('erro do modelo mantém IDs distintos da tentativa e do provedor',async()=>{
 const id='12345678-1234-4234-8234-123456789012';
 const app=await setupChat({model:()=>Response.json({error:{message:'PRIVATE_ERROR'}},{status:429,headers:{'request-id':'provider-attempt'}})});
 await app.ask([],'PRIVATE_QUESTION',{request_id:id});
 const log=app.logs.map(x=>JSON.parse(x[0])).find(x=>x.evento==='cerebro_model_error');
 assert.equal(log.chat_request_id,id);assert.equal(log.request_id,'provider-attempt');
});

