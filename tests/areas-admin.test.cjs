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
