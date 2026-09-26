const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function extract(file,start,end) {
 const src=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const a=src.indexOf(start),b=src.indexOf(end,a); assert(a>=0&&b>a);
 return src.slice(a,b);
}
const tracker={id:'tracker',nome:'Tracker Black',tipo:'artefato',somente_equipe:true,group_id:'tech',status:'Disponível'};
const black={id:'black',nome:'Sistema Black',tipo:'artefato',somente_equipe:false,group_id:'tech',status:'Disponível'};
const groups=[{id:'tech',nome:'Tecnologia e dados',ordem:1}];
test('visão do mentorado, inclusive preview admin, remove Tracker da capa, catálogo e contagem',()=>{
 const nodes={artList:{},artListFull:{}};
 const ctx=vm.createContext({st:{artifacts:[tracker,black],groups},Club:{empty:()=>'',esc:s=>s},esc:s=>s,
  $:id=>nodes[id],etapasDe:()=>[{id:'step'}],parDe:()=>({estado:'ativo'}),cartaoArtefato:a=>a.nome});
 vm.runInContext(extract('public/assets/membros.js','  function agruparPorArea(','  /* ── agenda'),ctx);
 assert.equal(ctx.renderArtifacts(),1);
 for(const node of Object.values(nodes)){assert.doesNotMatch(node.innerHTML,/Tracker Black/);assert.match(node.innerHTML,/Sistema Black/);}
});
test('Farol do mentorado não inclui artefato somente da equipe',()=>{
 const ctx=vm.createContext({st:{artifacts:[tracker,black]},parDe:()=>({estado:'ativo'}),etapasDe:()=>[],Club:{}});
 vm.runInContext(extract('public/assets/membros.js','  function artefatosFarol(','  function entregasFarol('),ctx);
 assert.deepEqual(Array.from(ctx.artefatosFarol(),a=>a.artifact.id),['black']);
});
test('equipe mantém Tracker com checklist na progressão da clínica',()=>{
 const ctx=vm.createContext({st:{artifacts:[tracker,black]}});
 vm.runInContext(extract('public/assets/admin.js','  function artefatosDe(','  /* ── tabela'),ctx);
 assert.deepEqual(Array.from(ctx.artefatosDe('m1'),a=>a.id),['tracker','black']);
});
test('editor persiste visibilidade sem converter artefato em frente sem checklist',()=>{
 const ctx=vm.createContext({});
 vm.runInContext(extract('public/assets/club-data.js','  var COLUNAS = {','  /* Campo de data'),ctx);
 assert(ctx.COLUNAS.artifacts.includes('somente_equipe'));
});
