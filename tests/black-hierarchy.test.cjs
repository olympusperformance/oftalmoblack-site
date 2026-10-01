const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../public/assets/club-metodo.js');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
test('Degraus são agrupadores, não entregas duplicadas; compartilhar mantém a identidade',()=>{
 const shared={id:'training',nome:'Treinamento comercial',method_steps:['D04','D09','D10','TREINO']};
 const groups=M.catalogGroups([shared,{id:'old',nome:'Time Premium',method_steps:['D04'],archived_at:'2026-10-01'},
  {id:'site',nome:'Site Institucional',method_steps:['D05']},{id:'iris',nome:'Íris Black',method_steps:[]},
  {id:'quiz',nome:'Quiz',method_steps:[]},{id:'auto',nome:'Automação Instagram',method_steps:[]},
  {id:'internal',nome:'Operação',tipo:'interna'}],true);
 assert.equal(groups.filter(g=>g.kind==='step').length,12);
 for(const id of ['D04','D09','D10','TREINO'])assert.strictEqual(groups.find(g=>g.id===id).items[0],shared);
 assert.equal(groups.find(g=>g.id==='MODULOS').items[0].id,'iris');
 assert.deepEqual(groups.find(g=>g.id==='SEM_VINCULO').items.map(a=>a.id),['auto','quiz']);
 assert.equal(groups.find(g=>g.id==='D07').items.length,0,'Checklist sem entrega não gera artefato fictício');
 assert.ok(groups.every(g=>g.items.every(a=>!['old','internal'].includes(a.id))));
});
test('Catálogo filtra arquivados sem remover etapas ou progresso do banco',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/assets/club-data.js'),'utf8');
 const begin=source.indexOf('    artifacts: {',source.indexOf('var COLUNAS')+3000),end=source.indexOf('      save:',begin);
 assert.ok(begin>0&&end>begin);
 const items=[{id:'old',archived_at:'2026-10-01'},{id:'live',nome:'Site'}];
 const ctx=vm.createContext({sb:()=>({from:()=>({select:()=>Promise.resolve(items)})}),opt:()=>null,doMembro:x=>x,lista:x=>x,byOrdemNome:()=>0});
 vm.runInContext('this.api={'+source.slice(begin,end)+'}};',ctx);
 assert.deepEqual(Array.from(await ctx.api.artifacts.list(),a=>a.id),['live']);
 assert.equal(items.length,2);
});
