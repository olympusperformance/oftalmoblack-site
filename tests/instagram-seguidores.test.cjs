const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function funcoes(arquivo, membro) {
  const fonte = fs.readFileSync(arquivo, 'utf8');
  const ini = fonte.indexOf('  function serieSeguidores30(');
  const fim = fonte.indexOf('  function dica()', ini);
  assert.notEqual(ini, -1, 'inicio das funcoes nao encontrado');
  assert.notEqual(fim, -1, 'fim das funcoes nao encontrado');

  const fmt = (dia) => dia;
  const contexto = {
    esc: (v) => String(v),
    Club: { fmtDataCurta: fmt },
    C: { fmtDataCurta: fmt },
  };
  vm.createContext(contexto);
  vm.runInContext(fonte.slice(ini, fim) +
    '\nthis.api = { serieSeguidores30, barras, curvaSeguidores };', contexto);
  return contexto.api;
}

for (const [nome, arquivo] of [
  ['admin', 'public/assets/admin.js'],
  ['mentorado', 'public/assets/club-instagram.js'],
]) {
  test(`${nome}: calendario preserva zero e deixa dia ausente como pendente`, () => {
    const api = funcoes(arquivo);
    const serie = api.serieSeguidores30([
      { dia:'2026-09-21', seguidores_ganhos:0 },
      { dia:'2026-09-22', seguidores_ganhos:12 },
    ], '2026-09-22');

    assert.equal(serie.length, 30);
    assert.equal(serie[28].seguidores_ganhos, 0);
    assert.equal(serie[27].seguidores_ganhos, null);
    assert.match(api.barras(serie, 'seguidores_ganhos', 96), /aguardando dado da Meta/);
  });

  test(`${nome}: curva nao inventa historico antes de uma lacuna`, () => {
    const api = funcoes(arquivo);
    const curva = api.curvaSeguidores([
      { dia:'2026-09-20', seguidores_ganhos:5 },
      { dia:'2026-09-21', seguidores_ganhos:null },
      { dia:'2026-09-22', seguidores_ganhos:2 },
    ], 100);

    assert.equal(curva[2].seguidores, 100);
    assert.equal(curva[1].seguidores, 98);
    assert.equal(curva[0].seguidores, null);
  });
}
