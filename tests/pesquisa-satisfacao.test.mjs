import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

let dir, child, base;
const legacy = { resposta_id: 'legacy-0001', perfil: 'mestre', dias: ['22'], nps_evento: 9, versao: '2026-10-24', recebido_em: '2026-10-24T20:00:00Z' };
const legacyLine = JSON.stringify(legacy) + '\n';
const key = 'synthetic-local-test-only';
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pesquisa-test-'));
  await writeFile(join(dir, 'respostas.jsonl'), legacyLine);
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  base = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, ['operacao/pesquisa-satisfacao/server.mjs'], {env:{...process.env, PORT:String(port), DATA_DIR:dir, CHAVE_PAINEL:key}, stdio:'ignore'});
  for (let i=0;i<80;i++) {
    try { if ((await fetch(base+'/api/pesquisa/saude')).ok) return; } catch {}
    await new Promise(r=>setTimeout(r,50));
  }
  throw new Error('local test server did not start');
});
after(async()=>{
  if(child && child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
  await rm(dir,{recursive:true,force:true});
});
async function post(data){const r=await fetch(base+'/api/pesquisa/respostas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(r.status,201);return r.json();}
async function results(tests=false){const r=await fetch(base+'/api/pesquisa/resultados'+(tests?'?fonte=testes':''),{headers:{Authorization:'Bearer '+key}});assert.equal(r.status,200);return (await r.json()).respostas;}
function payload(id){return {resposta_id:id,perfil:'participante',dias:[],nps_evento:9,versao:'2026-10-26-r1'};}

test('comments and application barrier survive real HTTP storage without adding identifiers',async()=>{
  await post({...payload('comments-0001'),comentarios_aulas:{refrativa:'  Bons exemplos.\u0000  ',protocolo:'Mais prática.'},barreira_aplicacao:' Material de apoio ',nome:'DO NOT STORE',whatsapp:'DO NOT STORE'});
  const saved=(await results()).find(r=>r.resposta_id==='comments-0001');
  assert.deepEqual(saved.comentarios_aulas,{refrativa:'Bons exemplos.',protocolo:'Mais prática.'});
  assert.equal(saved.barreira_aplicacao,'Material de apoio');
  assert.deepEqual(saved.dias,[]);
  assert.ok(!('nome' in saved));assert.ok(!('whatsapp' in saved));
});
test('comment whitelist and length reject unknown lecture keys without rejecting valid text',async()=>{
  await post({...payload('comments-0002'),comentarios_aulas:{refrativa:'x'.repeat(2100),nao_existe:'bad',protocolo:100,casos_1:'  '}});
  const saved=(await results()).find(r=>r.resposta_id==='comments-0002');
  assert.deepEqual(saved.comentarios_aulas,{refrativa:'x'.repeat(2000)});
});
test('all 22 long comments fit the request limit and remain isolated from real responses in test mode',async()=>{
  const names=['faixa_preta','branding','fotofobia','eng_conteudo','maquina_trafego','maquina_clientes','plano_execucao','in_the_bag','abertura','intro_mgz','aberrometria','optica','defocus','clinica_premium','milhas','refrativa','biometria','protocolo','casos_1','casos_2','insatisfeito','poder_visao'];
  const comments=Object.fromEntries(names.map(k=>[k,'á'.repeat(2000)]));
  await post({...payload('comments-0003'),teste:true,comentarios_aulas:comments});
  assert.equal((await results()).filter(r=>r.resposta_id==='comments-0003').length,0);
  assert.deepEqual((await results(true)).find(r=>r.resposta_id==='comments-0003').comentarios_aulas,comments);
});
test('non-use of Club items is stored as a distinct state and never as a numeric zero',async()=>{
  await post({...payload('club-0000001'),perfil:'mestre',nao_usa_club:['sistema','sistema','inexistente'],notas_club:{sistema:0,trafego:5}});
  const saved=(await results()).find(r=>r.resposta_id==='club-0000001');
  assert.deepEqual(saved.nao_usa_club,['sistema']);
  assert.deepEqual(saved.notas_club,{trafego:5});
});
test('old data stays byte-for-byte intact and corrections append the same response id',async()=>{
  const original=(await results()).find(r=>r.resposta_id==='legacy-0001');assert.deepEqual(original,legacy);
  await post({...legacy,nps_evento:10});
  const file=await readFile(join(dir,'respostas.jsonl'),'utf8');assert.ok(file.startsWith(legacyLine));
  const rows=(await results()).filter(r=>r.resposta_id==='legacy-0001');assert.equal(rows.length,2);assert.equal(rows[1].nps_evento,10);
});
test('results remain protected and invalid submissions do not create records',async()=>{
  const before=(await results()).length;
  assert.equal((await fetch(base+'/api/pesquisa/resultados')).status,401);
  assert.equal((await fetch(base+'/api/pesquisa/respostas',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,422);
  assert.equal((await results()).length,before);
});
