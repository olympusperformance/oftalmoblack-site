const {test}=require('node:test');
const assert=require('node:assert/strict');
const items=require('../public/assets/club-checklist.js');
const M=require('../public/assets/club-metodo.js');
test('Desmembramento: 90 itens, IDs estáveis e contagem de cada degrau',()=>{
 assert.equal(items.length,90);assert.equal(new Set(items.map(i=>i.id)).size,90);
 assert.deepEqual(['D01','D02','D03','D04','D05','D06','D07','D08','D09','D10','D11','D12','TREINO'].map(step=>items.filter(i=>i.step===step).length),[5,6,7,7,9,12,5,6,6,6,10,4,7]);
 assert.ok(items.every(i=>i.title&&i.owner&&['AUTO','MANUAL'].includes(i.source)));
 assert.ok(items.filter(i=>i.monthly).every(i=>i.step==='D08'));
 assert.equal(items.filter(i=>i.monthly).length,6);
});
test('Rituais: sete itens independentes, três obrigatórios, uma missão de peso 1',()=>{
 const rituals=items.filter(i=>/^D11-0[1-7]$/.test(i.id));
 assert.equal(rituals.filter(i=>!i.optional).length,3);
 assert.equal(rituals.reduce((sum,i)=>sum+(i.missionWeight||0),0),1);
 assert.equal(items.find(i=>i.id==='D02-06').missionWeight,0.5);
});
test('Entregas agrupadas sem confundir módulos e Funil Olympus com Quiz',()=>{
 assert.deepEqual(M.artifactSteps({nome:'Funil VSL'}),['D06']);
 assert.deepEqual(M.artifactSteps({nome:'Funil Olympus'}),['D06','D09']);
 assert.deepEqual(M.artifactSteps({nome:'Agente de comentários'}),['D05']);
 assert.deepEqual(M.artifactSteps({nome:'Íris Black'}),[]);
 assert.deepEqual(M.artifactSteps({nome:'Quiz'}),[]);
 assert.deepEqual(M.artifactSteps({nome:'Site Institucional',method_steps:[]}),[]);
});

// A hierarquia deve ser completa sem recriar IDs ou perder registros existentes.
test('Todos os 90 itens pertencem a exatamente uma entrega do próprio degrau',()=>{
 const steps=[...M.steps.map(s=>s.id),'TREINO'];
 const deliveries=steps.flatMap(step=>M.deliveries(step,[]));
 const assigned=deliveries.flatMap(d=>d.items.map(i=>i.id));
 assert.equal(assigned.length,items.length);
 assert.equal(new Set(assigned).size,items.length);
 assert.deepEqual(assigned.slice().sort(),items.map(i=>i.id).sort());
 assert.ok(steps.every(step=>deliveries.some(d=>d.step===step)));
 for(const d of deliveries){assert.ok(d.items.length);assert.ok(d.items.every(i=>i.step===d.step&&items.includes(i)));}
 assert.deepEqual(M.deliveries('D07',[]).map(d=>d.name),['Prospecção pelo Social Seller','Indicação ativa','Leads Bônus']);
});
test('Entregas existentes são reaproveitadas sem duplicar o cadastro ou perder as etapas',()=>{
 const site={id:'site',nome:'Site Institucional',method_steps:['D05']};
 const training={id:'training',nome:'Treinamento comercial',method_steps:['D04','D09','D10','TREINO']};
 const catalog=[site,training,{id:'extra',nome:'Processo adicional',method_steps:['D05']},
  {id:'old',nome:'Site Institucional antigo',method_steps:['D05'],archived_at:'2026-10-01'},
  {id:'internal',nome:'Site Institucional interno',method_steps:['D05'],tipo:'interna'}];
 const before=JSON.stringify(catalog),deliveries=M.deliveries('D05',catalog);
 assert.strictEqual(deliveries.find(d=>d.id==='D05/site').artifact,site);
 assert.deepEqual(deliveries.find(d=>d.id==='D05/site').items.map(i=>i.id),['D05-05','D05-06']);
 assert.deepEqual(deliveries.filter(d=>d.artifact).map(d=>d.artifact.id),['site','extra']);
 for(const step of training.method_steps)assert.strictEqual(M.deliveries(step,catalog).find(d=>d.artifact).artifact,training);
 assert.equal(JSON.stringify(catalog),before);
});
