const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const [nome, arquivo] of [
  ['admin', 'public/assets/admin.js'],
  ['mentorado', 'public/assets/club-instagram.js'],
]) {
  test(`${nome}: área do alcance não atravessa dias sem medição`, () => {
    const fonte = fs.readFileSync(arquivo, 'utf8');
    const ini = fonte.indexOf('  function grafico(');
    const fim = fonte.indexOf('  function serieSeguidores30(', ini);
    assert.ok(ini >= 0 && fim > ini);
    const contexto = {
      st: {},
      esc: String,
      Club: { fmtDataCurta: String },
    };
    vm.createContext(contexto);
    vm.runInContext(fonte.slice(ini, fim) + '\nthis.grafico = grafico;', contexto);

    const html = contexto.grafico([
      { dia: '2026-09-20', alcance_dia: 10 },
      { dia: '2026-09-21', alcance_dia: 20 },
      { dia: '2026-09-22', alcance_dia: null },
      { dia: '2026-09-23', alcance_dia: 15 },
      { dia: '2026-09-24', alcance_dia: null },
    ], 'alcance_dia', '#fff', 170);
    const areas = html.match(/<path d="([^"]+)" fill="url/);
    assert.ok(areas);
    assert.match(areas[1], /L225\.0 170Z/);
    assert.match(areas[1], /M675\.0 170L675\.0/);
    assert.match(areas[1], /L675\.0 170Z/);
    assert.doesNotMatch(areas[1], /900\.0/);
  });

  test(`${nome}: oferece períodos de 7 e 30 dias`, () => {
    const fonte = fs.readFileSync(arquivo, 'utf8');
    assert.match(fonte, /\[7, 30, 90, 180\]\.map/);
  });
}
