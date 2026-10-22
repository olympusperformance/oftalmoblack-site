import test from 'node:test';import assert from 'node:assert/strict';
import {createHandler,sha256,readAll} from '../supabase/functions/black-presencas-lista/core.mjs';
const key='a'.repeat(48),hash=await sha256(key),url='https://example.test/lista';
const req=(token=key,origin='https://oftalmoblack.com.br')=>new Request(url,{method:'POST',headers:{'x-presenca-view-key':token,Origin:origin}});
test('lista exige chave valida e origem permitida antes da leitura',async()=>{
 let calls=0;const h=createHandler({keyHash:hash,read:async()=>{calls++;return[];}});
 assert.equal((await h(req(''))).status,401);assert.equal((await h(req('b'.repeat(48)))).status,401);assert.equal((await h(req(key,'https://evil.test'))).status,403);assert.equal(calls,0);
 assert.equal((await createHandler({read:async()=>[]})(req())).status,401);
});
test('DTO minimo, dias restritos, sem contatos ou dados da base de membros',async()=>{
 const h=createHandler({keyHash:hash,read:async()=>[{id:'uuid',nome:'Nome informado',dia_presenca:'2026-10-22',created_at:'2026-10-22T12:00:00Z',email:'private@invalid',member_id:'private',request_hash:'private'},{nome:'Fora',dia_presenca:'2026-11-01'}]});
 const r=await h(req()),data=await r.json();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(data.presencas.length,1);assert.deepEqual(Object.keys(data.presencas[0]).sort(),['id','nome','dia','registrada_em'].sort());assert(!JSON.stringify(data).includes('private'));
});
test('CORS, metodo e falha de leitura nao vazam dados',async()=>{
 const h=createHandler({keyHash:hash,read:async()=>{throw Error('secret');}});
 const r=await h(req());assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false});assert.equal((await h(new Request(url))).status,405);assert.equal((await h(new Request(url,{method:'OPTIONS',headers:{Origin:'https://oftalmoblack.com.br'}}))).status,204);
});
test('pagina ate o total mesmo quando o servidor limita linhas',async()=>{
 const source=Array.from({length:1200},(_,i)=>({id:i})),offsets=[];
 const rows=await readAll(async offset=>{offsets.push(offset);return {rows:source.slice(offset,offset+500),total:1200};});
 assert.equal(rows.length,1200);assert.deepEqual(offsets,[0,500,1000]);
 await assert.rejects(readAll(async()=>({rows:[],total:1})),/incomplete/);
});
