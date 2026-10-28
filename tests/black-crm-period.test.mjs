import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/assets/club-black.js',import.meta.url),'utf8');

test('módulos enviam o trimestre ao servidor sem montar um fim futuro no navegador',async()=>{
  const calls=[], state={request:0,member:{id:'member'},period:'2026-T4',rankingPeriod:'2026-T4',options:{}};
  const query={};for(const method of ['select','eq','gte','lte','order'])query[method]=()=>query;
  query.then=(yes,no)=>Promise.resolve({data:[]}).then(yes,no);
  const context={state,M:{bounds:()=>({start:'2026-10-01',end:'2026-12-31'})},
    C:{sb:{rpc:()=>Promise.resolve({data:[]}),from:()=>query,functions:{invoke:async(name,{body})=>{calls.push({name,body});return {data:null};}}},
      vitrine:{choosePeriod:()=>null}},admin:()=>false,list:async()=>[],render(){},rows:key=>state.data[key]||[],
    ok:r=>r.data,drawerId:null,Promise};
  vm.runInNewContext(source.slice(source.indexOf('  async function load(){'),source.indexOf('  function open(title,body,')),context);
  await context.load();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{name:'farol-metricas',body:{member_id:'member',preset:'quarter',quarter:'2026-T4'}}]);
});

test('restabelecer o CRM não transforma etapas independentes em comparecimento ou fechamentos mistos em cirurgias',()=>{
  const state={period:'2026-T4',ig:[],crm:{updated_at:'2026-10-28',funnel:{data:{periodo:{novos:100,agendadas:20,realizadas:14,cirurgias:6}}}}};
  let steps=[];
  const context={state,rows:key=>key==='steps'?steps:[],sourceLabel:()=>''};
  vm.runInNewContext(source.slice(source.indexOf('  function metric(step,key){'),source.indexOf('  function signal(step){')),context);
  assert.equal(context.metric('D03','novos').value,100);
  assert.equal(context.metric('D03','comparecimento').value,null);
  assert.equal(context.metric('D10','cirurgias').value,null);
  steps=[{method_step:'D03',metrics:{comparecimento:75},updated_at:'2026-10-10'},
    {method_step:'D10',metrics:{cirurgias:3},updated_at:'2026-10-10'}];
  assert.equal(context.metric('D03','comparecimento').value,75);
  assert.equal(context.metric('D03','comparecimento').source,'MANUAL');
  assert.equal(context.metric('D10','cirurgias').value,3);
});
