const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function funcoes(arquivo, membro) {
  const fonte = fs.readFileSync(arquivo, 'utf8');
  const ini = fonte.indexOf('  function barras(');
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
    '\nthis.api = { serieDoPeriodo, resumoDoPeriodo, barras, curvaSeguidores };', contexto);
  return contexto.api;
}

for (const [nome, arquivo] of [
  ['admin', 'public/assets/admin.js'],
  ['mentorado', 'public/assets/club-instagram.js'],
]) {
  test(`${nome}: calendario preserva zero e deixa dia ausente como pendente`, () => {
    const api = funcoes(arquivo);
    const serie = api.serieDoPeriodo([
      { dia:'2026-09-21', seguidores_ganhos:0 },
      { dia:'2026-09-22', seguidores_ganhos:12 },
    ], 30, '2026-09-22');

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

  test(`${nome}: calendario acompanha o periodo escolhido`, () => {
    const api = funcoes(arquivo);
    assert.equal(api.serieDoPeriodo([], 7, '2026-09-22').length, 7);
    assert.equal(api.serieDoPeriodo([], 180, '2026-09-22').length, 180);
  });

  test(`${nome}: curva usa o total medido quando existe`, () => {
    const api = funcoes(arquivo);
    const curva = api.curvaSeguidores([
      { dia:'2026-09-20', seguidores:80, seguidores_ganhos:5 },
      { dia:'2026-09-21', seguidores:null, seguidores_ganhos:3 },
      { dia:'2026-09-22', seguidores:90, seguidores_ganhos:2 },
    ], 100);

    assert.equal(curva[2].seguidores, 90);
    assert.equal(curva[1].seguidores, 88);
    assert.equal(curva[0].seguidores, 80);
    assert.equal(curva.estimados, 1);
  });

  test(`${nome}: periodo soma semanas sem sobrepor e conta publicacoes pela diferenca`, () => {
    const api = funcoes(arquivo);
    const dias = [];
    for (let i = 0; i < 15; i++) {
      const d = new Date(Date.UTC(2026, 8, 17 + i)).toISOString().slice(0, 10);
      dias.push({ dia:d, visualizacoes:100, interacoes:10, visitas_perfil:5, alcance:50, publicacoes:200 + i });
    }
    const r = api.resumoDoPeriodo(dias, 14);
    assert.equal(r.semanas, 2);
    assert.equal(r.visualizacoes, 200);
    assert.equal(r.alcance, 50);
    assert.equal(r.publicacoes, 14);
    assert.equal(api.resumoDoPeriodo(dias, 7).visualizacoes, 100);
  });
}
