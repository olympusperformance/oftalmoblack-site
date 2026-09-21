const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function extract(file, start, end) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const a = src.indexOf(start), b = src.indexOf(end, a);
  assert(a >= 0 && b > a, 'marcador não encontrado: ' + start);
  return src.slice(a, b);
}

const grupos = [
  { id:'g4', nome:'Geração de demanda',  ordem:4, interna:false },
  { id:'g1', nome:'Onboarding',          ordem:1, interna:false },
  { id:'g3', nome:'Presença e conteúdo', ordem:3, interna:false }
];
const artefatos = [
  { id:'quiz',    nome:'Quiz',        group_id:'g4', ordem:4, tipo:'artefato' },
  { id:'meta',    nome:'Meta Ads',    group_id:'g4', ordem:1, tipo:'artefato' },
  { id:'gbp',     nome:'GBP',         group_id:'g3', ordem:2, tipo:'artefato' },
  { id:'os',      nome:'Olympus OS',  group_id:'g4', ordem:9, tipo:'interna' },
  { id:'solto',   nome:'Sem área',    group_id:null, ordem:0, tipo:'artefato' },
  { id:'legado',  nome:'Sem tipo',    group_id:'g1', ordem:1 }
];

test('agruparPorArea ordena por área, artefato por ordem, solto por último, interna fora', () => {
  const code = extract('public/assets/membros.js', '  function agruparPorArea(', '  function renderArtifacts(');
  const ctx = vm.createContext({});
  vm.runInContext(code + '\nthis.agruparPorArea = agruparPorArea;', ctx);
  const secoes = ctx.agruparPorArea(artefatos, grupos);
  assert.deepEqual(secoes.map(s => s.grupo ? s.grupo.nome : null),
    ['Onboarding', 'Presença e conteúdo', 'Geração de demanda', null]);
  assert.deepEqual(secoes[2].itens.map(a => a.id), ['meta', 'quiz']);
  assert.deepEqual(secoes[3].itens.map(a => a.id), ['solto']);
  assert.ok(!secoes.some(s => s.itens.some(a => a.id === 'os')), 'frente interna vazou');
});

test('área sem artefato visível não vira seção vazia', () => {
  const code = extract('public/assets/membros.js', '  function agruparPorArea(', '  function renderArtifacts(');
  const ctx = vm.createContext({});
  vm.runInContext(code + '\nthis.agruparPorArea = agruparPorArea;', ctx);
  const secoes = ctx.agruparPorArea([artefatos[0]], grupos);
  assert.equal(secoes.length, 1);
  assert.equal(secoes[0].grupo.nome, 'Geração de demanda');
});

test('sem áreas (RLS devolveu vazio), tudo cai numa seção única sem título', () => {
  const code = extract('public/assets/membros.js', '  function agruparPorArea(', '  function renderArtifacts(');
  const ctx = vm.createContext({});
  vm.runInContext(code + '\nthis.agruparPorArea = agruparPorArea;', ctx);
  const secoes = ctx.agruparPorArea(artefatos, []);
  assert.equal(secoes.length, 1);
  assert.equal(secoes[0].grupo, null);
  const esperado = artefatos
    .filter(a => a.tipo !== 'interna')
    .slice()
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
    .map(a => a.id);
  assert.deepEqual(secoes[0].itens.map(a => a.id), esperado);
  assert.ok(!esperado.includes('os'), 'frente interna não devia entrar na lista esperada');
  assert.ok(!secoes[0].itens.some(a => a.id === 'os'), 'frente interna vazou pra seção sem título');
});
