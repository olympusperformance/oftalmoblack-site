import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/assets/membros.js',import.meta.url),'utf8');
test('nova tentativa usa mesma pergunta e histórico, sem duplicar fala ou incluir o erro',async()=>{
  const chat={falas:[],historico:[{role:'user',content:'Anterior'},{role:'assistant',content:'Resposta anterior'}],pensando:false};
  const input={value:'',disabled:false,focus(){}};const flow={innerHTML:'',scrollHeight:0};let failed=true;
  const calls=[];const context={chat,admin:false,st:{},$:(id)=>id==='chatInput'?input:flow,esc:String,
    ico:()=>'',bolha:(who,text)=>text,
    Club:{data:{cerebro:{perguntar:async(...args)=>{calls.push(args);if(failed){failed=false;throw Object.assign(new Error('Indisponível'),{retryable:true});}return {resposta:'OK',historico:[{role:'user',content:args[0]},{role:'assistant',content:'OK'}]};}}}}};
  vm.runInNewContext(source.slice(source.indexOf('  function renderChat('),source.indexOf('  function renderGrupo(')),context);
  context.perguntar('Meus indicadores');await new Promise(r=>setImmediate(r));
  assert.match(flow.innerHTML,/data-chat-retry/);
  assert.equal(chat.pensando,false);assert.equal(input.disabled,false);
  context.perguntar('Meus indicadores',1);await new Promise(r=>setImmediate(r));
  assert.equal(calls.length,2);assert.equal(calls[1][0],calls[0][0]);assert.deepEqual(calls[1][1],calls[0][1]);
  assert.deepEqual(chat.falas.map(f=>f.texto),['Meus indicadores','OK']);
  assert.doesNotMatch(flow.innerHTML,/data-chat-retry/);
});
