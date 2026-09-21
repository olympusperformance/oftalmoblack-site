const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function source(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function extract(file, start, end) {
  const src = source(file);
  const a = src.indexOf(start), b = src.indexOf(end, a);
  assert(a >= 0 && b > a, 'marcador não encontrado em ' + file + ': ' + start);
  return src.slice(a, b);
}

test('COLUNAS aceita tipo do artefato e interna da área, e esquece o pilar', () => {
  const code = extract('public/assets/club-data.js', '  var COLUNAS = {', '  /* Campo de data');
  const ctx = vm.createContext({});
  vm.runInContext(code + '\nthis.COLUNAS = COLUNAS;', ctx);
  assert.ok(ctx.COLUNAS.artifacts.includes('tipo'));
  assert.ok(ctx.COLUNAS.artifact_groups.includes('interna'));
  assert.ok(!ctx.COLUNAS.artifact_groups.includes('pilar'));
});

function contextoCatalogo() {
  return vm.createContext({
    esc: s => String(s == null ? '' : s),
    siglas: ids => (ids || []).join(','),
    acoes: (tipo, id) => '<acts ' + tipo + ':' + id + '/>'
  });
}

test('cabeçalho da área não mostra pilar e marca área da equipe', () => {
  const code = extract('public/assets/admin.js', '  function cabecalhoGrupo(', '  function renderArtifacts(');
  const ctx = contextoCatalogo();
  vm.runInContext(code + '\nthis.cabecalhoGrupo = cabecalhoGrupo;', ctx);
  const mentorado = ctx.cabecalhoGrupo({ id:'g1', nome:'Geração de demanda', pilar:'P07 Máquina Black de Tráfego', responsaveis:['TA'], interna:false }, 6);
  assert.ok(mentorado.includes('Geração de demanda'));
  assert.ok(mentorado.includes('6 artefatos'));
  assert.ok(!mentorado.includes('P07'), 'pilar não pode aparecer');
  assert.ok(!mentorado.includes('equipe'));
  const equipe = ctx.cabecalhoGrupo({ id:'g2', nome:'Operação Olympus', responsaveis:[], interna:true }, 1);
  assert.ok(equipe.includes('equipe'));
  assert.ok(equipe.includes('1 frente'));
  assert.ok(equipe.includes('class="tr grp pai interna"'));
  const sem = ctx.cabecalhoGrupo(null, 2);
  assert.ok(sem.includes('Sem área'));
  assert.ok(!sem.includes('grupo'));
});

test('nenhum código lê pilar ou PILARES', () => {
  for (const file of ['public/assets/admin.js', 'public/assets/club-ui.js', 'public/assets/club-data.js', 'public/assets/membros.js']) {
    const src = source(file);
    assert.ok(!/PILARES/.test(src), file + ' ainda cita PILARES');
    assert.ok(!/\.pilar\b/.test(src), file + ' ainda lê .pilar');
  }
});

test('artefatosDe devolve os da turma e os dele, nunca frente interna', () => {
  const code = extract('public/assets/admin.js', '  function artefatosDe(', '  /* ── tabela');
  const ctx = vm.createContext({ st: { artifacts: [
    { id:'turma',   nome:'GBP',            member_id:null, tipo:'artefato' },
    { id:'dele',    nome:'Encontro',       member_id:'m1', tipo:'artefato' },
    { id:'outro',   nome:'Só do m2',       member_id:'m2', tipo:'artefato' },
    { id:'interna', nome:'Olympus OS',     member_id:null, tipo:'interna' },
    { id:'legado',  nome:'Sem tipo ainda', member_id:null }
  ] } });
  vm.runInContext(code + '\nthis.artefatosDe = artefatosDe;', ctx);
  assert.deepEqual(ctx.artefatosDe('m1').map(a => a.id), ['turma', 'dele', 'legado']);
});
