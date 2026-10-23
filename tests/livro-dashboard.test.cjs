const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../public/assets/club-livro-model.js');
const traffic={source:'ga4',last_success_at:'2026-10-22T22:00:00Z',payload:{start_date:'2026-10-19',end_date:'2026-10-22',time_zone:'America/Manaus',rows:[{date:'2026-10-22',key:'post:123456',media_id:'123456',views:8,checkout_clicks:3},{date:'2026-10-21',key:'unattributed',views:2,checkout_clicks:0}]}};
const sales={source:'greenn',last_success_at:'2026-10-22T22:00:00Z',payload:{start_date:'2026-10-19',end_date:'2026-10-22',rows:[{date:'2026-10-22',key:'post:123456',media_id:'123456',paid_sales:1,revenue_cents:105000,attributed_sales:1},{date:'2026-10-22',key:'unattributed',paid_sales:2,revenue_cents:105000,attributed_sales:0}]}};
test('story appears separately from feed with its own identity and attribution',()=>{
 const r=M.report([{...sales,payload:{rows:[{date:'2026-10-22',key:'story:123456',story_id:'123456',paid_sales:1,revenue_cents:105000}]}}],[],'2026-10-22','2026-10-22');
 assert.equal(r.attributed,1);assert.equal(r.rows[0].story_id,'123456');assert.equal(r.rows[0].title,'Story do Instagram · 123456');
 assert.equal(r.rows[0].permalink,null);
});
test('report joins sources by publication, applies dates and distinguishes untracked sales',()=>{
 const r=M.report([traffic,sales],[], '2026-10-22','2026-10-22');
 assert.equal(r.totals.views,8); assert.equal(r.totals.paid_sales,3);assert.equal(r.totals.revenue_cents,210000);assert.equal(r.attributed,1);assert.equal(r.rows.length,2);
 assert.equal(r.rows.find(x=>x.key==='unattributed').views,0);
});
test('missing source is unknown, failed source retains last known data',()=>{
 const r=M.report([{...traffic,error:'ga4_http_503'}],[],'2026-10-19','2026-10-22');
 assert.equal(r.totals.views,10); assert.equal(r.totals.paid_sales,null);assert.equal(r.sources.ga4.error,'ga4_http_503');assert.equal(r.rows[0].paid_sales,null);
 assert.equal(M.report([{source:'ga4',payload:{rows:[]}}],[],'2026-10-19','2026-10-22').totals.views,null);
});
test('CSV handles BOM, semicolon, quoted newline and sends only origin metadata',()=>{
 const r=M.parseCSV('\uFEFFID da venda;Produto ID;UTM Source;UTM Medium;UTM Campaign;UTM Content;Nome\r\n42;199893;ig;social;livro-presbiopia;direct-post-123456;"Pessoa\nPrivada"');
 assert.equal(r.errors.length,0);assert.equal(r.records.length,1);assert.equal(r.records[0].sale_id,42);assert.equal(r.records[0].utm_content,'direct-post-123456');assert.equal(r.records[0].origin_mode,'greenn_csv');assert.ok(!JSON.stringify(r.records).includes('Privada'));
});
test('CSV rejects ambiguous duplicates, unsupported products and missing ID/UTM columns',()=>{
 assert.throws(()=>M.parseCSV('Nome,Email\nAlguém,email@example.com'),/colunas/i);
 const r=M.parseCSV('sale_id,product_id,utm_source,utm_content\n42,199893,ig,direct-post-123456\n42,199893,ig,direct-post-123457\n43,123,ig,direct-post-123456\n44,199893,ig,bad@email.com');
 assert.equal(r.records.length,0);assert.equal(r.errors.length,3);
});
test('CSV ignores rows without origin and deduplicates identical rows',()=>{
 const r=M.parseCSV('sale_id,utm_source,utm_content\n42,ig,direct-post-123456\n42,ig,direct-post-123456\n43,,');
 assert.equal(r.records.length,1);assert.equal(r.skipped,2);
});
test('CSV canonicalizes equivalent sale IDs before conflict detection',()=>{
 const bad=M.parseCSV('sale_id,utm_source,utm_content\n42,ig,direct-post-123456\n042,ig,direct-post-123457');
 assert.equal(bad.records.length,0);assert.equal(bad.errors.length,1);
 const same=M.parseCSV('sale_id,utm_source,utm_content\n42,ig,direct-post-123456\n042,ig,direct-post-123456');
 assert.equal(same.records.length,1);assert.equal(same.skipped,1);
});
test('invalid dates fail; publication links and CSV formulas are guarded',()=>{
 assert.throws(()=>M.report([],[],'2026-10-23','2026-10-22'),/período/i);
 assert.equal(M.permalink('javascript:alert(1)'),null);
 assert.equal(M.permalink('https://www.instagram.com/reel/Ab_1-/'),'https://www.instagram.com/reel/Ab_1-/');
 assert.ok(M.exportCSV([{title:'=IMPORTXML("x")',views:1,checkout_clicks:0,paid_sales:null,revenue_cents:null}]).includes("'=IMPORTXML"));
});
