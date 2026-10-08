const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../public/assets/club-metodo.js');
test('12 degraus: novos pilares, movimentos e vínculos sem pontuar módulos como degrau',()=>{
  assert.equal(M.steps.length,12);assert.equal(M.steps[3].name,'Time Premium');assert.equal(M.steps[8].name,'Chamada Consultiva');assert.equal(M.steps[9].name,'Método In The Bag');
  assert.deepEqual(M.artifactSteps({nome:'Tracker Black',method_steps:['D03','D06']}),['D03','D06']);assert.deepEqual(M.artifactSteps({nome:'Fábrica de Conteúdo'}),[]);
  assert.deepEqual(M.artifactSteps({nome:'Nome personalizado',method_steps:['D04']}),['D04']);
  assert.deepEqual(M.artifactSteps({nome:'Tracker Black',method_steps:[]}),[]);
});
test('régua completa = 60; créditos parciais e o vídeo duplo do encontro contam corretamente',()=>{
  const q={attended:10,eligible:10,video_credits:13,weeks:13,followers_growth:5000,orphan_leads:0,sla_recorded:true,outcomes_percent:95,cpv_percent:14.99};
  const ed=[{publicized:true,video_group:true,video_ads:true,attended:true}];
  assert.equal(M.score(q,[{weight:1,status:'verified'}],[],ed).total,60);
  assert.ok(Math.abs(M.score(q,[],[],[{...ed[0],video_ads:false}]).parts.encontro-20/3)<1e-10);
  assert.equal(M.score({...q,video_credits:6.5},[],[],ed).parts.videos,5);
});
test('missões pesadas: entrega Club e evidência não conferida nunca pontuam',()=>{
  assert.equal(M.score({},[{weight:1,status:'verified'},{weight:.5,status:'submitted'},{weight:0,status:'verified'}]).missions,10);
  assert.equal(M.score({},[]).missions,0);
  assert.equal(M.score({},[{weight:0,status:'verified'}]).missions,0);
});
test('limiares dos juízes: CPV estritamente abaixo de 15; chamada pelo menos 60',()=>{
  assert.equal(M.score({cpv_percent:15,call_conversion:59.99}).result,0);
  assert.equal(M.score({cpv_percent:15,call_conversion:60}).result,5);
  assert.equal(M.score({cpv_percent:14.99,call_conversion:60}).result,5);
  assert.equal(M.score({}).result,null);
  assert.equal(M.score({}).complete,false);
});
test('v2.2: seguidores por faixas e vídeos somente com duas semanas apuradas',()=>{
  for(const [growth,points] of [[null,null],[-100,0],[1000,0],[2499,0],[2500,2.5],[4999,2.5],[5000,5],[12000,5]])assert.equal(M.score({followers_growth:growth}).parts.followers,points);
  assert.equal(M.score({video_credits:1,weeks:1}).parts.videos,null);
  assert.equal(M.score({video_credits:1.99,weeks:1.99}).parts.videos,null);
  assert.equal(M.score({video_credits:2,weeks:2}).parts.videos,10);
  assert.equal(M.score({video_credits:1,weeks:2}).parts.videos,5);
  assert.equal(M.score({period:'2026-T3',followers_growth:3000,video_credits:1,weeks:1}).parts.followers,3);
  assert.equal(M.score({period:'2026-T3',video_credits:1,weeks:1}).parts.videos,10);
});
test('indicações sem teto, bônus 10 e ativação uma vez por módulo',()=>{
  const extras=[...Array.from({length:5},(_,i)=>({kind:'referral',reference:String(i)})),{kind:'bonus'},{kind:'bonus'},{kind:'module',reference:'iris'},{kind:'module',reference:'iris'},{kind:'module',reference:'fabrica'}];
  assert.equal(M.score({},[],extras).extra,145);assert.equal(M.score({},[],extras).vouchers,5);
});
test('pendências só dos pedidos, por prazo; concluídas e canceladas saem',()=>{
  const ms=[{id:'a',title:'A',due_on:'2026-09-20',status:'requested'},{id:'b',title:'B',due_on:'2026-09-01',status:'verified'},{id:'c',title:'C',due_on:'2026-09-10',status:'submitted'},{id:'d',title:'D',status:'cancelled'}];
  const p=M.pending(ms,[{id:'art'}],[{id:'step',artifact_id:'art',tipo:'trava'}],[],'2026-09-30');
  assert.deepEqual(p.map(x=>x.id),['c','a']);assert.equal(p[0].late,20);assert.equal(p.length,2);
});
test('trimestres e deep-links usam D01–D12 sem renumerar links do protótipo de 12',()=>{
  assert.deepEqual(M.bounds('2026-T4'),{start:'2026-10-01',end:'2026-12-31'});
  assert.equal(M.canonical('#subida/p09'),'subida/D09');assert.throws(()=>M.bounds('2026-T5'));
});
test('referência PGZ respeita fronteiras e conserva lacunas sem inventar corte',()=>{
  assert.equal(M.referenceSignal('endotelio',2000),'ok');assert.equal(M.referenceSignal('endotelio',1500),'warn');
  assert.equal(M.referenceSignal('hoa',.5),'crit');assert.equal(M.referenceSignal('coma',.3),'crit');
  assert.equal(M.referenceSignal('ae',.55),'off');assert.equal(M.referenceSignal('ae',.6),'off');assert.equal(M.referenceSignal('ae',.61),'crit');
  assert.equal(M.referenceSignal('pupila',7),'off');assert.equal(M.referenceSignal('hoa',''),'off');
});
