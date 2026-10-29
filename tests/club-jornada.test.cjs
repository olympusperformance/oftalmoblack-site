const {test}=require('node:test');
const assert=require('node:assert/strict');
const J=require('../public/assets/club-jornada.js');

const catalogo=[
 {id:'D03/sistema',cycle:'unica'},
 {id:'TREINO/sistema',cycle:'unica',sharedWith:'D03/sistema'},
 {id:'D06/gestao',cycle:'mensal'},
 {id:'D08/divulgacao',cycle:'edicao'}
];
const steps=[
 {id:'s1',delivery_id:'D03/sistema',position:1,owner:'mentorado',title:'Dados enviados'},
 {id:'s2',delivery_id:'D03/sistema',position:2,owner:'equipe',title:'Configurado'},
 {id:'s3',delivery_id:'D03/sistema',position:3,owner:'mentorado',title:'WhatsApp conectado'},
 {id:'g1',delivery_id:'D06/gestao',position:1,owner:'mentorado',title:'Verba confirmada'},
 {id:'e1',delivery_id:'D08/divulgacao',position:1,owner:'mentorado',title:'Divulgação enviada'}
];
const row=(step,status,extra)=>({member_id:'m',step_id:step,edition:'',status,...extra});

test('Referência compartilhada usa os marcos do módulo dono, sem segunda lista',()=>{
 assert.deepEqual(J.marcos(catalogo[1],catalogo,steps).map(s=>s.id),['s1','s2','s3']);
 assert.equal(J.origem(catalogo[1],catalogo).id,'D03/sistema');
});
test('Andamento: não se aplica sai da conta e a vez segue o primeiro marco aberto',()=>{
 const lista=J.marcos(catalogo[0],catalogo,steps);
 let p=J.andamento(lista,[row('s1','concluida')],'m','');
 assert.deepEqual([p.concluidos,p.total,p.vez,p.proximo.id],[1,3,'equipe','s2']);
 p=J.andamento(lista,[row('s1','concluida'),row('s2','concluida'),row('s3','nao_aplica')],'m','');
 assert.ok(p.completo);assert.equal(p.total,2);
 p=J.andamento(lista,[row('s1','em_validacao')],'m','');
 assert.deepEqual([p.vez,p.validacao],['equipe',1]);
 p=J.andamento(lista,[row('s1','concluida'),row('s2','concluida'),row('s3','aguardando')],'m','');
 assert.deepEqual([p.vez,p.aguardando],['mentorado',1]);
});
test('Ciclo: única, mês corrente ou escolhido, e edição mais recente do encontro',()=>{
 assert.equal(J.ciclo(catalogo[0]),'');
 assert.equal(J.ciclo(catalogo[2],null,[],'2026-10-29'),'2026-10');
 assert.equal(J.ciclo(catalogo[2],'2026-09',[],'2026-10-29'),'2026-09');
 assert.equal(J.ciclo(catalogo[3],null,[{edition:'2026-09-10'},{edition:'2026-10-08'}]),'2026-10-08');
 assert.equal(J.ciclo(catalogo[3],null,[]),null);
 const vazio=J.andamento(J.marcos(catalogo[3],catalogo,steps),[],'m',null);
 assert.equal(vazio.total,0);
});
test('Marco derivado de outro registro conta como concluído, mas não sobrepõe conclusão explícita',()=>{
 const lista=J.marcos(catalogo[3],catalogo,steps);
 const derivar=(s,ed)=>s.id==='e1'&&ed==='2026-10-08'?{status:'concluida',derived:true}:null;
 assert.ok(J.andamento(lista,[],'m','2026-10-08',derivar).completo);
 assert.equal(J.estado([{...row('e1','nao_aplica'),edition:'2026-10-08'}],'m','e1','2026-10-08',derivar,lista[0]).status,'nao_aplica');
});
test('Pendências: mentorado vê só o que foi pedido; equipe vê validações e pedidos abertos',()=>{
 const progresso=[row('s1','aguardando',{due_on:'2026-11-05'}),row('s3','em_validacao')];
 const mentorado=J.pendencias(catalogo,catalogo,steps,progresso,'m',false,()=>'');
 assert.deepEqual(mentorado.map(x=>x.step.id),['s1']);
 const equipe=J.pendencias(catalogo,catalogo,steps,progresso,'m',true,()=>'');
 assert.deepEqual(equipe.map(x=>[x.step.id,x.vez]),[['s1','mentorado'],['s3','equipe']]);
});
test('Ações: mentorado só envia marco dele; equipe conclui, pede, valida e reabre',()=>{
 const [s1,s2]=steps;
 assert.deepEqual(J.acoes(s1,{status:'pendente'},false),['enviar']);
 assert.deepEqual(J.acoes(s2,{status:'pendente'},false),[]);
 assert.deepEqual(J.acoes(s1,{status:'em_validacao'},false),[]);
 assert.deepEqual(J.acoes(s1,{status:'pendente'},true),['concluir','pedir','nao_aplica']);
 assert.deepEqual(J.acoes(s1,{status:'aguardando'},true),['concluir','lembrar','nao_aplica']);
 assert.deepEqual(J.acoes(s1,{status:'em_validacao'},true),['concluir','ajuste']);
 assert.deepEqual(J.acoes(s2,{status:'concluida'},true),['reabrir']);
});
