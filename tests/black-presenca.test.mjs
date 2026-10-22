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
 assert.equal('nome' in data,false);
 assert.equal(JSON.stringify(data),JSON.stringify({id,evento:EVENTO,email:'checkin@example.invalid',origem:'presencial',utm:{utm_source:'qa'},pagina:draft.pagina}));
 for(const email of ['x@y','',null,'a'.repeat(255)+'@x.y'])assert.throws(()=>validate({...draft,email}));
 assert.throws(()=>validate({...draft,pagina:'/x?email=foo'}));
 assert.throws(()=>validate({...draft,utm:{utm_source:'x'.repeat(251)}}));
});
test('aceita somente nome informado sem e-mail e ignora data/identidade forjadas',()=>{
 const data=validate({...draft,email:undefined,nome:'  Dra.   Joana Sá  ',dia_presenca:'1999-01-01',day:'1999-01-01',member_id:'forjado'});
 assert.equal(data.nome,'Dra. Joana Sá');assert.equal(data.email,null);assert.equal(data.day,undefined);assert.equal(data.dia_presenca,undefined);assert.equal(data.member_id,undefined);
 for(const nome of ['', 'A','Dr.','1234','a'.repeat(161),'Ana\nOutra'])assert.throws(()=>validate({...draft,nome}));
});
test('ACK devolve o dia persistido e não calcula o dia no navegador',async()=>{
 const handler=createHandler({env:{hashSecret:'test'},resolveUser:async()=>null,receive:async(data)=>{assert.equal(data.nome,'QA Diário');return {status:'existing',day:'2026-10-22'};},queueSync:()=>{},sync:async()=>({})});
 const res=await handler(request({...draft,email:undefined,nome:'QA Diário',day:'2026-10-23'}));assert.equal(res.status,200);assert.equal((await res.json()).day,'2026-10-22');
});
test('um ACK só acontece após gravação; não revela correspondência de membro',async()=>{
 let received=false,queued=0;
 const handler=createHandler({env:{hashSecret:'test'},resolveUser:async()=>null,receive:async(data,hash,ip,user)=>{assert.equal(user,null);assert.equal(data.email,'checkin@example.invalid');assert.equal(hash.length,64);assert.equal(ip.length,64);received=true;return {status:'created',day:'2026-10-22'};},queueSync:()=>queued++,sync:async()=>({})});
 const res=await handler(request());assert.equal(received,true);assert.equal(queued,1);assert.equal(res.status,200);assert.deepEqual(await res.json(),{ok:true,id,day:'2026-10-22'});
});
test('sessão validada no servidor, corpo não pode escolher outro membro',async()=>{
 const user='2e2cdb64-3b15-4dab-8b76-35d1035aa053';
 let calls=0;
 const handler=createHandler({env:{hashSecret:'test'},resolveUser:async(token)=>token==='valid'?user:null,receive:async(data,hash,ip,uid)=>{assert.equal(uid,user);assert.equal(data.email,null);calls++;return {status:'existing',day:'2026-10-22'};},queueSync:()=>{},sync:async()=>({})});
 assert.equal((await handler(request({...draft,email:'spoof@x.y'},{'x-member-token':'valid'}))).status,200);
 const invalid=await handler(request(draft,{'x-member-token':'invalid'}));assert.equal(invalid.status,401);assert.equal((await invalid.json()).code,'identity_required');assert.equal(calls,1);
});
test('falha de banco não confirma, limites e CORS são respeitados',async()=>{
 let result={status:'created',day:'2026-10-22'},throws=false;
 const handler=createHandler({env:{hashSecret:'test'},resolveUser:async()=>null,receive:async()=>{if(throws)throw Error('private error');return result;},queueSync:()=>{},sync:async()=>({})});
 for(const [code,status] of [['conflict',409],['rate_limit',429],['identity_required',401],['unexpected',503]]){result={status:code};assert.equal((await handler(request())).status,status);}
 throws=true;const failed=await handler(request());assert.equal(failed.status,503);assert.equal((await failed.text()).includes('private error'),false);
 assert.equal((await handler(request(draft,{origin:'https://evil.invalid'}))).status,403);
 assert.equal((await handler(request({padding:'a'.repeat(4200)}))).status,413);
 assert.equal((await handler(new Request('https://example.invalid/?sync=1',{method:'POST'}))).status,401);
});
test('planilha distingue e-mail autodeclarado e sessão, sem fórmulas e com data numérica',()=>{
 const row={id,created_at:'2026-10-22T12:30:00Z',dia_presenca:'2026-10-22',evento:EVENTO,nome:'=TEST',email:'checkin@example.invalid',identificacao:'email_informado',member_id:null,origem:'presencial',utm:{utm_source:'=IMPORTDATA("x")'},pagina:draft.pagina};
 const values=sheetValues(row);assert.equal(values.length,16);assert.equal(typeof values[1],'number');assert.equal(values[3],'=TEST');assert.equal(values[6],'E-mail informado');assert.equal(values[7],'Conferir cadastro');
 assert.equal(sheetValues({...row,member_id:'member',identificacao:'sessao_autenticada'})[6],'Sessão autenticada');
 const named=sheetValues({...row,email:null,nome:'QA Diário',identificacao:'nome_informado'});assert.equal(named[4],'');assert.equal(named[6],'Nome informado');assert.equal(named[15],Date.UTC(2026,9,22)/86400000+25569);
});
