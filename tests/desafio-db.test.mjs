// npm install --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.5.12
// Postgres em memória com cadastros fictícios; nenhum projeto remoto envolvido.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
const db=await PGlite.create();after(()=>db.close());
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const UA='20000000-0000-4000-8000-000000000001',UB='20000000-0000-4000-8000-000000000002',UE='20000000-0000-4000-8000-000000000009';
await db.exec(`create role anon;create role authenticated;
create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create table public.members(id uuid primary key,nome text,ativo boolean,user_id uuid);
create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'false')='true' $$;
create schema cerebro_private;
create function cerebro_private.stamp() returns trigger language plpgsql set search_path='' as $$ begin new.updated_by=auth.uid();new.updated_at=now();if new.updated_by is null then raise exception 'Login necessário';end if;return new;end $$;
create table public.cb_audit_log(member_id uuid,entity text,actor uuid,previous jsonb,current jsonb);
create function cerebro_private.audit() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.cb_audit_log values((to_jsonb(new)->>'member_id')::uuid,tg_table_name,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));return new;end $$;
grant usage on schema public,auth,cerebro_private to anon,authenticated;grant select on public.members to authenticated;
insert into auth.users values('${UA}'),('${UB}'),('${UE}');
insert into public.members values('${A}','Pessoa A',true,'${UA}'),('${B}','Pessoa B',true,'${UB}');`);
await db.exec(await readFile(new URL('../supabase/migrations/20261030190000_desafio_black.sql',import.meta.url),'utf8'));
async function como(role,uid,admin,fn){return db.transaction(async tx=>{await tx.exec(`set local role ${role};select set_config('test.uid','${uid||''}',true),set_config('test.admin','${admin}',true);`);return fn(tx);});}
const equipe=fn=>como('authenticated',UE,true,fn);

test('SQL: equipe cadastra o desafio e as metas; feito é o maior entre IG e grupo',async()=>{
 await equipe(tx=>tx.query(`insert into public.cb_desafios(id,titulo,inicio,fim,regra) values('desafio-teste','Desafio Teste','2026-10-30T01:00:00Z','2026-11-05T23:00:00Z','Só Reels contam.')`));
 await equipe(tx=>tx.query(`insert into public.cb_desafio_metas(desafio_id,member_id,meta,reels_ig,videos_grupo) values('desafio-teste',$1,7,2,1),('desafio-teste',$2,3,0,1)`,[A,B]));
 const r=await equipe(tx=>tx.query('select member_id,feitos,updated_by from public.cb_desafio_metas order by member_id'));
 assert.deepEqual(r.rows.map(x=>x.feitos),[2,1]);assert.equal(r.rows[0].updated_by,UE);
 assert.equal((await db.query("select count(*)::int n from public.cb_audit_log where entity='cb_desafio_metas'")).rows[0].n,2);
});
test('SQL: membro lê só a própria meta, nunca a de outro',async()=>{
 const r=await como('authenticated',UA,false,tx=>tx.query('select member_id,meta from public.cb_desafio_metas'));
 assert.deepEqual(r.rows,[{member_id:A,meta:7}]);
 assert.equal((await como('authenticated',UA,false,tx=>tx.query('select * from public.cb_desafio_metas where member_id=$1',[B]))).rows.length,0);
});
test('SQL: membro não grava nem altera o próprio progresso',async()=>{
 await assert.rejects(como('authenticated',UA,false,tx=>tx.query(`insert into public.cb_desafio_metas(desafio_id,member_id,meta) values('desafio-teste',$1,1)`,[B])),/row-level security/);
 const u=await como('authenticated',UA,false,tx=>tx.query('update public.cb_desafio_metas set reels_ig=99 where member_id=$1',[A]));
 assert.equal(u.affectedRows,0);
 await assert.rejects(como('authenticated',UA,false,tx=>tx.query(`update public.cb_desafios set titulo='x'`)).then(r=>{if(!r.affectedRows)throw new Error('row-level security');}),/row-level security/);
});
test('SQL: anônimo não lê nada e ninguém apaga',async()=>{
 await assert.rejects(como('anon',null,false,tx=>tx.query('select * from public.cb_desafio_metas')),/permission denied/);
 await assert.rejects(equipe(tx=>tx.query('delete from public.cb_desafio_metas')),/permission denied/);
});
test('SQL: feito é calculado pelo banco e não aceita valor de fora',async()=>{
 await assert.rejects(equipe(tx=>tx.query(`update public.cb_desafio_metas set feitos=50 where member_id=$1`,[A])));
 await assert.rejects(equipe(tx=>tx.query(`update public.cb_desafio_metas set reels=$2::jsonb where member_id=$1`,[A,'{"x":1}'])));
});
test('SQL: lançamento manual da equipe atualiza o contado; o membro não lança o próprio',async()=>{
 const r=await equipe(tx=>tx.query('update public.cb_desafio_metas set videos_grupo=3 where member_id=$1 returning feitos,updated_by',[B]));
 assert.deepEqual(r.rows,[{feitos:3,updated_by:UE}]);
 const m=await como('authenticated',UB,false,tx=>tx.query('update public.cb_desafio_metas set videos_grupo=9 where member_id=$1',[B]));
 assert.equal(m.affectedRows,0);
});
