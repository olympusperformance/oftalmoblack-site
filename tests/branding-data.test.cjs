const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function data(rows,failAt=-1){
 const calls=[];
 const Club={sb:{from(table){
  const call={table,filters:[],orders:[],range:null};calls.push(call);
  const q={select(){return q;},eq(k,v){call.filters.push([k,v]);return q;},order(k){call.orders.push(k);return q;},range(a,b){call.range=[a,b];return q;},then(ok,bad){
   return Promise.resolve(calls.length===failAt?{error:new Error('indisponível')}:{data:call.range?rows.slice(call.range[0],call.range[1]+1):rows}).then(ok,bad);
  }};
  return q;
 }}};
 vm.runInNewContext(fs.readFileSync('public/assets/club-data.js','utf8'),{window:{Club},console});
 return {api:Club.data.instagram,calls};
}
test('Branding pagina todo o histórico e mantém o filtro do mentorado em cada página',async()=>{
 const rows=Array.from({length:1123},(_,i)=>({campaign_id:String(i)}));
 const {api,calls}=data(rows);const result=await api.impulsionamentos('member-own');
 assert.equal(result.length,1123);assert.equal(result[1122].campaign_id,'1122');
 assert.deepEqual(calls.map(c=>c.range),[[0,499],[500,999],[1000,1499]]);
 for(const c of calls){assert.deepEqual(c.filters,[['member_id','member-own']]);assert.deepEqual(c.orders,['inicio','campaign_id']);}
});
test('Branding não retorna histórico parcial quando uma página falha',async()=>{
 const {api}=data(Array.from({length:600},()=>({})),2);
 await assert.rejects(api.impulsionamentos('member-own'),/indisponível/);
});
test('Branding filtra a conta do mentorado e propaga erro em vez de informar ausência',async()=>{
 const {api,calls}=data([],1);
 await assert.rejects(api.impulsionamentoContas('member-own'),/indisponível/);
 assert.deepEqual(calls[0].filters,[['member_id','member-own']]);
});
test('Branding sem mentorado não consulta campanhas de todos',async()=>{
 const {api,calls}=data([]);assert.equal((await api.impulsionamentos(null)).length,0);assert.equal(calls.length,0);
});
