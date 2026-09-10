import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/assets/club-data.js', import.meta.url), 'utf8');

test('chat envia alvo da pré-visualização e omite alvo no acesso normal', async () => {
  const calls = [];
  const Club = { cfg: { supabaseUrl: 'https://example.test' }, sb: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'sessao' } } }) },
  } };
  vm.runInNewContext(source, { window: { Club }, fetch: async (url, options) => {
    calls.push({ url, ...options });
    return Response.json({ resposta: 'OK', historico: [] });
  } });
  const history = [{ role: 'user', content: 'anterior' }];
  await Club.data.cerebro.perguntar('pergunta', history, 'mentorado-escolhido');
  await Club.data.cerebro.perguntar('pergunta');
  assert.deepEqual(JSON.parse(calls[0].body), { pergunta: 'pergunta', historico: history, member_id: 'mentorado-escolhido' });
  assert.equal(calls[0].headers.Authorization, 'Bearer sessao');
  assert.deepEqual(JSON.parse(calls[1].body), { pergunta: 'pergunta', historico: [] });
});
