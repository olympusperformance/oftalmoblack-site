import test from 'node:test';
import assert from 'node:assert/strict';
import {planOrganization,syncOrganization,LIVE_SHEET} from '../supabase/functions/black-presenca/organizacao.mjs';
const grids=()=>({baseNames:[[],['Nome completo'],['Ana Souza'],['Bruno Silva']],baseChecks:[[],['CHECK-IN 22/10','CHECK-IN 23/10','CHECK-IN 24/10']],legacyNames:[[],['Nome completo'],['Ana Souza']],legacyChecks:[[],['PRESENÇA']]});
const row=(nome='Ana Souza',day='2026-10-22')=>({id:'a',nome,dia_presenca:day,created_at:'2026-10-22T15:10:00Z',utm:{}});
test('marca cada dia na coluna correta, deduplica e preserva marcações manuais',()=>{
 const g=grids();g.baseChecks[2]=['X','',''];g.legacyChecks[2]=['OK'];
 const result=planOrganization([row(),row('Ana Souza','2026-10-23'),row('Ana Souza','2026-10-23'),row('Ana Souza','2026-10-24')],g);
 assert.deepEqual(result.data,[{range:"'BASE'!T3",values:[['X']]},{range:"'BASE'!U3",values:[['X']]}]);
 assert.equal(result.review,0);
});
test('busca pela identidade conferida após reordenar linhas, sem aproximação',()=>{
 const g=grids();g.baseNames=[[],['Nome completo'],['Bruno Silva'],['Hélcio Passos']];
 const result=planOrganization([row('  Dr. Hélcio Valério Passos Junior'),row('Bruno')],g);
 assert.deepEqual(result.data,[{range:"'BASE'!S4",values:[['X']]}]);
 assert.equal(result.review,1);assert.match(result.live[1][4],/não localizado/);
});
test('não adivinha entre duplicados, fórmulas ou marcações existentes',()=>{
 const g=grids();g.baseNames.push(['Ana Souza']);
 assert.equal(planOrganization([row()],g).data.filter(d=>d.range.startsWith("'BASE'")).length,0);
 g.baseNames.pop();g.baseChecks[2]=['=IF(TRUE,"","")'];g.legacyChecks[2]=['=1'];
 const r=planOrganization([row()],g);assert.equal(r.review,1);assert.deepEqual(r.data,[]);
 for(const value of [0,false]){g.legacyChecks[2]=[value];assert.deepEqual(planOrganization([row()],g).data,[]);}
});
test('associação abreviada de Gabriela vale só para o recibo já conferido',()=>{
 const g=grids();g.baseNames[2]=['Gabriela Traiano'];
 assert.equal(planOrganization([row('Gabriela')],g).review,1);
 assert.equal(planOrganization([{...row('Gabriela'),id:'83922d51-676e-4e78-b5c2-14b2b98b4025'}],g).review,0);
});
test('nome do cadastro e inclusão manual; RAW impede injeção de fórmula no registro',async()=>{
 const g=grids();let payload;
 const attendance=[{...row('=HYPERLINK("x")'),member:{nome:'Ana Souza'},utm:{utm_source:'operacao_manual'}}];
 const google=async(path,token,body)=>{
  if(path.startsWith('?'))return {sheets:['BASE','Participantes Out26','Presenças ao vivo'].map((title,i)=>({properties:{title,sheetId:i===2?LIVE_SHEET:i,gridProperties:{rowCount:1000}}}))};
  if(path.startsWith('values:batchGet'))return {valueRanges:[g.baseNames,g.baseChecks,g.legacyNames,g.legacyChecks,[]].map(values=>({values}))};
  payload=body;return {responses:body.data.map(()=>({updatedCells:1}))};
 };
 const result=await syncOrganization({readAttendance:async()=>attendance,google,token:'test',now:new Date('2026-10-22T15:15:00Z')});
 assert.equal(result.matched,1);assert.equal(payload.valueInputOption,'RAW');
 const live=payload.data.find(d=>d.range.includes('A5:')).values;
 assert.equal(live[0][1],attendance[0].nome);assert.equal(live[0][2],'Inclusão manual');
 assert.match(payload.data.find(d=>d.range.endsWith('A3')).values[0][0],/12:15:00/);
});
test('mudanças de cabeçalho e dias desconhecidos falham sem planejar escrita',()=>{
 const g=grids();g.baseChecks[1][0]='Dia 22/10';assert.throws(()=>planOrganization([row()],g),/headers/);
 assert.throws(()=>planOrganization([row('Ana Souza','2026-10-25')],grids()),/day/);
});
