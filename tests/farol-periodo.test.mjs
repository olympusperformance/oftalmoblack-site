import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const raw=await readFile(new URL('../supabase/functions/farol-metricas/periodo.ts',import.meta.url),'utf8');
const period=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(raw,{mode:'transform'})).toString('base64'));

test('trimestre vigente termina no hoje da clínica, sem alterar o recorte histórico',()=>{
  const current=period.resolveRequestedPeriod({preset:'quarter',quarter:'2026-T4'},'2026-10-28');
  assert.ok(current,'o carregamento trimestral precisa de um contrato válido');
  assert.equal(current.date_start,'2026-10-01');assert.equal(current.date_end,'2026-10-28');assert.equal(current.days,28);
  assert.equal(current.not_started,false);
  const previous=period.resolveRequestedPeriod({preset:'quarter',quarter:'2026-T3'},'2026-10-28');
  assert.equal(previous.date_start,'2026-07-01');assert.equal(previous.date_end,'2026-09-30');assert.equal(previous.days,92);
  assert.equal(period.resolveRequestedPeriod({preset:'quarter',quarter:'2026-T4'},'2026-10-29').date_end,'2026-10-29');
});

test('trimestre futuro é explícito e não libera datas customizadas inválidas',()=>{
  const future=period.resolveRequestedPeriod({preset:'quarter',quarter:'2027-T1'},'2026-10-28');
  assert.ok(future);assert.equal(future.not_started,true);
  assert.equal(future.date_start,'2027-01-01');assert.equal(future.date_end,'2027-03-31');
  for(const quarter of ['2026-T0','2026-T5','26-T4',null])assert.equal(period.resolveRequestedPeriod({preset:'quarter',quarter},'2026-10-28'),null);
  assert.equal(period.resolveRequestedPeriod({preset:'custom',from:'2026-10-01',to:'2026-12-31'},'2026-10-28'),null);
});
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
