import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate,createHandler,digest,sheetValues,HEADER} from '../supabase/functions/club-cadastro/core.mjs';
const base={submission_id:'c278820e-6462-4f3a-8b51-75516d7cd21e',nome:'QA Club Sintetico',whatsapp:'+12025550100',pagina:'/club/',utm:{utm_source:'qa',utm_medium:'qa',aid:'qa-club'}};
test('normaliza nome, UUID e atribuição, descartando campos não permitidos',async()=>{
 const a=validate({...base,nome:' QA   Club Sintetico ',submission_id:base.submission_id.toUpperCase(),utm:{...base.utm,email:'invalido'}});
 assert.deepEqual(a,{id:base.submission_id,nome:base.nome,whatsapp:base.whatsapp,pagina:'/club/',utm:base.utm});
 assert.equal(await digest(JSON.stringify(a)),await digest(JSON.stringify(validate({...base,utm:{aid:'qa-club',utm_medium:'qa',utm_source:'qa'}}))));
});
test('recusa contato, rota, UUID, honeypot, limites e formatos inválidos',()=>{
 for(const patch of [{nome:'QA'},{nome:'Nome 123'},{nome:'Nome\nSobrenome'},{nome:'N'.repeat(161)},{whatsapp:'11999999999'},{whatsapp:'+012025550100'},{whatsapp:'+12025550100123456'},{pagina:'/club/?nome=PII'},{submission_id:'errado'},{website:'bot'},{utm:[]},{utm:{utm_source:'x'.repeat(251)}}])assert.throws(()=>validate({...base,...patch}));
 assert.equal(validate({...base,nome:'João D’Ávila Sá',whatsapp:'+5511999999999'}).nome,'João D’Ávila Sá');
});
test('planilha tem 11 colunas e telefone permanece texto RAW',()=>{
 const values=sheetValues({...validate(base),created_at:'2026-10-23T20:00:00Z'});
 assert.equal(values.length,HEADER.length);assert.equal(values.length,11);assert.equal(values[1],'23/10/2026 17:00:00');assert.equal(values[3],'+12025550100');
});
function setup(overrides={}){
 const calls=[];let queued=0;
 const handler=createHandler({env:{hashSecret:'qa-fixture-secret',syncToken:'qa-sync-token'},receive:async(...args)=>{calls.push(args);return 'created';},queueSync:()=>queued++,sync:async()=>({synced:0,pending:0}),...overrides});
 const request=(body=base,options={})=>handler(new Request('https://example.invalid/club-cadastro',{method:'POST',headers:{Origin:'https://oftalmoblack.com.br','Content-Type':'application/json'},body:JSON.stringify(body),...options}));
 return {handler,request,calls,queued:()=>queued};
}
test('recibo só após commit e retorno reconhecido; erros de banco são opacos',async()=>{
 for(const result of ['created','existing']){
  const s=setup({receive:async()=>result});const r=await s.request();assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,id:base.submission_id});assert.equal(s.queued(),1);
 }
 for(const receive of [async()=>null,async()=>{throw new Error('private-database-message');}]){
  const s=setup({receive}),r=await s.request();assert.equal(r.status,503);assert.equal(s.queued(),0);assert.ok(!(await r.text()).includes('private-database-message'));
 }
});
test('conflito e cota não liberam CTA; falha do espelho não invalida cadastro durável',async()=>{
 for(const [result,status] of [['conflict',409],['rate_limit',429]]){const s=setup({receive:async()=>result});assert.equal((await s.request()).status,status);assert.equal(s.queued(),0);}
 assert.equal((await setup({queueSync:()=>{throw new Error('queue');}}).request()).status,200);
});
test('body/origem/content-type inválidos não chegam ao banco',async()=>{
 const s=setup();
 assert.equal((await s.request(base,{headers:{Origin:'https://evil.invalid','Content-Type':'application/json'}})).status,403);
 assert.equal((await s.request(base,{headers:{Origin:'https://oftalmoblack.com.br','Content-Type':'text/plain'}})).status,415);
 assert.equal((await s.request({...base,nome:'x'.repeat(9000)})).status,413);
 assert.equal((await s.request(base,{headers:{Origin:'https://oftalmoblack.com.br','Content-Type':'application/json','Content-Length':'9000'}})).status,413);
 assert.equal((await s.request(base,{body:'{bad-json'})).status,400);assert.equal(s.calls.length,0);
});
test('preflight e sync autenticada com segredo nunca disponível no browser',async()=>{
 const s=setup();
 const pre=await s.handler(new Request('https://example.invalid',{method:'OPTIONS',headers:{Origin:'https://oftalmoblack.com.br'}}));assert.equal(pre.status,204);assert.equal(pre.headers.get('Access-Control-Allow-Origin'),'https://oftalmoblack.com.br');
 assert.equal((await s.handler(new Request('https://example.invalid?sync=1',{method:'POST'}))).status,401);
 const sync=await s.handler(new Request('https://example.invalid?sync=1',{method:'POST',headers:{'x-club-sync-token':'qa-sync-token'}}));assert.equal(sync.status,200);
 assert.equal(s.calls.length,0);
});
