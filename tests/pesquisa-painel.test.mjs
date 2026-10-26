import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/imersaograuzero/pesquisa/resultados/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fn(name){const start=script.indexOf('  function '+name+'(');assert.ok(start>=0,'missing function '+name);const end=script.indexOf('\n  function ',start+5);return script.slice(start,end<0?script.indexOf('  /* ---------- eventos',start):end);}
test('version selection preserves a historical revision while all versions count each id only once',()=>{
  const rows=[{resposta_id:'one',versao:'2026-10-24',recebido_em:'2026-10-24T10:00:00Z',nps_evento:8},{resposta_id:'one',versao:'2026-10-26-r1',recebido_em:'2026-10-26T10:00:00Z',nps_evento:9},{resposta_id:'two',versao:'2026-10-24',recebido_em:'2026-10-24T12:00:00Z',nps_evento:7}];
  const select=new Function('historico','versao',fn('ultimaVersao')+fn('baseVersao')+';return baseVersao()');
  assert.deepEqual(select(rows,'').map(r=>r.nps_evento),[9,7]);
  assert.deepEqual(select(rows,'2026-10-24').map(r=>r.nps_evento),[7,8]);
});
test('CSV exports version and lecture comments without expanding identification fields',async()=>{
  let captured;
  const row={resposta_id:'id-test',perfil:'participante',versao:'2026-10-26-r1',dias:[],comentarios_aulas:{refrativa:'Bons exemplos'},barreira_aplicacao:'Material',nao_usa_club:[],nome:'DO NOT EXPORT'};
  const download=new Function('filtradas','EVENTO_ROT','PALESTRA_ROT','CLUB_ROT','AULAS_ROT','PERFIL_ROT','TESTES','document','URL','Blob','setTimeout',fn('csv')+';csv()');
  download(()=>[row],{},{refrativa:'Renato'},{},{},{participante:'Participante'},false,{createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}},{createObjectURL:b=>{captured=b;return 'synthetic';},revokeObjectURL(){}},Blob,()=>{});
  const text=await captured.text();
  assert.ok(text.includes('2026-10-26-r1'));assert.ok(text.includes('Bons exemplos'));assert.ok(text.includes('Material'));assert.ok(!text.includes('DO NOT EXPORT'));
});
test('lecture feedback is escaped as text and retains the lecture label',()=>{
  const nodes={abas:{},coments:{}};
  const render=new Function('$','COMENT','aba','PALESTRA_ROT','PERFIL_ROT',fn('esc')+fn('desenharComentarios')+';desenharComentarios([{perfil:"participante",versao:"2026-10-26-r1",comentarios_aulas:{refrativa:"<img src=x onerror=alert(1)>"}}])');
  render(id=>nodes[id],[{id:'comentarios_aulas',t:'Por aula'}],'comentarios_aulas',{refrativa:'Renato Ambrósio Jr.'},{participante:'Participante'});
  assert.ok(nodes.coments.innerHTML.includes('Renato Ambrósio Jr.'));
  assert.ok(nodes.coments.innerHTML.includes('&lt;img'));
  assert.ok(!nodes.coments.innerHTML.includes('<img'));
});
