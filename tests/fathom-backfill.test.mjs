import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planBackfill,finishBackfill} from '../scripts/fathom/backfill.mjs';
const catalog={staff:[{id:'staff',name:'Ana Silva',email:'ana@team.test'}],members:[{id:'member',name:'Carlos Souza',email:'carlos@clinic.test'}]};
const snapshot={id:'extraction',document_hash:'original',payload_hash:'source',
 payload:{title:'Carlos Souza',calendar_invitees:[{name:'Carlos Souza',email:'carlos@clinic.test'}],transcript:[
 {text:'Eu vou enviar o plano.',speaker:{display_name:'Ana Silva',matched_calendar_invitee_email:'ana@team.test'}},
 {text:'Eu vou gravar o vídeo.',speaker:{display_name:'Carlos Souza',matched_calendar_invitee_email:'carlos@clinic.test'}}]},
 document:{session:{title:'Carlos Souza'},processing:{},records:[
 {kind:'demand',statement:'Enviar plano',evidence:[{segment_id:'0',quote:'Eu vou enviar o plano.'}]},
 {kind:'demand',statement:'Gravar vídeo',evidence:[{segment_id:'1',quote:'Eu vou gravar o vídeo.'}]},
 {kind:'business_context',statement:'Contexto já registrado',evidence:[],custom_field:'preservar'}]}};
function reviews(){return snapshot.document.records.slice(0,2).map((r,i)=>({record_index:i,category:'demand',reason:'Ação assumida',evidence:r.evidence,
 ownership:{identity_uncertain:false,executor_name:i?'Carlos Souza':'Ana Silva',basis:'speaker',segment_id:String(i),beneficiary_name:null,state:'agreed'}}));}
function responses(r){return [{batch_index:0,response:{status:'completed',model:'gpt-6.1-sol',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reviews:r})}]}]}}];}
test('backfill changes only classification/ownership, preserves context and original evidence, and excludes external tasks',()=>{
 const before=structuredClone(snapshot);const out=finishBackfill(planBackfill(snapshot,catalog),responses(reviews()));
 assert.deepEqual(snapshot,before);assert.equal(out.document.records.length,3);
 assert.deepEqual(out.document.records[2],before.document.records[2]);
 for(let i=0;i<2;i++){assert.equal(out.document.records[i].statement,before.document.records[i].statement);assert.deepEqual(out.document.records[i].evidence,before.document.records[i].evidence);}
 assert.equal(out.document.records[0].kind,'demand');assert.deepEqual(out.document.records[0].routing.responsaveis,['staff']);
 assert.equal(out.document.records[1].kind,'business_context');assert.deepEqual(out.document.records[1].routing.responsaveis,[]);
 assert.equal(out.document.backfill.human_review,false);
});
test('no partial backfill on missing, duplicate, or fabricated reviews',()=>{
 const p=planBackfill(snapshot,catalog);
 assert.throws(()=>finishBackfill(p,responses(reviews().slice(0,1))),/missing_reviews/);
 assert.throws(()=>finishBackfill(p,responses([reviews()[0],reviews()[0]])),/wrong_record_index/);
 const r=reviews();r[0].evidence=[{segment_id:'0',quote:'texto inventado'}];
 assert.throws(()=>finishBackfill(p,responses(r)),/unverified_quote/);
});
test('suspected speaker mismatch and already performed actions do not remain internal demands',()=>{
 const r=reviews();r[0].ownership.identity_uncertain=true;
 const out=finishBackfill(planBackfill(snapshot,catalog),responses(r));
 assert.equal(out.document.records[0].routing.status,'needs_identity');assert.equal(out.document.records[0].kind,'business_context');
 r[0].ownership.identity_uncertain=false;r[0].ownership.state='performed';
 assert.equal(finishBackfill(planBackfill(snapshot,catalog),responses(r)).document.records[0].kind,'business_context');
});
test('repeat backfill requires an explicit new revision instead of silently processing again',()=>{
 const out=finishBackfill(planBackfill(snapshot,catalog),responses(reviews()));
 assert.throws(()=>planBackfill({...snapshot,document:out.document},catalog),/already_processed/);
});
