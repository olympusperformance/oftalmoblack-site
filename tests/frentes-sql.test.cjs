const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'supabase', 'frentes-internas.sql');

test('frentes-internas.sql existe e não mexe em etapa de artefato', () => {
  assert.ok(fs.existsSync(file), 'supabase/frentes-internas.sql não existe');
  const sql = fs.readFileSync(file, 'utf8');
  assert.ok(!/delete\s+from\s+public\.artifact_steps/i.test(sql), 'não pode apagar etapa');
  assert.ok(!/delete\s+from\s+public\.step_progress/i.test(sql), 'não pode apagar progresso');
  assert.ok(!/drop\s+table/i.test(sql), 'não pode dropar tabela');
  assert.ok(!/truncate/i.test(sql), 'não pode truncar');
  assert.equal((sql.match(/\ncommit;/g) || []).length, 1, 'um commit só');
});

test('snapshot de demands nasce trancado', () => {
  const sql = fs.readFileSync(file, 'utf8');
  assert.ok(/create table if not exists public\._bkp_20260922_demands\s+as select \* from public\.demands/.test(sql));
  assert.ok(/alter table public\._bkp_20260922_demands\s+enable row level security/.test(sql));
  assert.ok(/revoke all on public\._bkp_20260922_demands\s+from anon, authenticated;/.test(sql));
});

test('rename de projeto é condicional e o backfill só preenche artifact_id vazio', () => {
  const sql = fs.readFileSync(file, 'utf8');
  assert.ok(/rename column projeto to projeto_legado/.test(sql));
  assert.ok(/column_name = 'projeto'\)/.test(sql), 'rename precisa checar se a coluna ainda se chama projeto');
  const updates = sql.match(/update public\.demands[\s\S]*?;/g) || [];
  assert.ok(updates.length >= 2, 'esperado ao menos dois updates em demands (internas e mentorado)');
  updates.forEach((u, i) => assert.ok(/artifact_id is null/.test(u), 'update #' + (i + 1) + ' precisa de "artifact_id is null"'));
});
