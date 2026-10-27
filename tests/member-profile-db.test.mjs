import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
const db=await PGlite.create();after(()=>db.close());
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key);
create table public.members(id uuid primary key,nome text,email text,ativo boolean,user_id uuid,turma text,fase text,instagram text,whatsapp_url text,criado_em timestamptz default now());
create table public.member_context_entries(id uuid primary key,member_id uuid references public.members(id),source_type text,source_at timestamptz);
create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'false')='true' $$;
create schema cerebro;create table cerebro.grupos(jid text,member_id uuid,ativo boolean);create table cerebro.mensagens(id text,jid text,member_id uuid);create table cerebro.instagram_contas(ig_user_id text,member_id uuid,ativo boolean);create table cerebro.instagram_metricas(ig_user_id text,dia date);
grant usage on schema public to anon,authenticated,service_role;grant select on public.members,public.member_context_entries to service_role;`);
await db.exec(await readFile(new URL('../supabase/migrations/20261027052219_member_profile_standard.sql',import.meta.url),'utf8'));
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',S='10000000-0000-4000-8000-000000000001';
await db.query('insert into public.members(id,nome,email,ativo) values($1,$2,$3,true),($4,$5,$6,true)',[A,'Pessoa A','a@example.invalid',B,'Pessoa B','b@example.invalid']);
await db.query("insert into public.member_context_entries values($1,$2,'cadastro',now())",[S,A]);
const value={valor:'eu',situacao:'informado',natureza:'declarado',fontes_refs:[S],data_referencia:{inicio:null,fim:null,precisao:'desconhecida',natureza:null},justificativa:null,updated_at:null,updated_by:null,alternativas:[],historicos:[]};
const patch={'equipe.papel_sdr':value};
async function role(name,admin,fn){return db.transaction(async tx=>{await tx.exec(`set local role ${name};select set_config('test.admin','${admin}',true);`);return fn(tx);});}
const apply=(tx,member=A,key='fixture-1',revision=0,fields=patch)=>tx.query("select public.member_profile_apply($1,'2.0',$2,$3::jsonb,$4,'registrar',$5::jsonb,'Fonte de teste') as result",[member,revision,JSON.stringify(fields),key,JSON.stringify({tipo:'agente',id:'fixture'})]).then(r=>r.rows[0].result);
test('SQL: catálogo comum existe; leitura não cria perfil vazio em massa',async()=>{
 const r=await db.query('select definition from public.member_profile_catalog where schema_version=$1',['2.0']);assert.equal(r.rows[0].definition.sections.length,14);assert.equal((await db.query('select count(*) n from public.member_profile_patches')).rows[0].n,0);
});
test('SQL: anônimo e mentorado não leem ou escrevem dados internos',async()=>{
 await assert.rejects(role('anon',false,tx=>tx.query('select * from public.member_profile_patches')),/permission denied/);
 assert.equal((await role('authenticated',false,tx=>tx.query('select * from public.member_profile_catalog'))).rows.length,0);
 await assert.rejects(role('authenticated',true,tx=>apply(tx)),/permission denied/);
 assert.equal((await role('authenticated',true,tx=>tx.query('select * from public.member_profile_catalog'))).rows.length,1);
});
test('SQL: patch é durável, append-only e repetição não duplica',async()=>{
 assert.equal((await role('service_role',false,tx=>apply(tx))).status,'created');
 assert.equal((await role('service_role',false,tx=>apply(tx))).status,'duplicate');
 assert.equal((await role('service_role',false,tx=>apply(tx,A,'fixture-1',0,{'equipe.papel_sdr':{...value,valor:'acumula'}}))).status,'conflict');
 for(const sql of ['update public.member_profile_patches set reason=reason','delete from public.member_profile_patches','truncate public.member_profile_patches'])await assert.rejects(role('service_role',false,tx=>tx.exec(sql)),/permission denied/);
});
test('SQL: revision desatualizada não sobrescreve mudança e ID do membro delimita fontes',async()=>{
 assert.equal((await role('service_role',false,tx=>apply(tx,A,'fixture-stale',0))).status,'revision_conflict');
 await assert.rejects(role('service_role',false,tx=>apply(tx,B,'fixture-cross',0)),/fonte/i);
});
test('SQL: campo extra, categoria inválida e campo canônico são rejeitados',async()=>{
 for(const fields of [{'equipe.exclusivo':value},{'equipe.papel_sdr':{...value,valor:'inventado'}},{'identidade.nome_completo':{...value,valor:'Outro'}}])await assert.rejects(role('service_role',false,tx=>apply(tx,A,crypto.randomUUID(),1,fields)));
});
test('SQL: listagem parte de members, inclusive sem grupo ou mensagem',async()=>{
 const r=await role('service_role',false,tx=>tx.query('select * from public.member_profile_directory(false)'));assert.equal(r.rows.length,2);assert.ok(r.rows.some(m=>m.id===A));
});
test('SQL: função privada fornece contagens exatas sem conceder leitura de mensagens',async()=>{
 const r=await role('service_role',false,tx=>tx.query('select public.member_profile_connections($1) result',[A]));assert.equal(r.rows[0].result.instagram_contas,0);
 await assert.rejects(role('service_role',false,tx=>tx.query('select * from cerebro.mensagens')),/permission denied/);
 await assert.rejects(role('authenticated',true,tx=>tx.query('select public.member_profile_connections($1)',[A])),/permission denied/);
});
test('SQL: metadados fora do contrato e datas impossíveis não envenenam o perfil',async()=>{
 for(const data_referencia of [{campo_exclusivo:'x'},{inicio:'2026-02-31',fim:null,precisao:'dia',natureza:'fato'}])await assert.rejects(role('service_role',false,tx=>apply(tx,A,crypto.randomUUID(),1,{'equipe.papel_sdr':{...value,data_referencia}})));
});
test('SQL: autoria precisa de tipo e identificação válidos',async()=>{
 await assert.rejects(role('service_role',false,tx=>tx.query("select public.member_profile_apply($1,'2.0',1,$2::jsonb,'actor-bad','registrar','{\"id\":\"fixture\"}','Motivo')",[A,JSON.stringify(patch)])));
});
