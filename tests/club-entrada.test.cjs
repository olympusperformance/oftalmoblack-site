const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../public/assets/club-entrada.js');

const passos=[
  {id:'fechamento',position:1,fase:'fechamento'},
  {id:'dados',position:2,fase:'fechamento'},
  {id:'pagamento',position:3,fase:'administrativo'},
  {id:'grupo',position:4,fase:'integracao'},
  {id:'convite',position:5,fase:'integracao'},
  {id:'onboarding',position:6,fase:'encontros'},
  {id:'encerramento',position:7,fase:'pos'}
];
const marcar=(m,ids)=>ids.map(id=>({member_id:m,passo_id:id}));

test('recém-cadastrado: administrativo e integração abrem juntos, encontros esperam',()=>{
  const a=E.andamento(passos,marcar('m1',['fechamento','dados']),'m1');
  assert.equal(a.concluidos,2);
  assert.equal(a.fase,'integracao');
  assert.deepEqual(a.proximos.map(p=>p.id),['pagamento','grupo','convite']);
});

test('administrativo pendente não segura os encontros',()=>{
  const a=E.andamento(passos,marcar('m1',['fechamento','dados','grupo','convite']),'m1');
  assert.deepEqual(a.proximos.map(p=>p.id),['pagamento','onboarding']);
  assert.equal(a.fase,'encontros');
});

test('só o administrativo restando vira a fase atual',()=>{
  const a=E.andamento(passos,marcar('m1',['fechamento','dados','grupo','convite','onboarding','encerramento']),'m1');
  assert.equal(a.fase,'administrativo');
  assert.equal(a.completo,false);
});

test('tudo marcado é entrada concluída e não mistura mentorados',()=>{
  const todos=marcar('m1',passos.map(p=>p.id)).concat(marcar('m2',['fechamento']));
  assert.equal(E.andamento(passos,todos,'m1').completo,true);
  assert.equal(E.andamento(passos,todos,'m1').fase,null);
  assert.equal(E.andamento(passos,todos,'m2').concluidos,1);
});

test('convite usa o tratamento e leva o link de agendamento',()=>{
  const t=E.mensagem('convite',{nome:'Dra. Leandra Selestrino Veroneis'});
  assert.match(t,/^Olá, Dra\. Leandra!/);
  assert.match(t,/segunda-feira às 20h/);
  assert.ok(t.includes(E.AGENDAMENTO));
  assert.ok(E.mensagem('grupo',{nome:'Dr. Rodrigo'}).includes(E.AGENDAMENTO));
});
