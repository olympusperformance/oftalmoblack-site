import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,validateAnswers,VERSION} from '../supabase/functions/sdr-onboarding/core.mjs';

const token='a'.repeat(64), member='00000000-0000-4000-8000-000000000001', id='10000000-0000-4000-8000-000000000001';
const request=(h,body,auth='')=>h(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://oftalmoblack.com.br','content-type':'application/json',authorization:auth},body:JSON.stringify(body)}));
test('ficha conserva respostas parciais e recusa dados fora do contrato',()=>{
 assert.deepEqual(validateAnswers({plano_suspenso:'A definir',sinal:'Sem sinal'}),{plano_suspenso:'A definir',sinal:'Sem sinal'});
 for(const bad of [{},{plano_suspenso:8},{senha:'teste'},{plano_suspenso:'a'.repeat(3001)}])assert.throws(()=>validateAnswers(bad));
});
test('link é individual, somente equipe emite e token nunca chega ao banco em claro',async()=>{
 let issued;const h=createHandler({admin:async h=>h==='Bearer valid'?'staff':false,issue:async x=>{issued=x},load:async()=>null,submit:async()=>({status:'created',id}),revoke:async()=>{}});
 assert.equal((await request(h,{action:'issue',member_id:member})).status,403);
 const r=await request(h,{action:'issue',member_id:member},'Bearer valid'),d=await r.json();assert.equal(r.status,200);assert.equal(d.token.length,64);assert.notEqual(issued.token_hash,d.token);assert.equal(issued.member_id,member);
});
test('resposta não aceita membro escolhido pelo navegador e não ativa agente',async()=>{
 let sent;const h=createHandler({admin:async()=>false,issue:async()=>{},revoke:async()=>{},load:async()=>null,submit:async a=>{sent=a;return {status:'created',id}}});
 assert.equal((await request(h,{action:'submit',token,version:VERSION,submission_id:id,answers:{plano_suspenso:'A definir'},member_id:member})).status,400);
 assert.equal((await request(h,{action:'submit',token,version:VERSION,submission_id:id,answers:{plano_suspenso:'A definir'}})).status,200);assert.equal('p_member_id' in sent,false);
});
test('expiração e conflito não são tratados como sucesso',async()=>{
 for(const [result,status] of [['invalid_link',410],['conflict',409],['rate_limit',429]]){const h=createHandler({admin:async()=>false,issue:async()=>{},revoke:async()=>{},load:async()=>null,submit:async()=>({status:result})});assert.equal((await request(h,{action:'submit',token,version:VERSION,submission_id:id,answers:{plano_suspenso:'Sem atendimento'}})).status,status);}
});
