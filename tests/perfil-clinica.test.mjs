import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate,createHandler,sheetValues,digest,ensureSheetCapacity} from '../supabase/functions/perfil-clinica/core.mjs';
const base={submission_id:'21b241f0-9a57-4df0-b951-cf31d975e645',nome:'Dra. Teste Ção',email:'teste@example.invalid',whatsapp:'+5592999990000',lentes_premium:true,volume_lentes:'6_10',faturamento:'100_200',desafios:['equipe_processos','atrair_particulares'],origem:'stories',utm:{utm_source:'ig',utm_medium:'stories'},pagina:'/perfil-clinica/'};
test('ficha na home preserva a página real e o aid sem alterar a grade da planilha',()=>{
 const data=validate({...base,pagina:'/',origem:'direto',utm:{...base.utm,aid:'123456789'}});
 assert.equal(data.pagina,'/');assert.equal(data.utm.aid,'123456789');
 assert.equal(sheetValues({...data,created_at:'2026-10-24T15:00:00Z'}).length,17);
});
test('preserva múltiplos desafios e normaliza hash para mesma seleção',async()=>{
 const a=validate(base),b=validate({...base,desafios:base.desafios.toReversed()});
 assert.deepEqual(a.desafios,['atrair_particulares','equipe_processos']);
 assert.equal(await digest(JSON.stringify(a)),await digest(JSON.stringify(b)));
});
test('Não elimina volume obsoleto; Sim exige volume válido',()=>{
 assert.equal(validate({...base,lentes_premium:false}).volume_lentes,null);
 assert.throws(()=>validate({...base,volume_lentes:null}));
 assert.throws(()=>validate({...base,lentes_premium:'false'}));
});
test('Outro exige texto; desmarcado elimina texto antigo; mínimo de um desafio',()=>{
 assert.throws(()=>validate({...base,desafios:['outro']}));
 assert.throws(()=>validate({...base,desafios:[]}));
 assert.throws(()=>validate({...base,desafios:['outro'],outro_desafio:'x'.repeat(501)}));
 assert.equal(validate({...base,outro_desafio:'antigo'}).outro_desafio,null);
 assert.equal(validate({...base,desafios:['outro','dependencia'],outro_desafio:'Outro motivo'}).outro_desafio,'Outro motivo');
});
test('contatos, categorias e limites são validados no servidor',()=>{
 for(const patch of [{whatsapp:'92999990000'},{email:'ruim'},{nome:' '},{faturamento:'falso'},{desafios:['falso']},{utm:{utm_campaign:'x'.repeat(251)}},{pagina:'/perfil-clinica/?email=teste'}])assert.throws(()=>validate({...base,...patch}));
 assert.equal(validate({...base,whatsapp:'+351912345678',origem:'falso'}).origem,'direto');
});
test('planilha escreve valores RAW e mantém todas as respostas',()=>{
 const values=sheetValues({...validate({...base,nome:'=1+1'}),created_at:'2026-10-21T00:00:00Z'});
 assert.equal(values.length,17);assert.equal(values[2],'=1+1');assert.equal(values[8],'Atrair mais pacientes particulares; Organizar a equipe e os processos');
 assert.equal(typeof values[1],'number');
});
test('espelho expande grade por append antes de ultrapassar capacidade',async()=>{
 const calls=[];const google=async(...args)=>{calls.push(args);return {sheets:[{properties:{sheetId:7,title:'Cadastros',gridProperties:{rowCount:1000}}}]};};
 await ensureSheetCapacity(google,'fixture',1001);
 assert.equal(calls.length,2);assert.equal(calls[1][3],'POST');
 assert.deepEqual(calls[1][2],{requests:[{appendDimension:{sheetId:7,dimension:'ROWS',length:1000}}]});
 calls.length=0;await ensureSheetCapacity(google,'fixture',1000);assert.equal(calls.length,1);
 await assert.rejects(ensureSheetCapacity(async()=>({sheets:[]}),'fixture',2));
});
function setup(overrides={}){
 const received=[];let queued=0;
 const handler=createHandler({env:{syncToken:'fixture-token',hashSecret:'fixture-only'},receive:async(...args)=>{received.push(args);return 'created';},sync:async()=>({synced:0,pending:0}),queueSync:()=>queued++,...overrides});
 const req=(body=base,options={})=>handler(new Request('https://example.invalid/perfil-clinica',{method:'POST',headers:{Origin:'https://oftalmoblack.com.br','Content-Type':'application/json'},body:JSON.stringify(body),...options}));
 return {req,received,queued:()=>queued,handler};
}
test('ACK só depois de gravação durável; erro DB não confirma nem agenda',async()=>{
 const ok=setup();const res=await ok.req();assert.equal(res.status,200);assert.deepEqual(await res.json(),{ok:true,id:base.submission_id});assert.equal(ok.received.length,1);assert.equal(ok.queued(),1);
 const bad=setup({receive:async()=>{throw new Error('private-detail');}});const failed=await bad.req();assert.equal(failed.status,503);assert.equal(bad.queued(),0);assert.ok(!(await failed.text()).includes('private-detail'));
});
test('origem arbitrária, payload grande e sem autorização de sync são rejeitados',async()=>{
 const s=setup();
 assert.equal((await s.req(base,{headers:{Origin:'https://evil.invalid','Content-Type':'application/json'}})).status,403);
 assert.equal((await s.req({...base,nome:'x'.repeat(9000)})).status,413);
 assert.equal((await s.handler(new Request('https://x.invalid/?sync=1',{method:'POST'}))).status,401);
 assert.equal(s.received.length,0);
});
test('conflito, cota, pré-flight e sincronização autenticada',async()=>{
 for(const [result,status] of [['conflict',409],['rate_limit',429]])assert.equal((await setup({receive:async()=>result}).req()).status,status);
 const s=setup();
 const pre=await s.handler(new Request('https://x.invalid',{method:'OPTIONS',headers:{Origin:'https://oftalmoblack.com.br'}}));assert.equal(pre.status,204);assert.equal(pre.headers.get('Access-Control-Allow-Origin'),'https://oftalmoblack.com.br');
 const sync=await s.handler(new Request('https://x.invalid/?sync=1',{method:'POST',headers:{'x-perfil-sync-token':'fixture-token'}}));assert.equal(sync.status,200);
});
