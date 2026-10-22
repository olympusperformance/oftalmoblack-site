import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,createHandler,sheetValues,EVENTO} from '../supabase/functions/black-presenca/core.mjs';
const id='602483f3-64e1-48d2-90ca-2a5b4302e81b';
const draft={submission_id:id,email:'  CHECKIN@example.invalid ',origem:'presencial',utm:{utm_source:'qa'},pagina:'/perfil-clinica/nivel-1/'};
const request=(body=draft,headers={})=>new Request('https://example.invalid/black-presenca',{method:'POST',headers:{origin:'https://oftalmoblack.com.br','content-type':'application/json',...headers},body:JSON.stringify(body)});
test('normaliza identidade mínima e evento é definido pelo servidor',()=>{
 const data=validate({...draft,evento:'inventado',member_id:'inventado',identificacao:'sessao_autenticada'});
 assert.equal(data.email,'checkin@example.invalid');assert.equal(data.evento,EVENTO);assert.equal(data.member_id,undefined);
 assert.equal(validate({...draft,email:null},true).email,null);
 for(const email of ['x@y','',null,'a'.repeat(255)+'@x.y'])assert.throws(()=>validate({...draft,email}));
 assert.throws(()=>validate({...draft,pagina:'/x?email=foo'}));
 assert.throws(()=>validate({...draft,utm:{utm_source:'x'.repeat(251)}}));
});
test('um ACK só acontece após gravação; não revela correspondência de membro',async()=>{
 let received=false,queued=0;
 const handler=createHandler({env:{hashSecret:'test'},resolveUser:async()=>null,receive:async(data,hash,ip,user)=>{assert.equal(user,null);assert.equal(data.email,'checkin@example.invalid');assert.equal(hash.length,64);assert.equal(ip.length,64);received=true;return 'created';},queueSync:()=>queued++,sync:async()=>({})});
 const res=await handler(request());assert.equal(received,true);assert.equal(queued,1);assert.equal(res.status,200);assert.deepEqual(await res.json(),{ok:true,id});
});
test('sessão validada no servidor, corpo não pode escolher outro membro',async()=>{
 const user='2e2cdb64-3b15-4dab-8b76-35d1035aa053';
 let calls=0;
 const handler=createHandler({env:{hashSecret:'test'},resolveUser:async(token)=>token==='valid'?user:null,receive:async(data,hash,ip,uid)=>{assert.equal(uid,user);assert.equal(data.email,null);calls++;return 'existing';},queueSync:()=>{},sync:async()=>({})});
 assert.equal((await handler(request({...draft,email:'spoof@x.y'},{'x-member-token':'valid'}))).status,200);
 const invalid=await handler(request(draft,{'x-member-token':'invalid'}));assert.equal(invalid.status,401);assert.equal((await invalid.json()).code,'identity_required');assert.equal(calls,1);
});
test('falha de banco não confirma, limites e CORS são respeitados',async()=>{
 let result='created',throws=false;
 const handler=createHandler({env:{hashSecret:'test'},resolveUser:async()=>null,receive:async()=>{if(throws)throw Error('private error');return result;},queueSync:()=>{},sync:async()=>({})});
 for(const [code,status] of [['conflict',409],['rate_limit',429],['identity_required',401],['unexpected',503]]){result=code;assert.equal((await handler(request())).status,status);}
 throws=true;const failed=await handler(request());assert.equal(failed.status,503);assert.equal((await failed.text()).includes('private error'),false);
 assert.equal((await handler(request(draft,{origin:'https://evil.invalid'}))).status,403);
 assert.equal((await handler(request({padding:'a'.repeat(4200)}))).status,413);
 assert.equal((await handler(new Request('https://example.invalid/?sync=1',{method:'POST'}))).status,401);
});
test('planilha distingue e-mail autodeclarado e sessão, sem fórmulas e com data numérica',()=>{
 const row={id,created_at:'2026-10-22T12:30:00Z',evento:EVENTO,nome:'=TEST',email:'checkin@example.invalid',identificacao:'email_informado',member_id:null,origem:'presencial',utm:{utm_source:'=IMPORTDATA("x")'},pagina:draft.pagina};
 const values=sheetValues(row);assert.equal(values.length,15);assert.equal(typeof values[1],'number');assert.equal(values[3],'=TEST');assert.equal(values[6],'E-mail informado');assert.equal(values[7],'Conferir cadastro');
 assert.equal(sheetValues({...row,member_id:'member',identificacao:'sessao_autenticada'})[6],'Sessão autenticada');
});
