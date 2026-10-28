const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function renderPerfil(admin) {
  const code = fs.readFileSync('public/assets/membros.js', 'utf8');
  const start = code.indexOf('  function renderPerfil()');
  const end = code.indexOf('  /* ── resumo da semana', start);
  assert.ok(start >= 0 && end > start, 'perfil não encontrado');
  const host = { innerHTML: '' };
  const context = {
    admin, st: { membro: { nome: 'Médica Teste', email: 'teste@example.com' } },
    $: () => host, esc: value => String(value || ''), ico: () => '',
    Club: { initials: () => 'MT', fmtMesAno: () => '' }
  };
  vm.runInNewContext(code.slice(start, end) + '\nrenderPerfil();', context);
  return host.innerHTML;
}

test('perfil do membro oferece alteração de senha pela sessão autenticada', () => {
  const html = renderPerfil(false);
  assert.match(html, /href="\/recuperar-senha\/"[^>]*>\s*Alterar senha/);
});

test('prévia administrativa não oferece alteração de senha em nome do membro', () => {
  assert.doesNotMatch(renderPerfil(true), /Alterar senha/);
});
