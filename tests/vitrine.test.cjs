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
test('resultado lista quem ganha o quê e quem ficou sem data',()=>{
 globalThis.Club={esc:s=>String(s)};
 const round={period:'2026-T3',status:'distributing',opens_on:'2026-10-01',responses_closed_at:'2026-10-09T01:00:00Z',offers:[{benefit:'catarata',label:'Dezembro',dates:'2 a 6/12/2026',available:2},{benefit:'passagem',label:'Family Circle',available:1}],results:[{member_id:'a',name:'Mestre A',benefit:'catarata',offer:'Dezembro'},{member_id:'b',name:'Mestre B',benefit:'catarata'}]};
 const prefs=[{id:'p1',member_id:'a',period:'2026-T3',response_status:'received',benefits:['catarata'],pending_items:[],quarter_vouchers:0,conferred_grade:0,period_points:10},{id:'p2',member_id:'c',period:'2026-T3',response_status:'received',benefits:['passagem'],pending_items:[],quarter_vouchers:0,conferred_grade:0,period_points:1}];
 const html=V.render({rounds:[round],preferences:prefs,period:'2026-T3',member:{id:'a',nome:'Mestre A'},members:[{id:'a',nome:'Mestre A'},{id:'c',nome:'Mestre C'}],admin:true});
 assert.match(html,/<h2>Resultado<\/h2>/);
 assert.match(html,/Respostas encerradas em 09\/10\/2026/);
 assert.match(html,/Data a confirmar[\s\S]*Mestre B/);
 assert.match(html,/Sem ganhador/);
 assert.match(html,/Resultado: <b>Catarata · Dezembro<\/b>/);
 assert.match(html,/Sem benefício nesta rodada/);
 assert.equal(V.awardText(undefined),'Sem benefício nesta rodada');
});
