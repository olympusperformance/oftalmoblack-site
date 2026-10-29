import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dataSource = readFileSync(new URL('../public/assets/club-data.js', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../public/assets/club-auth.js', import.meta.url), 'utf8');
const session = (token, user = 'member-a') => ({ access_token: token, user: { id: user } });
function setup({ current = session('old'), refresh = { data: { session: session('new') } }, status = 401, errorBody = { erro:'falha' } } = {}) {
  const calls = []; let refreshes = 0;
  const Club = { cfg: { supabaseUrl: 'https://example.test' }, sb: { auth: {
    getSession: async () => ({ data: { session: current } }),
    refreshSession: async () => { refreshes++; return refresh; }
  } } };
  vm.runInNewContext(dataSource, { window: { Club, crypto: globalThis.crypto }, AbortController, setTimeout, clearTimeout, fetch: async (_url, options) => {
    calls.push(options);
    return calls.length === 1 ? Response.json(errorBody, { status })
      : Response.json({ resposta: 'OK', historico: [{role:'user',content:'Pergunta'},{role:'assistant',content:'OK'}] });
  } });
  return { Club, calls, refreshes: () => refreshes };
}

test('401 renova uma vez e repete a mesma pergunta com o novo token', async () => {
  const s = setup();
  const result = await s.Club.data.cerebro.perguntar('Pergunta', [{ role: 'user', content: 'Antes' }], 'preview');
  assert.equal(result.resposta, 'OK');
  assert.equal(s.refreshes(), 1);
  assert.equal(s.calls.length, 2);
  assert.equal(s.calls[1].headers.Authorization, 'Bearer new');
  assert.equal(s.calls[0].body, s.calls[1].body);
});

test('sessão revogada pede novo login sem reenviar a pergunta', async () => {
  const s = setup({ refresh: { error: { status: 400, code: 'refresh_token_not_found' } } });
  await assert.rejects(s.Club.data.cerebro.perguntar('Pergunta'), { code: 'AUTH_REQUIRED' });
  assert.equal(s.calls.length, 1);
});

test('sem sessão pede login antes de chamar o chat', async () => {
  const s = setup({ current: null });
  await assert.rejects(s.Club.data.cerebro.perguntar('Pergunta'), { code: 'AUTH_REQUIRED' });
  assert.equal(s.calls.length, 0);
});

test('conta trocada antes do envio não recebe o histórico restaurado de outra conta', async () => {
  const s = setup({current:session('other', 'member-b')});
  await assert.rejects(s.Club.data.cerebro.perguntar('Pergunta', [], undefined, 'member-a'), {code:'AUTH_REQUIRED'});
  assert.equal(s.calls.length,0);
});

test('erro temporário na renovação não é tratado como revogação', async () => {
  const s = setup({ refresh: { error: { status: 503, message: 'Unavailable' } } });
  await assert.rejects(s.Club.data.cerebro.perguntar('Pergunta'), e => e.code !== 'AUTH_REQUIRED' && /Tente novamente/.test(e.message));
  assert.equal(s.calls.length, 1);
});

test('403 de permissão não renova sessão nem repete a pergunta', async () => {
  const s = setup({ status: 403 });
  await assert.rejects(s.Club.data.cerebro.perguntar('Pergunta'), /falha/);
  assert.equal(s.refreshes(), 0);
  assert.equal(s.calls.length, 1);
});

test('falha recuperável preserva o código sem repetir a pergunta automaticamente', async () => {
  const s = setup({status:502,errorBody:{erro:'Tente em instantes.',codigo:'MODEL_BUSY',tentar_novamente:true}});
  await assert.rejects(s.Club.data.cerebro.perguntar('Pergunta'), e=>e.code === 'MODEL_BUSY' && e.retryable === true);
  assert.equal(s.calls.length,1);assert.equal(s.refreshes(),0);
});

test('troca de conta durante a renovação não envia o histórico para outro usuário', async () => {
  const s = setup({ refresh: { data: { session: session('new', 'member-b') } } });
  await assert.rejects(s.Club.data.cerebro.perguntar('Pergunta'), { code: 'AUTH_REQUIRED' });
  assert.equal(s.calls.length, 1);
});

test('um segundo 401 termina sem loop de renovação', async () => {
  let calls = 0, refreshes = 0;
  const Club = { cfg: { supabaseUrl: 'https://example.test' }, sb: { auth: {
    getSession: async () => ({ data: { session: session('old') } }),
    refreshSession: async () => { refreshes++; return { data: { session: session('new') } }; }
  } } };
  vm.runInNewContext(dataSource, { window: { Club, crypto: globalThis.crypto }, AbortController, setTimeout, clearTimeout, fetch: async () => {
    calls++; return Response.json({ erro: 'sessão inválida' }, { status: 401 });
  } });
  await assert.rejects(Club.data.cerebro.perguntar('Pergunta'), { code: 'AUTH_REQUIRED' });
  assert.equal(calls, 2); assert.equal(refreshes, 1);
});

test('sair desconecta somente a sessão deste navegador', async () => {
  const scopes = [], location = {};
  const Club = { sb: { auth: { signOut: async options => { scopes.push(options.scope); return {}; } } } };
  vm.runInNewContext(authSource, { window: { Club }, location });
  await Club.auth.logout();
  assert.deepEqual(scopes, ['local']);
  assert.equal(location.href, '/entrar/');
  assert.equal(Club.auth.current(), null);
});
