import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveParticipants, routeRecord } from '../scripts/fathom/identities.mjs';
import { sessionFromFathom, planSession, consolidateSession } from '../scripts/fathom/extraction-core.mjs';
import { bundledCore } from '../scripts/fathom/patch-workflow.mjs';
const catalog = { staff: [{id:'staff-a',name:'Ana Silva',email:'ana@team.test'}, {id:'staff-b',name:'Bruno Lima',email:'bruno@team.test'}],
  members:[{id:'member-a',name:'Carlos Souza',email:'carlos@clinic.test',aliases:['Carlos Souza']} ] };
const payload = {recording_id:'123',url:'https://fathom.video/calls/123',title:'Growth — Carlos Souza',recording_start_time:'2026-10-07T14:00:00Z',
  calendar_invitees:[{name:'Carlos Souza',email:'carlos@clinic.test',matched_speaker_display_name:'Carlos Souza'}],
  transcript:[{timestamp:'00:00:01',text:'Eu vou enviar o planejamento.',speaker:{display_name:'Ana Silva',matched_calendar_invitee_email:'ana@team.test'}}]};
const identity=()=>resolveParticipants(payload,catalog);
const record=(ownership={})=>({kind:'demand',statement:'Foi assumido o envio do planejamento.',subject:'não identificado',topic:'Planejamento',time_expression:null,uncertainty:null,
  evidence:[{segment_id:'0',quote:'Eu vou enviar o planejamento.',speaker:{name:'Ana Silva',email:'ana@team.test'}}],
  ownership:{identity_uncertain:false,executor_name:'Ana Silva',basis:'speaker',segment_id:'0',beneficiary_name:null,state:'agreed',...ownership}});

test('preserves invite vs speaker, resolves member and staff without inventing attendance',()=>{
 const i=identity();assert.equal(i.member_id,'member-a');
 assert.equal(i.participants.find(p=>p.staff_id)?.match,'exact_email');
 assert.equal(i.participants.find(p=>p.member_id)?.spoke,false);
});
test('shared account cannot inherit a staff identity, even with a matching email',()=>{
 const p=structuredClone(payload);p.transcript[0].speaker={display_name:'Club OftalmoBlack',matched_calendar_invitee_email:'ana@team.test'};
 const i=resolveParticipants(p,catalog);assert.equal(i.participants.find(p=>p.spoke).staff_id,null);
 const r=record({executor_name:'Club OftalmoBlack'});r.evidence[0].speaker={name:'Club OftalmoBlack',email:'ana@team.test'};
 assert.equal(routeRecord(r,i,catalog).routing.eligible_for_demand,false);
});
test('conflicting name/email and duplicate names stay unresolved',()=>{
 const p=structuredClone(payload);p.transcript[0].speaker.matched_calendar_invitee_email='bruno@team.test';
 assert.equal(resolveParticipants(p,catalog).participants.find(p=>p.spoke).match,'ambiguous');
 const c=structuredClone(catalog);c.staff.push({id:'other',name:'Ana Silva'});
 p.transcript[0].speaker.matched_calendar_invitee_email=null;
 assert.equal(resolveParticipants(p,c).participants.find(p=>p.spoke).staff_id,null);
});
test('internal commitment has suggested owner, linked member, and pending review',()=>{
 const r=routeRecord(record(),identity(),catalog);assert.equal(r.kind,'demand');
 assert.deepEqual(r.routing.responsaveis,['staff-a']);assert.equal(r.routing.member_id,'member-a');
 assert.equal(r.routing.review_status,'pending');
});
test('subject or speaker alone cannot assign the task to a mentioned colleague',()=>{
 const r=record({executor_name:'Bruno Lima',basis:'named'});r.subject='Bruno Lima';
 assert.equal(routeRecord(r,identity(),catalog).kind,'business_context');
 assert.equal(routeRecord(record({executor_name:null,basis:'unresolved',segment_id:null}),identity(),catalog).routing.status,'needs_identity');
});
test('mentee execution is context and carries no internal assignee',()=>{
 const p=structuredClone(payload);p.transcript[0].speaker={display_name:'Carlos Souza',matched_calendar_invitee_email:'carlos@clinic.test'};
 const r=record({executor_name:'Carlos Souza'});r.evidence[0].speaker={name:'Carlos Souza',email:'carlos@clinic.test'};
 const result=routeRecord(r,resolveParticipants(p,catalog),catalog);assert.equal(result.kind,'business_context');
 assert.equal(result.routing.reason,'mentee_action');assert.deepEqual(result.routing.responsaveis,[]);
});
test('completed actions and mere suggestions do not become pending demands',()=>{
 for(const state of ['performed','suggested'])assert.equal(routeRecord(record({state}),identity(),catalog).kind,'business_context');
});
test('external invitee remains external without inventing a mentee or internal owner',()=>{
 const p=structuredClone(payload);p.title='Treinamento comercial';
 p.calendar_invitees=[{name:'Eva Costa',email:'eva@clinic.test',is_external:true}];
 p.transcript[0].speaker={display_name:'Eva Costa',matched_calendar_invitee_email:'eva@clinic.test'};
 const i=resolveParticipants(p,catalog);assert.equal(i.member_id,null);assert.equal(i.participants[0].team,'external');
 const r=record({executor_name:'Eva Costa'});r.evidence[0].speaker={name:'Eva Costa',email:'eva@clinic.test'};
 assert.equal(routeRecord(r,i,catalog).routing.eligible_for_demand,false);
});
test('unresolved shared-account commitment remains visible for identity review even when model uses context',()=>{
 const r=record({executor_name:null,basis:'unresolved',segment_id:null});r.kind='business_context';
 assert.equal(routeRecord(r,identity(),catalog).routing.status,'needs_identity');
});
test('inactive staff are never assigned',()=>{
 const c=structuredClone(catalog);c.staff[0].active=false;
 assert.equal(routeRecord(record(),resolveParticipants(payload,c),c).routing.eligible_for_demand,false);
});
test('suspected diarization error blocks assignment even with an exact registry match',()=>{
 const r=routeRecord(record({identity_uncertain:true}),identity(),catalog);
 assert.equal(r.routing.status,'needs_identity');assert.deepEqual(r.routing.responsaveis,[]);assert.equal(r.kind,'business_context');
});
test('multiple mentees do not inherit an arbitrary beneficiary',()=>{
 const c=structuredClone(catalog);c.members.push({id:'member-b',name:'Daniel Dias',email:'daniel@clinic.test'});
 const p=structuredClone(payload);p.calendar_invitees.push({name:'Daniel Dias',email:'daniel@clinic.test'});
 assert.equal(resolveParticipants(p,c).member_id,null);
 assert.equal(routeRecord(record({beneficiary_name:'Daniel Dias'}),identity(),c).routing.member_id,null);
});
test('schema to consolidation preserves ownership and source emails; bad quotes are quarantined',()=>{
 const s=sessionFromFathom(payload,{transcript:payload.transcript},{recording_id:'123',source_url:payload.url,scope_id:'memoria-operacional'},catalog);
 const plan=planSession(s);assert.ok(!plan.requests[0].requestBody.input.includes('ana@team.test'));
 const r=record();r.evidence=r.evidence.map(({segment_id,quote})=>({segment_id,quote}));
 const bad=structuredClone(r);bad.evidence[0].quote='invented';
 const response={status:'completed',model:'gpt-6.1-sol',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({records:[r,bad]})}]}]};
 const doc=consolidateSession(plan,[{chunk_index:0,response}]);
 assert.equal(doc.records.length,1);assert.equal(doc.rejected_records.length,1);
 assert.equal(doc.records[0].evidence[0].speaker.email,'ana@team.test');assert.deepEqual(doc.records[0].routing.responsaveis,['staff-a']);
 assert.equal(doc.processing.identity_version,'participants-and-ownership/1');
});
test('n8n bundle runs without imports or node modules',()=>{
 const bundled=new Function(bundledCore()+'\nreturn { resolveParticipants, planSession };')();
 assert.deepEqual(bundled.resolveParticipants(payload,catalog),identity());
});
