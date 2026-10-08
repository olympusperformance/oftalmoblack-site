const {test}=require('node:test');
const assert=require('node:assert/strict');
const V=require('../public/assets/club-vitrine.js');
test('Vitrine escolhe a rodada em distribuição, independente da graduação no T4',()=>{
 const rounds=[{period:'2026-T3',status:'distributing'},{period:'2026-T4',status:'scheduled'}];
 assert.equal(V.choosePeriod(rounds,undefined),'2026-T3');
 assert.equal(V.choosePeriod(rounds,'2026-T4'),'2026-T4');
 assert.equal(V.choosePeriod([],undefined),undefined);
});
test('ranking usa pontos do trimestre e direitos daquela rodada, nunca anual',()=>{
 const rows=[{id:'annual',quarter_vouchers:0,conferred_grade:5,period_points:3.3,annualPoints:999},{id:'quarter',quarter_vouchers:0,conferred_grade:0,period_points:13.7,annualPoints:13.7},{id:'voucher',quarter_vouchers:1,conferred_grade:0,period_points:1}];
 assert.deepEqual(rows.sort(V.compare).map(r=>r.id),['voucher','quarter','annual']);
});
