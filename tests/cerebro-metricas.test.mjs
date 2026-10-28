import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupChat,farolFixture,MEMBER,OTHER,answer,tool} from './helpers/chat-handler.mjs';

test('chat usa a fonte do painel com JWT do ator e escopo do membro autorizado',async()=>{
  let result;
  const app=await setupChat({model:body=>{
    const last=body.messages.at(-1).content;
    if(typeof last==='string') return tool('numeros_da_clinica',{dias:30,member_id:OTHER});
    result=last[0].content; return answer('Consultado.');
  }});
  assert.equal((await app.ask()).status,200);
  const call=app.calls.find(c=>c.url.endsWith('/farol-metricas'));
  assert.ok(call,'deve consultar o mesmo endpoint da Visão Geral, não a RPC legada');
  assert.equal(call.headers.Authorization,'Bearer user-token');
  assert.equal(call.body.member_id,MEMBER);
  const data=JSON.parse(result);
  assert.equal(data.fonte,'Visão Geral / get_funil_metrics');
  assert.deepEqual(data.metricas,{novos:100,agendadas:20,realizadas:14,indicacoes:6,cirurgias:2,perdidos:3});
  assert.equal(data.periodo.date_start,'2026-09-29');
  assert.equal(data.fuso,'America/Manaus');
  assert.equal(data.coorte,false);
  assert.equal(data.taxas_de_conversao,null);
  assert.equal(data.taxa_comparecimento,null);
  assert.equal(data.definicoes.cirurgias.rotulo,'Fechamentos');
  assert.equal(data.definicoes.cirurgias.unidade,'registros por procedimento');
  assert.equal(data.definicoes.agendadas.unidade,'pessoas');
  assert.equal(result.includes('DO NOT PASS'),false);
  assert.equal(result.includes('99999'),false);
});

test('intervalo explícito é enviado ao painel sem cair em últimos 30 dias',async()=>{
  const app=await setupChat({model:body=>typeof body.messages.at(-1).content==='string'
    ?tool('numeros_da_clinica',{inicio:'2026-10-01',fim:'2026-10-20'}):answer('OK')});
  assert.equal((await app.ask()).status,200);
  const call=app.calls.find(c=>c.url.endsWith('/farol-metricas'));
  assert.ok(call,'consulta precisa usar o intervalo do painel');
  assert.deepEqual(call.body,{member_id:MEMBER,preset:'custom',from:'2026-10-01',to:'2026-10-20'});
});

test('fonte indisponível não vira zero nem resposta clínica preenchida',async()=>{
  const fixture=farolFixture();fixture.status='partial';fixture.funnel={status:'error',data:null};
  let result;
  const app=await setupChat({farol:fixture,model:body=>{
    const last=body.messages.at(-1).content;
    if(typeof last==='string')return tool('numeros_da_clinica');
    result=last[0].content;return answer('Fonte indisponível.');
  }});
  assert.equal((await app.ask()).status,200);
  assert.match(result,/"metricas":null/);
  assert.match(result,/"status":"indisponivel"/);
});

test('zero registrado permanece zero e todo o histórico não ganha comparação anterior',async()=>{
  const fixture=farolFixture();fixture.period.preset='all';fixture.funnel.data.periodo.novos=0;
  let result;
  const app=await setupChat({farol:fixture,model:body=>{
    const last=body.messages.at(-1).content;
    if(typeof last==='string')return tool('numeros_da_clinica',{periodo:'all'});
    result=JSON.parse(last[0].content);return answer('Consultado');
  }});
  await app.ask();assert.equal(result.metricas.novos,0);assert.equal(result.status,'pronto');
  assert.equal(result.anterior,null);
});

test('falha HTTP da fonte não usa consulta antiga como fallback',async()=>{
  let result;
  const app=await setupChat({farolStatus:503,farol:{error:'unavailable'},model:body=>{
    const last=body.messages.at(-1).content;
    if(typeof last==='string')return tool('numeros_da_clinica');
    result=JSON.parse(last[0].content);return answer('Indisponível');
  }});
  await app.ask();assert.equal(result.status,'indisponivel');assert.equal(result.metricas,null);
  assert.equal(app.calls.some(c=>c.url.includes('/rpc/cerebro_metricas')),false);
});
