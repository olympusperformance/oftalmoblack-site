// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite entrypoint.
// This database exists only in memory and contains fictitious identities.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOG_SQL } from '../scripts/fathom/patch-workflow.mjs';
import { resolveParticipants, routeRecord } from '../scripts/fathom/identities.mjs';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');

test('private alias storage reaches the actual extraction/review catalog and preserves access boundaries', async () => {
 const db = new PGlite();
 try {
  await db.exec(`
   create role anon; create role authenticated;
   create schema auth; create schema memoria_operacional;
   create table auth.users(id uuid primary key,email text);
   create table public.staff(id uuid primary key,nome text,ativo boolean,user_id uuid);
   create table public.members(id uuid primary key,nome text,ativo boolean,email text);
   create table memoria_operacional.mentorados(id uuid primary key);
   create table memoria_operacional.mentorado_aliases(mentorado_id uuid references memoria_operacional.mentorados(id),alias text,primary key(mentorado_id,alias));
   insert into public.staff values('00000000-0000-0000-0000-000000000001','Ana Silva',true,null);
   insert into public.members values('00000000-0000-0000-0000-000000000002','Carlos Alberto Souza',true,null);
   insert into memoria_operacional.mentorados values('00000000-0000-0000-0000-000000000002');
  `);
  const migration=readFileSync(new URL('../supabase/migrations/20261016180904_fathom_staff_aliases.sql',import.meta.url),'utf8');
  await db.exec(migration);
  const payload={title:'Suporte — Carlos Souza',transcript:[{speaker:{display_name:'Bruno Lima'},text:'A Ana vai enviar o planejamento.'}]};
  const record={kind:'demand',evidence:[{segment_id:'0',quote:payload.transcript[0].text,speaker:{name:'Bruno Lima'}}],ownership:{executor_name:'Ana',basis:'named',segment_id:'0',state:'requested',beneficiary_name:null,identity_uncertain:false}};
  let catalog=(await db.query(CATALOG_SQL)).rows[0].catalog;
  assert.deepEqual(catalog.staff[0].aliases,[]);
  assert.equal(resolveParticipants(payload,catalog).member_id,null);
  assert.equal(routeRecord(record,resolveParticipants(payload,catalog),catalog).routing.eligible_for_demand,false);
  await db.exec(`
   insert into memoria_operacional.staff_aliases(staff_id,alias,confirmed_by)
    values('00000000-0000-0000-0000-000000000001','Ana','fixture operator');
   insert into memoria_operacional.mentorado_aliases values('00000000-0000-0000-0000-000000000002','Carlos Souza');
  `);
  catalog=(await db.query(CATALOG_SQL)).rows[0].catalog;
  const identity=resolveParticipants(payload,catalog);
  assert.equal(identity.member_id,'00000000-0000-0000-0000-000000000002');
  assert.deepEqual(routeRecord(record,identity,catalog).routing.responsaveis,['00000000-0000-0000-0000-000000000001']);
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='memoria_operacional.staff_aliases'::regclass")).rows[0].relrowsecurity,true);
  for(const role of ['anon','authenticated']) {
   for(const privilege of ['select','insert','update','delete']) {
    assert.equal((await db.query('select has_table_privilege($1, $2, $3) as allowed',[role,'memoria_operacional.staff_aliases',privilege])).rows[0].allowed,false);
   }
  }
  await assert.rejects(db.exec("insert into memoria_operacional.staff_aliases(staff_id,alias,confirmed_by) values('00000000-0000-0000-0000-000000000099','Missing','fixture operator')"),/foreign key/i);
  await assert.rejects(db.exec("insert into memoria_operacional.staff_aliases(staff_id,alias,confirmed_by) values('00000000-0000-0000-0000-000000000001',' Ana ','fixture operator')"),/check constraint/i);
  await assert.rejects(db.exec("insert into memoria_operacional.staff_aliases(staff_id,alias,confirmed_by) values('00000000-0000-0000-0000-000000000001','Another','')"),/check constraint/i);
  await db.exec("update public.staff set ativo=false");
  catalog=(await db.query(CATALOG_SQL)).rows[0].catalog;
  assert.deepEqual(catalog.staff,[]);
  assert.equal(routeRecord(record,resolveParticipants(payload,catalog),catalog).routing.eligible_for_demand,false);
 } finally { await db.close(); }
});
