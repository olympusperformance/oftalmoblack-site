import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const rows = JSON.parse(readFileSync(new URL('./fixtures/graduacao-planilha.json', import.meta.url)));
const Club = { esc: text => String(text || ''), icon: name => `<i>${name}</i>` };
vm.runInNewContext(readFileSync(new URL('../public/assets/club-graduacao.js', import.meta.url), 'utf8'), { window:{ Club } });
const G = Club.graduacao;

test('importação mostra data real, corte, estimativas e indicação de 25 pontos', () => {
  const record = { is_demo:false, source_date:'2026-09-30', snapshot:{grade:2, periods:[{
    id:'2026-T3', label:'Jul–set 2026', state:'closed', points:108.5,
    scores:{attendance:16.5, followers:20, videos:12}, referrals:2, referralUnitPoints:25,
    bonus:10, cutoffDate:'2026-09-24', followers:{growth:5100,estimated:true}
  }]}};
  const html = G.summary(record, '2026-T3');
  assert.match(html,/108,5/);
  assert.match(html,/30\/09\/2026/);
  assert.match(html,/24\/09\/2026/);
  assert.match(html,/vale 25 pontos/);
  assert.match(html,/Crescimento estimado/);
  assert.match(html,/2º grau/);
  assert.doesNotMatch(html,/Prévia da graduação|17\/09\/2026|data-gr-period/);
  record.is_demo=true;
  assert.match(G.summary(record,'2026-T3'),/Prévia da graduação/);
});

test('falta de pontos é exibida como aguardando apuração, não faltam zero', () => {
  const html=G.summary({snapshot:{periods:[{id:'2026-T3',state:'closed',points:null}]}},'2026-T3');
  assert.match(html,/Aguardando apuração/);
  assert.doesNotMatch(html,/Faltam 0 pontos/);
});

test('radar reproduz os 31 mentorados, 4 graduações e 10 na reta final', () => {
  assert.equal(rows.length, 31);
  const models = rows.map(r => G.model(r.snapshot, '2026-T3'));
  assert.equal(models.filter(m => m.status === 'ready').length, 4);
  assert.equal(models.filter(m => m.status === 'near').length, 10);
});
test('pontuação do trimestre reconcilia participação, indicação e bônus', () => {
  rows.forEach(({ memberName, snapshot }) => snapshot.periods.filter(p => p.state !== 'future').forEach(p => {
    const expected = Object.values(p.scores).reduce((sum, v) => sum + (v || 0), 0) + (p.referrals || 0) * (p.referralUnitPoints ?? 50) + (p.bonus || 0);
    assert.ok(Math.abs(p.points - expected) < 0.11, memberName + ' ' + p.id);
  }));
});
test('Cintia tem 113,5 pontos e dois graus, sem ganhar um terceiro ao renderizar', () => {
  const row = rows.find(r => r.memberName === 'Cintia Santini');
  const m = G.model(row.snapshot, '2026-T3');
  assert.equal(m.points, 113.5); assert.equal(m.grade, 2); assert.equal(m.missing, 0); assert.equal(m.percent, 100);
  assert.equal(row.snapshot.recordedDegrees, 0);
});
test('Adriano e Nauara mostram o saldo exato, sem arredondar um ponto a mais', () => {
  const adriano = G.model(rows.find(r => r.memberName.startsWith('Adriano')).snapshot, '2026-T3');
  const nauara = G.model(rows.find(r => r.memberName.startsWith('Nauara')).snapshot, '2026-T3');
  assert.equal(adriano.missing, 25.8); assert.equal(nauara.missing, 3.6); assert.equal(nauara.status, 'near');
});
test('trimestres futuros e membros sem apuração não aparecem com zero pontos confirmado', () => {
  const future = G.model(rows[0].snapshot, '2026-T4');
  assert.equal(future.points, null); assert.equal(future.status, 'future'); assert.equal(future.missing, null);
  assert.equal(G.model(null, '2026-T3').status, 'missing');
  // Só a Cintia tem indicação apurada no T3 (Marcelo e Regina Stumpf), a 25 pontos cada.
  assert.deepEqual(rows.filter(r => r.snapshot.periods[1].referrals !== null).map(r => [r.memberName, r.snapshot.periods[1].referrals, r.snapshot.periods[1].referralUnitPoints]), [['Cintia Santini', 2, 25]]);
});
test('limiares da régua e dez graus são preservados', () => {
  assert.equal(G.status(19.9), 'starting'); assert.equal(G.status(20), 'progress');
  assert.equal(G.status(34.9), 'progress'); assert.equal(G.status(35), 'near');
  assert.equal(G.status(49.9), 'near'); assert.equal(G.status(50), 'ready');
  assert.equal(G.beltName(6), 'Faixa preta'); assert.equal(G.beltName(7), 'Coral vermelha e preta');
  assert.equal(G.beltName(8), 'Coral vermelha e branca'); assert.equal(G.beltName(9), 'Faixa vermelha');
  assert.equal(G.beltName(10), 'Faixa dourada');
});
