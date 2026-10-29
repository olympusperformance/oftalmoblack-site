import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const storeSource=readFileSync(new URL('../public/assets/club-chat-session.js',import.meta.url),'utf8');
const uiSource=readFileSync(new URL('../public/assets/membros.js',import.meta.url),'utf8');
const block=uiSource.slice(uiSource.indexOf('  function renderChat('),uiSource.indexOf('  function renderGrupo('));
const listeners=uiSource.slice(uiSource.indexOf("  window.addEventListener('storage'"),uiSource.indexOf("  $('chatFluxo').addEventListener"));
const flush=()=>new Promise(r=>setImmediate(r));
function page(shared=new Map(),reply=async q=>'Resposta '+q,clock={now:1000000000}){
 const requests=[],events={},elements={chatInput:{value:'',focus(){}},chatFluxo:{innerHTML:'',scrollHeight:0},chatStatus:{},chatReset:{}};
 const Club={data:{cerebro:{perguntar:async(q,h,target,actor)=>{
  requests.push({q,h:structuredClone(h),target,actor});
  const answer=await reply(q);return {resposta:answer,historico:[...h,{role:'user',content:q},{role:'assistant',content:answer}]};
 }}}};
 const context={window:{Club,addEventListener:(name,fn)=>events[name]=fn,crypto:globalThis.crypto,localStorage:{getItem:k=>shared.get(k)||null,setItem:(k,v)=>shared.set(k,v),removeItem:k=>shared.delete(k)}},
  Date:{now:()=>clock.now},Club,admin:false,st:{membro:{id:'m1'}},$:(id)=>elements[id],esc:String,ico:()=>'',bolha:(_who,text)=>text};
 vm.runInNewContext(storeSource,context);
 context.chat={cache:Club.chatSessions.open('alice','m1'),falas:[],historico:[],ready:true,turn:0,userId:'alice'};
 vm.runInNewContext(block,context);context.restaurarChat(undefined,context.chat.cache.state());
 vm.runInNewContext(listeners,context);
 return {context,requests,elements,events,chat:context.chat,shared,clock};
}
test('UI recarregada envia os pares restaurados na próxima pergunta',async()=>{
 const a=page();a.context.perguntar('Aurora');await flush();
 const b=page(a.shared);assert.match(b.elements.chatFluxo.innerHTML,/Aurora/);
 b.context.perguntar('Continue');await flush();
 assert.deepEqual(b.requests[0].h,[{role:'user',content:'Aurora'},{role:'assistant',content:'Resposta Aurora'}]);
 assert.equal(b.requests[0].actor,'alice');assert.equal(b.chat.falas.length,4);
});
test('UI recarregada após falha conserva pergunta pendente e retry sem duplicação',async()=>{
 const a=page(new Map(),async()=>{throw Object.assign(Error('temporário'),{retryable:true});});
 a.context.perguntar('Continue');await flush();
 const b=page(a.shared);assert.match(b.elements.chatFluxo.innerHTML,/data-chat-retry/);
 b.context.perguntar('Continue',1);await flush();
 assert.deepEqual(Array.from(b.chat.falas,f=>f.texto),['Continue','Resposta Continue']);
 assert.equal(page(b.shared).chat.falas.length,2);
});
test('UI descarta conclusão atrasada após reset em outra aba',async()=>{
 let finish;const a=page(new Map(),()=>new Promise(r=>{finish=r;}));a.context.perguntar('Antiga');
 const b=page(a.shared);b.chat.cache.reset();finish('Tardia');await flush();
 assert.equal(a.chat.falas.length,0);assert.equal(page(a.shared).chat.falas.length,0);
});
test('sessão expirada na página aberta preserva rascunho e exige novo envio sem contexto antigo',async()=>{
 const a=page();a.context.perguntar('Antes');await flush();a.clock.now+=86400000;
 a.context.perguntar('Depois');assert.equal(a.requests.length,1);assert.equal(a.elements.chatInput.value,'Depois');
 assert.match(a.elements.chatStatus.textContent,/expirou/);assert.equal(a.chat.historico.length,0);
 a.context.perguntar('Depois');await flush();assert.deepEqual(a.requests[1].h,[]);
});

test('reabrir a página após 24h mostra a expiração e não restaura mensagens',async()=>{
 const a=page();a.context.perguntar('Antes');await flush();a.clock.now+=86400000;
 const b=page(a.shared,undefined,a.clock);
 assert.equal(b.chat.falas.length,0);assert.match(b.elements.chatStatus.textContent,/expirou/);
});

test('atualizar outro mentorado em outra aba não interrompe a resposta atual',async()=>{
 let finish;const a=page(new Map(),()=>new Promise(r=>{finish=r;}));a.context.perguntar('Atual');
 a.context.Club.chatSessions.open('alice','m2').begin('Outro mentorado');
 a.events.storage({key:a.context.Club.chatSessions.key});
 assert.equal(a.chat.pensando,true);finish('Resposta atual');await flush();
 assert.equal(a.chat.historico.at(-1).content,'Resposta atual');
});
