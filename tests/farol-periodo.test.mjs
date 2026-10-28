import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const raw=await readFile(new URL('../supabase/functions/farol-metricas/periodo.ts',import.meta.url),'utf8');
const period=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(raw,{mode:'transform'})).toString('base64'));
test('dias corridos incluem hoje no calendário da clínica',()=>{
  assert.deepEqual(period.resolveRequestedPeriod({days:60},'2026-10-28'),{preset:'custom',date_start:'2026-08-30',date_end:'2026-10-28',days:60});
  assert.equal(period.resolveRequestedPeriod({days:30},'2026-10-28').date_start,'2026-09-29');
});
test('intervalos inválidos não viram período padrão silenciosamente',()=>{
  for(const days of [0,-1,1.5,367,'30',Infinity])assert.equal(period.resolveRequestedPeriod({days},'2026-10-28'),null);
  assert.equal(period.resolveRequestedPeriod({preset:'custom',from:'2026-02-30',to:'2026-10-28'},'2026-10-28'),null);
  assert.equal(period.resolveRequestedPeriod({preset:'custom',from:'2026-10-01',to:'2026-10-29'},'2026-10-28'),null);
  assert.equal(period.resolveRequestedPeriod({preset:'lastMonth'},'2026-10-28').date_end,'2026-09-30');
});
