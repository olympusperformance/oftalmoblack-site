import {test} from 'node:test';import assert from 'node:assert/strict';
import {CATALOG} from '../supabase/functions/_shared/member-profile-model.mjs';
const store=await import('../supabase/functions/_shared/member-profile-store.mjs').catch(()=>({}));
const id='00000000-0000-4000-8000-000000000001';
test('paginação lê além de1000fontes e suporta limite menor imposto pelo servidor',async()=>{
 assert.equal(typeof store.loadMemberProfile,'function');const sources=Array.from({length:1005},(_,i)=>({id:'source-'+i,member_id:id,source_type:i===1004?'pre_diagnostico':'pesquisa',version:'pre-diagnostico-v1',source_at:'2026-10-27T00:00:00Z',recorded_at:'2026-10-27T00:00:00Z',data:i===1004?{sdr:'acumula'}:{}}));const ranges=[];
 const db={from(table){let start=0,end=0,filter;const q={select(){return q;},eq(k,v){filter=[k,v];return q;},order(){return q;},range(a,b){start=a;end=Math.min(b,a+99);ranges.push([table,a,end]);return q;},maybeSingle(){return Promise.resolve({data:table==='members'?{id,nome:'Pessoa',ativo:true}: {schema_version:'2.0',definition:CATALOG}});},then(resolve){assert.equal(filter[1],id);return Promise.resolve({data:table==='member_context_entries'?sources.slice(start,end+1):[]}).then(resolve);}};return q;},rpc:()=>({then:resolve=>Promise.resolve({data:{instagram_contas:0,instagram_metricas:0}}).then(resolve)})};
 const profile=await store.loadMemberProfile(db,id);assert.equal(profile.campos['equipe.papel_sdr'].valor,'acumula');assert.equal(profile.fontes.filter(s=>s.id.startsWith('source-')).length,1005);assert.ok(ranges.filter(r=>r[0]==='member_context_entries').length>10);
});
