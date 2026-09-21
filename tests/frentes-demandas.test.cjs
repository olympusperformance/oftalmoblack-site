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

test('COLUNAS.demands grava artifact_id e step_id, não projeto; os dois são nuláveis', () => {
  const code = extract('public/assets/club-data.js', '  var COLUNAS = {', '  /* Tabelas que só a administração');
  const ctx = vm.createContext({});
  vm.runInContext(code + '\nthis.COLUNAS = COLUNAS; this.NULAVEIS = NULAVEIS;', ctx);
  assert.ok(ctx.COLUNAS.demands.includes('artifact_id'));
  assert.ok(ctx.COLUNAS.demands.includes('step_id'));
  assert.ok(!ctx.COLUNAS.demands.includes('projeto'));
  assert.ok(!ctx.COLUNAS.demands.includes('projeto_legado'), 'legado é só leitura');
  assert.ok(ctx.NULAVEIS.includes('artifact_id'));
  assert.ok(ctx.NULAVEIS.includes('step_id'));
});
