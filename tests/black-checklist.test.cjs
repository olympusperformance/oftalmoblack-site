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
