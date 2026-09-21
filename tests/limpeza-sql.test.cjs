const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'supabase', 'limpeza.sql');

test('limpeza.sql existe e só dropa o que a fase 4 manda', () => {
  assert.ok(fs.existsSync(file), 'supabase/limpeza.sql não existe');
  const sql = fs.readFileSync(file, 'utf8');
  assert.ok(sql.includes('drop function if exists public.toggle_task(uuid);'));
  assert.ok(sql.includes('drop table if exists public.tasks;'));
  assert.ok(sql.includes('alter table public.artifact_groups drop column if exists pilar;'));
  const drops = sql.match(/drop table[^;]*;/gi) || [];
  assert.ok(drops.length >= 1);
  drops.forEach(d => assert.ok(/public\.tasks/.test(d), 'único drop table permitido é tasks: ' + d));
  assert.ok(!/drop\s+column\s+if\s+exists\s+projeto_legado/i.test(sql), 'projeto_legado fica nesta fase');
  assert.ok(!/(delete\s+from|insert\s+into|update|alter\s+table|truncate|drop\s+table)\s+(public\.)?(artifact_steps|step_progress)/i.test(sql),
    'não escreve em etapa nem progresso (ler em select pode)');
  assert.equal((sql.match(/\ncommit;/g) || []).length, 1, 'um commit só');
  assert.ok(!/\\b/.test(sql), 'em regex do Postgres \\b é backspace');
});

test('snapshot de tasks nasce trancado antes do drop', () => {
  const sql = fs.readFileSync(file, 'utf8');
  const guarda = sql.indexOf("if to_regclass('public.tasks') is not null and to_regclass('public._bkp_20260922_tasks') is null then");
  const cria = sql.indexOf("execute 'create table public._bkp_20260922_tasks as select * from public.tasks';");
  const rls = sql.indexOf("execute 'alter table public._bkp_20260922_tasks enable row level security';");
  const rev = sql.indexOf("execute 'revoke all on public._bkp_20260922_tasks from anon, authenticated';");
  assert.ok(guarda >= 0 && guarda < cria, 'snapshot só roda se tasks ainda existe e o snapshot não');
  const drop = sql.indexOf('drop table if exists public.tasks;');
  assert.ok(cria >= 0 && rls > cria && rev > rls && drop > rev, 'ordem: cria → RLS → revoke → drop');
});

test('triggers recriados: herda artefato tolerante e guard área × frente', () => {
  const sql = fs.readFileSync(file, 'utf8');
  assert.ok(sql.includes('create or replace function public.demanda_herda_artefato()'));
  assert.ok(/new\.step_id is not distinct from old\.step_id/.test(sql), 'só re-deriva quando a etapa muda');
  assert.ok(/new\.step_id := null;/.test(sql), 'etapa inexistente vira null');
  assert.ok(sql.includes('create or replace function public.frente_casa_com_area()'));
  assert.ok(sql.includes('create trigger artifacts_casa_com_area'));
});
