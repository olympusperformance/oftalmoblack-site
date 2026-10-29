import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const file=new URL('../public/assets/club-chat-session.js',import.meta.url);
const source=existsSync(file)?readFileSync(file,'utf8'):'';
const pair=(q,a)=>[{role:'user',content:q},{role:'assistant',content:a}];
function browser(shared=new Map(),clock={now:1000000000},broken=false){
 const storage={getItem:k=>shared.get(k)||null,setItem(k,v){if(broken)throw Error('quota');shared.set(k,v);},removeItem:k=>shared.delete(k)};
 const Club={},context={window:{Club,localStorage:storage,crypto:globalThis.crypto},Date:{now:()=>clock.now}};
 vm.runInNewContext(source,context);
 assert.equal(typeof Club.chatSessions?.open,'function','O chat precisa de persistência limitada por identidade');
 return {open:(u='alice',m='m1')=>Club.chatSessions.open(u,m),shared,clock};
}
function answer(s,q,a){const ticket=s.begin(q);assert.ok(ticket);assert.equal(s.complete(ticket,[...s.state().historico,...pair(q,a)]),true);}
test('nova página restaura pares completos da mesma conta e mentorado',()=>{
 const shared=new Map(),a=browser(shared).open();answer(a,'Projeto Aurora','100 leads');
 const b=browser(shared).open();assert.deepEqual(JSON.parse(JSON.stringify(b.state().historico)),pair('Projeto Aurora','100 leads'));
});
test('contas e mentorados diferentes nunca carregam o histórico alheio',()=>{
 const b=browser();answer(b.open(),'Segredo A','Resposta A');
 assert.equal(b.open('bob').state().historico.length,0);
 assert.equal(b.open('alice','m2').state().historico.length,0);
 assert.equal(b.open().state().historico.length,2);
});
test('recarga durante erro preserva pergunta pendente sem inventar resposta',()=>{
 const b=browser(),s=b.open();answer(s,'Base','Antes');s.begin('Continue');
 const restored=browser(b.shared).open().state();
 assert.equal(restored.pending,'Continue');assert.equal(restored.historico.length,2);
});
test('retomada não estende prazo de inatividade e nova conversa começa após 24h',()=>{
 const b=browser(),s=b.open();answer(s,'Antes','Resposta');
 b.clock.now+=23*3600000;assert.equal(b.open().state().historico.length,2);
 b.clock.now+=3600000;const expired=b.open().state();assert.equal(expired.historico.length,0);assert.equal(expired.reason,'expired');
});
test('conversa ativa também termina em sete dias',()=>{
 const b=browser(),s=b.open();for(let day=0;day<7;day++){answer(s,'Dia '+day,'Resposta');b.clock.now+=23*3600000;}
 b.clock.now+=7*3600000;assert.equal(b.open().state().historico.length,0);
});
test('limite mantém somente os seis pares recentes, sem órfãos',()=>{
 const s=browser().open();for(let i=0;i<10;i++)answer(s,'P'+i,'R'+i);
 const h=s.state().historico;assert.equal(h.length,12);assert.equal(h[0].content,'P4');assert.equal(h.at(-1).content,'R9');
});
test('limite de caracteres retira pares antigos por inteiro',()=>{
 const s=browser().open();answer(s,'P1','a'.repeat(15000));answer(s,'P2','b'.repeat(15000));answer(s,'P3','c'.repeat(15000));
 const h=s.state().historico;assert.equal(h.length,4);assert.equal(h[0].content,'P2');assert.ok(h.reduce((n,m)=>n+m.content.length,0)<=32000);
});
test('cache global permanece limitado quando admin alterna muitos mentorados',()=>{
 const b=browser();for(let i=0;i<20;i++)answer(b.open('alice','m'+i),'P','R'.repeat(15000));
 const raw=[...b.shared.values()][0];assert.ok(raw.length<=120000);assert.equal(JSON.parse(raw).entries.length,3);
 assert.equal(b.open('alice','m0').state().historico.length,0);
});
test('reset em outra aba impede resposta atrasada de ressuscitar histórico',()=>{
 const b=browser(),a=b.open();answer(a,'Base','Resposta');const t=a.begin('Em voo');
 b.open().reset();assert.equal(a.complete(t,[...pair('Base','Resposta'),...pair('Em voo','Tardia')]),false);
 assert.equal(b.open().state().historico.length,0);
});
test('aba desatualizada não sobrescreve uma conversa mais recente',()=>{
 const b=browser(),a=b.open(),other=b.open();answer(a,'Nova','Resposta');
 assert.equal(other.begin('Antiga'),null);
 other.restore();assert.equal(other.state().historico[0].content,'Nova');
});
test('recarga e reenvio invalidam resultado antigo da tentativa pendente',()=>{
 const b=browser(),a=b.open(),old=a.begin('Pergunta');const other=b.open(),retry=other.begin('Pergunta');
 assert.equal(a.complete(old,pair('Pergunta','Antiga')),false);assert.equal(other.complete(retry,pair('Pergunta','Nova')),true);
});
test('falha de storage mantém conversa em memória e informa que não persistiu',()=>{
 const s=browser(new Map(),{now:1000000000},true).open();answer(s,'P','R');
 assert.equal(s.state().historico.length,2);assert.equal(s.state().persisted,false);
});
test('JSON corrompido não impede o chat de abrir',()=>{
 const b=browser();answer(b.open(),'P','R');const key=[...b.shared.keys()][0];b.shared.set(key,'{broken');
 assert.equal(browser(b.shared).open().state().historico.length,0);
});
for (const [name,invalid] of [
 ['papel órfão',[{role:'assistant',content:'Órfão'}]],
 ['bloco interno',[{role:'user',content:'P'},{role:'assistant',content:[{type:'tool_use',name:'ferramenta'}]}]],
 ['papel de sistema',[{role:'system',content:'Interno'},{role:'assistant',content:'R'}]]
]) test(name+' não vira memória',()=>{
 const b=browser();answer(b.open(),'P','R');const key=[...b.shared.keys()][0],raw=JSON.parse(b.shared.get(key));
 raw.entries[0].historico=invalid;b.shared.set(key,JSON.stringify(raw));
 assert.equal(browser(b.shared).open().state().historico.length,0);
});
test('reset remove pares e pergunta pendente, mantendo nova sessão vazia',()=>{
 const s=browser().open();answer(s,'P','R');s.begin('Pendente');s.reset();
 assert.equal(s.state().historico.length,0);assert.equal(s.state().pending,null);
});
test('leitura de cache corrompido na mesma página não ressuscita cópia antiga',()=>{
 const b=browser(),s=b.open();answer(s,'Antiga','Resposta');
 b.shared.set([...b.shared.keys()][0],'{broken');s.restore();assert.equal(s.state().historico.length,0);
});
test('abrir uma conversa existente não reordena nem regrava caches de outras abas',()=>{
 const b=browser();answer(b.open('alice','m1'),'P1','R1');answer(b.open('alice','m2'),'P2','R2');
 const before=[...b.shared.values()][0];b.open('alice','m1');
 assert.equal([...b.shared.values()][0],before);
});

test('reset com quota esgotada remove o cache antigo para não reaparecer na recarga',()=>{
 const shared=new Map(),a=browser(shared).open();answer(a,'Antiga','Resposta');
 browser(shared,{now:1000000000},true).open().reset();
 assert.equal(browser(shared).open().state().historico.length,0);
});
