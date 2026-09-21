const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

function source(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

const tabelasSnapshot = [
  '_bkp_20260921_artifact_groups',
  '_bkp_20260921_artifacts',
  '_bkp_20260921_artifact_steps',
  '_bkp_20260921_step_progress',
  '_bkp_20260921_demands',
  '_bkp_20260921_demand_steps'
];

test('areas.sql não apaga dado existente e tranca o snapshot novo em public', () => {
  const sql = source('supabase/areas.sql');

  // (a) nada aqui apaga etapa existente nem dropa/trunca tabela.
  assert.ok(!sql.includes('delete from public.artifact_steps'),
    'não pode apagar etapas de artefato existente (regra de ouro do cabeçalho)');
  assert.ok(!sql.includes('drop table'), 'não pode dropar tabela');
  assert.ok(!sql.includes('truncate'), 'não pode truncar tabela');

  // (b) cada tabela de snapshot nova em public nasce com RLS ligado. Espaço
  // entre o nome e "enable" pode ser único ou alinhado em coluna.
  for (const nome of tabelasSnapshot) {
    const re = new RegExp('alter table public\\.' + nome + '\\s+enable row level security');
    assert.ok(re.test(sql), `RLS não ligado para ${nome} (esperado casar: ${re})`);
  }

  // (c) o revoke do bloco de trava cobre anon e authenticated.
  const i = sql.indexOf('revoke all on public._bkp_20260921_artifact_groups');
  assert.ok(i >= 0, 'bloco "revoke all on public._bkp_20260921_artifact_groups" não encontrado');
  assert.ok(sql.slice(i).includes('from anon, authenticated;'),
    'revoke não termina cobrindo "from anon, authenticated;"');

  // (c2) as seis tabelas estão DENTRO do mesmo revoke, não só a primeira.
  const fimRevoke = sql.indexOf('from anon, authenticated;', i);
  const blocoRevoke = sql.slice(i, fimRevoke);
  for (const nome of tabelasSnapshot) {
    assert.ok(blocoRevoke.includes('public.' + nome), `${nome} fora do revoke`);
  }

  // (d) uma transação só: commit; aparece exatamente uma vez.
  const ocorrencias = (sql.match(/commit;/g) || []).length;
  assert.equal(ocorrencias, 1, `esperado exatamente um "commit;", achei ${ocorrencias}`);
});
