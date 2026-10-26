import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/imersaograuzero/pesquisa/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const catalog=script.slice(script.indexOf('var PERFIS ='),script.indexOf('/* ---------- estado'));
function fn(name){const start=script.indexOf('  function '+name+'(');assert.ok(start>=0,'missing function '+name);const end=script.indexOf('\n  function ',start+5);return script.slice(start,end<0?undefined:end);}
test('aulas follow profile without inventing attendance days',()=>{
  const get=new Function('d',catalog+fn('aulasVisiveis')+';return aulasVisiveis().map(g=>g.dia)');
  assert.deepEqual(get({perfil:'mestre',dias:[]}),['22','23','24']);
  assert.deepEqual(get({perfil:'participante',dias:[]}),['23','24']);
});
test('profile navigation no longer requires selected days',()=>{
  const validate=new Function('S','d','limparErros','erro',fn('valida')+';return valida("perfil")');
  assert.equal(validate({etapa:'perfil'},{perfil:'participante',dias:[]},()=>{},()=>false),true);
});
test('new payload keeps anonymous response id and comments but never assumes attended days',()=>{
  const build=new Function('d','S','VERSAO','TESTE','$','aplica','BLACK',catalog+fn('montarEnvio')+';return montarEnvio()');
  const d={perfil:'mestre',dias:['22'],notas_aulas:{refrativa:5},comentarios_aulas:{refrativa:'Bom'},barreira_aplicacao:'Prática',nao_usa_club:{sistema:true},nome:'Do not send',nps_evento:9};
  const p=build(d,{resposta_id:'same-uuid',iniciado_em:Date.now(),utm:{},ref:''},'2026-10-26-r1',false,()=>({value:''}),()=>true,{mestre:1,equipe:1});
  assert.equal(p.resposta_id,'same-uuid');assert.deepEqual(p.dias,[]);
  assert.deepEqual(p.comentarios_aulas,{refrativa:'Bom'});assert.equal(p.barreira_aplicacao,'Prática');assert.deepEqual(p.nao_usa_club,['sistema']);assert.ok(!('nome' in p));
});
test('old draft and pending payload keep identity and received version when loading new form',()=>{
  const saved={resposta_id:'draft-uuid',etapa:'aulas',enviado_em:123,d:{perfil:'mestre',dias:['22'],nome:'remove',notas_aulas:{branding:4}},pendente:{versao:'2026-10-24',resposta_id:'draft-uuid',nome:'remove'}};
  const load=new Function('localStorage','LS','lerUtm','VERSAO',fn('carregar')+';return carregar()');
  const s=load({getItem:()=>JSON.stringify(saved)},'existing-key',()=>({}),'2026-10-26-r1');
  assert.equal(s.resposta_id,'draft-uuid');assert.equal(s.enviado_em,123);assert.equal(s.pendente.versao,'2026-10-24');assert.equal(s.pendente.resposta_id,'draft-uuid');
  assert.deepEqual(s.d.comentarios_aulas,{});assert.deepEqual(s.d.nao_usa_club,{});assert.equal(s.d.barreira_aplicacao,'');assert.ok(!('nome' in s.d));assert.ok(!('nome' in s.pendente));
});
