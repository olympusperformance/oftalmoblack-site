import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const rows = JSON.parse(readFileSync(new URL('./fixtures/graduacao-planilha.json', import.meta.url)));
const Club = { esc: text => String(text || ''), icon: name => `<i>${name}</i>` };
vm.runInNewContext(readFileSync(new URL('../public/assets/club-graduacao.js', import.meta.url), 'utf8'), { window:{ Club } });
const G = Club.graduacao;

test('radar reproduz os 29 mentorados, 1 graduação e 11 na reta final', () => {
  assert.equal(rows.length, 29);
  const models = rows.map(r => G.model(r.snapshot, '2026-T3'));
  assert.equal(models.filter(m => m.status === 'ready').length, 1);
  assert.equal(models.filter(m => m.status === 'near').length, 11);
});
test('pontuação do trimestre reconcilia participação, indicação e bônus', () => {
  rows.forEach(({ memberName, snapshot }) => snapshot.periods.filter(p => p.state !== 'future').forEach(p => {
    const expected = Object.values(p.scores).reduce((sum, v) => sum + (v || 0), 0) + (p.referrals || 0) * 50 + (p.bonus || 0);
    assert.ok(Math.abs(p.points - expected) < 0.11, memberName + ' ' + p.id);
  }));
});
test('Cintia tem 65,3 pontos e dois graus, sem ganhar um terceiro ao renderizar', () => {
  const row = rows.find(r => r.memberName === 'Cintia Santini');
  const m = G.model(row.snapshot, '2026-T3');
  assert.equal(m.points, 65.3); assert.equal(m.grade, 2); assert.equal(m.missing, 0); assert.equal(m.percent, 100);
  assert.equal(row.snapshot.recordedDegrees, 0);
});
test('Adriano e Oswaldo mostram o saldo exato, sem arredondar um ponto a mais', () => {
  const adriano = G.model(rows.find(r => r.memberName.startsWith('Adriano')).snapshot, '2026-T3');
  const oswaldo = G.model(rows.find(r => r.memberName.startsWith('Oswaldo')).snapshot, '2026-T3');
  assert.equal(adriano.missing, 31); assert.equal(oswaldo.missing, 3.3); assert.equal(oswaldo.status, 'near');
});
test('trimestres futuros e membros sem apuração não aparecem com zero pontos confirmado', () => {
  const future = G.model(rows[0].snapshot, '2026-T4');
  assert.equal(future.points, null); assert.equal(future.status, 'future'); assert.equal(future.missing, null);
  assert.equal(G.model(null, '2026-T3').status, 'missing');
  assert.ok(rows.every(r => r.snapshot.periods[1].referrals === null));
});
test('limiares da régua e dez graus são preservados', () => {
  assert.equal(G.status(19.9), 'starting'); assert.equal(G.status(20), 'progress');
  assert.equal(G.status(34.9), 'progress'); assert.equal(G.status(35), 'near');
  assert.equal(G.status(49.9), 'near'); assert.equal(G.status(50), 'ready');
  assert.equal(G.beltName(6), 'Faixa preta'); assert.equal(G.beltName(7), 'Coral vermelha e preta');
  assert.equal(G.beltName(8), 'Coral vermelha e branca'); assert.equal(G.beltName(9), 'Faixa vermelha');
  assert.equal(G.beltName(10), 'Faixa dourada');
});
