import test from 'node:test';
import assert from 'node:assert/strict';

const path = '../public/hands-on-grau-zero/v2/assets/model.js';
let model;
try { model = await import(path); } catch { model = {}; }

test('dados válidos abrem a tela de perguntas, sem concluir aplicação', () => {
  assert.equal(typeof model.createState, 'function', 'o modelo da nova experiência precisa existir');
  const state = model.transition(model.createState(), {type:'begin', identity:{nome:'Pessoa Técnica', whatsapp:'+55 92 90000-0000'}});
  assert.equal(state.screen, 'questions');
  assert.equal(state.step, 0);
  assert.equal(state.identity.whatsapp, '5592900000000');
});

test('nome vazio e telefone inválido mantêm a caixa inicial com erros específicos', () => {
  assert.equal(typeof model.createState, 'function');
  const state = model.transition(model.createState(), {type:'begin', identity:{nome:' ', whatsapp:'abc'}});
  assert.equal(state.screen, 'landing');
  assert.deepEqual(Object.keys(state.errors), ['nome','whatsapp']);
});

test('CRM e UF são obrigatórios antes da primeira pergunta avançar', () => {
  assert.equal(typeof model.createState, 'function');
  let state = model.transition(model.createState(), {type:'begin', identity:{nome:'Pessoa Técnica',whatsapp:'92900000000'}});
  state=model.transition(state,{type:'next'});
  assert.equal(state.step,0);
  assert.deepEqual(Object.keys(state.errors),['crm','uf']);
  state=model.transition(state,{type:'answer',key:'crm',value:'999999'});
  state=model.transition(state,{type:'answer',key:'uf',value:'AM'});
  state=model.transition(state,{type:'next'});
  assert.equal(state.step,1);
});

test('CRM emitido em Pernambuco ou Piauí é aceito e as 27 UFs são únicas', () => {
  assert.equal(typeof model.validateAnswer,'function');
  assert.deepEqual(model.validateAnswer(0,{crm:'123456',uf:'PE'}),{});
  assert.deepEqual(model.validateAnswer(0,{crm:'123456',uf:'PI'}),{});
  assert.equal(model.UFS.length,27);
  assert.equal(new Set(model.UFS).size,27);
});

test('zero cirurgias e ausência de operação/clínica completam o percurso', () => {
  assert.equal(typeof model.createState, 'function');
  let state=model.transition(model.createState(),{type:'begin',identity:{nome:'Pessoa Técnica',whatsapp:'92900000000'}});
  for(const [key,value] of Object.entries({crm:'999999',uf:'AM',experiencia_catarata:'ainda_nao_opero',cirurgias_mes:'0',experiencia_lentes:'ainda_nao_implanto',oferta_premium:'nao',clinica:'nao',objetivo:''})) state=model.transition(state,{type:'answer',key,value});
  for(let step=0;step<7;step++)state=model.transition(state,{type:'next'});
  assert.equal(state.screen,'review');
  assert.equal(state.answers.cirurgias_mes,'0');
  assert.equal(state.answers.clinica,'nao');
  assert.equal(model.reviewRows(state).length,9);
});

test('número vazio, negativo ou decimal não avança; zero avança', () => {
  assert.equal(typeof model.createState, 'function');
  for(const value of ['', '-1', '1.5', '10001']){
    let state={...model.createState(),screen:'questions',step:2,answers:{cirurgias_mes:value}};
    state=model.transition(state,{type:'next'});
    assert.equal(state.step,2);
    assert(state.errors.cirurgias_mes);
  }
  const state=model.transition({...model.createState(),screen:'questions',step:2,answers:{cirurgias_mes:'0'}},{type:'next'});
  assert.equal(state.step,3);
});

test('voltar e editar identificação preservam respostas, recomeçar limpa tudo', () => {
  assert.equal(typeof model.createState, 'function');
  const original={...model.createState(),screen:'questions',step:4,identity:{nome:'Pessoa Técnica',whatsapp:'92900000000'},answers:{crm:'123',uf:'SP',cirurgias_mes:'0'}};
  const back=model.transition(original,{type:'back'});
  assert.equal(back.step,3);
  const edit=model.transition(back,{type:'edit-identity'});
  assert.equal(edit.screen,'landing');
  assert.equal(edit.answers.cirurgias_mes,'0');
  assert.deepEqual(model.transition(edit,{type:'restart'}),model.createState());
  assert.equal(original.step,4,'transições não modificam o estado anterior');
});

test('valores fora das opções conhecidas são recusados, objetivo é opcional', () => {
  assert.equal(typeof model.validateAnswer, 'function');
  assert(model.validateAnswer(1,{experiencia_catarata:'elegivel'}).experiencia_catarata);
  assert.deepEqual(model.validateAnswer(6,{objetivo:''}),{});
  assert(model.validateAnswer(6,{objetivo:'x'.repeat(2001)}).objetivo);
});

test('WhatsApp brasileiro fica legível sem modificar o valor normalizado e internacionais mantêm o literal', () => {
  assert.equal(typeof model.formatWhatsAppForDisplay,'function');
  const state=model.transition(model.createState(),{type:'begin',identity:{nome:'Pessoa Técnica',whatsapp:'+55 92 90000-0000'}});
  assert.equal(model.formatWhatsAppForDisplay(state.identity.whatsapp),'+55 (92) 90000-0000');
  assert.equal(model.reviewRows(state)[1][1],'+55 (92) 90000-0000');
  assert.equal(state.identity.whatsapp,'5592900000000');
  assert.equal(model.formatWhatsAppForDisplay('1130000000'),'(11) 3000-0000');
  assert.equal(model.formatWhatsAppForDisplay('+1 415 555 2671'),'+1 415 555 2671');
  assert.equal(model.formatWhatsAppForDisplay('442079460000'),'442079460000');
});
