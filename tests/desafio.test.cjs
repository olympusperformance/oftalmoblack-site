const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const D=require('../public/assets/club-desafio.js');

const desafio=(id,inicio,fim)=>({id,titulo:id,inicio,fim,regra:'Só Reels contam.'});
const linha=(meta,feitos,d)=>({meta,feitos,cb_desafios:d});

test('Progresso usa o que a equipe apurou, sem passar de 100%',()=>{
 assert.deepEqual(D.progresso(linha(7,2)),{meta:7,feitos:2,pct:2/7,faltam:5,completo:false});
 const passou=D.progresso(linha(3,5));
 assert.equal(passou.pct,1);assert.equal(passou.faltam,0);assert.ok(passou.completo);
 assert.equal(D.progresso(linha(5,null)).feitos,0);
});
test('Desafio da vez é o de início mais recente',()=>{
 const antigo=desafio('a','2026-10-01T00:00:00Z','2026-10-08T00:00:00Z');
 const novo=desafio('b','2026-10-30T01:00:00Z','2026-11-05T23:00:00Z');
 assert.equal(D.atual([linha(3,1,antigo),linha(7,2,novo)]).cb_desafios.id,'b');
 assert.equal(D.atual([]),null);
 assert.equal(D.atual([{meta:3,feitos:0,cb_desafios:null}]),null);
});
test('Encerra na hora marcada',()=>{
 const d=desafio('b','2026-10-30T01:00:00Z','2026-11-05T23:00:00Z');
 assert.equal(D.encerrado(d,Date.parse('2026-11-05T22:59:59Z')),false);
 assert.equal(D.encerrado(d,Date.parse('2026-11-05T23:00:00Z')),true);
});
test('Privacidade: membro lê só a própria linha e só a equipe grava',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261030190000_desafio_black.sql'),'utf8');
 assert.match(sql,/create policy own_read on public\.cb_desafio_metas for select to authenticated using\s*\(\(select public\.is_admin\(\)\) or member_id in \(select id from public\.members where user_id=\(select auth\.uid\(\)\) and ativo\)\)/);
 assert.match(sql,/create policy admin_insert on public\.cb_desafio_metas for insert to authenticated with check \(\(select public\.is_admin\(\)\)\)/);
 assert.match(sql,/create policy admin_update on public\.cb_desafio_metas for update to authenticated using \(\(select public\.is_admin\(\)\)\)/);
 assert.match(sql,/greatest\(reels_ig,videos_grupo\)/);
 assert.doesNotMatch(sql,/grant [^;]*delete/i);
});
test('A tela do membro filtra pelo próprio cadastro e não lista outros membros',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../public/assets/club-desafio.js'),'utf8');
 assert.match(js,/\.eq\('member_id',st\.member\.id\)/);
 assert.doesNotMatch(js,/members\(/);
});
test('Lançamento manual de vídeos no grupo aceita só inteiro de 0 a 60',()=>{
 assert.equal(D.lancamento('3'),3);assert.equal(D.lancamento(' 0 '),0);assert.equal(D.lancamento(60),60);
 for(const v of ['','-1','2.5','61','abc',null,'1e1'])assert.equal(D.lancamento(v),null,String(v));
});
test('Só o /admin/ abre o lançamento manual; a área do membro não',()=>{
 const membros=fs.readFileSync(path.join(__dirname,'../public/assets/membros.js'),'utf8');
 const admin=fs.readFileSync(path.join(__dirname,'../public/assets/admin.js'),'utf8');
 assert.doesNotMatch(membros,/enterAdmin/);
 assert.match(admin,/Club\.desafio\.enterAdmin\(\$\('desafioAdmin'\), st\.members\)/);
});
