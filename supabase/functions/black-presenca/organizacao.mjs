// Somente equivalências já conferidas na operação de 22/10. Sem busca aproximada.
const aliases = new Map([
 ['Adriano Fonseca Yamada','Adriano Yamada'],
 ['Cintia Santini','Cintia de Oliveira Santini'],
 ['Helcio Valerio Passos Junior','Helcio Passos'],
 ['Marcelo Felipe Stumpf','Marcelo Stumpf'],
 ['Regina Kame Zukeram Stumpf','Regina Stumpf'],
].map(([a,b])=>[normal(a),normal(b)]));
const recordAliases = new Map([
 ['83922d51-676e-4e78-b5c2-14b2b98b4025','Gabriela Traiano'],
]);
export const ORG_SHEET='1FvGfqwKBjt2R8dmsRyAebcl1cuR-wfJcmDM6Iv6w-W4';
export const LIVE_SHEET=221026001;
export function normal(value){return String(value||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim().replace(/^(dra?|doutora?)\.?\s+/,'').trim().replace(/\s+/g,' ');}
function match(row,names){
 const keys=new Set([row.nome,row.member?.nome,recordAliases.get(row.id)].filter(Boolean).map(normal));
 for(const key of [...keys])if(aliases.has(key))keys.add(aliases.get(key));
 const found=names.map((r,i)=>keys.has(normal(r[0]))?i:-1).filter(i=>i>=2);
 return found.length===1?{index:found[0]}:{reason:found.length?'Conferir: nomes duplicados':'Conferir: nome não localizado'};
}
export function planOrganization(rows,{baseNames,baseChecks,legacyNames,legacyChecks}){
 if(normal(baseNames[1]?.[0])!=='nome completo'||baseChecks[1]?.join('|')!=='CHECK-IN 22/10|CHECK-IN 23/10|CHECK-IN 24/10'||normal(legacyChecks[1]?.[0])!=='presenca')throw new Error('org_headers_changed');
 const updates=new Map(),live=[];let matched=0,review=0;
 for(const row of rows){
  const day=['2026-10-22','2026-10-23','2026-10-24'].indexOf(row.dia_presenca);
  if(day<0)throw new Error('org_invalid_day');
  const hit=match(row,baseNames);let status=hit.reason;
  if(hit.index!=null){
   const current=baseChecks[hit.index]?.[day]??'';
   if(current===''||current==='X'){
    matched++;status=`Associado: ${baseNames[hit.index][0]}`;
    if(current==='')updates.set(`'BASE'!${['S','T','U'][day]}${hit.index+1}`,'X');
   }else status='Conferir: marcação existente preservada';
  }
  if(status.startsWith('Conferir:'))review++;
  const legacy=match(row,legacyNames);
  if(legacy.index!=null&&(legacyChecks[legacy.index]?.[0]??'')==='')updates.set(`'Participantes Out26'!J${legacy.index+1}`,'OK');
  const manual=row.utm?.utm_source==='operacao_manual';
  const date=row.dia_presenca.split('-').reverse().join('/');
  const time=manual?'Inclusão manual':new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium'}).format(new Date(row.created_at));
  live.push([date,row.nome||row.member?.nome||'Nome não informado',time,manual?'Manual':'Pelo formulário',status,row.id]);
 }
 return {data:[...updates].map(([range,value])=>({range,values:[[value]]})),live,matched,review};
}

export async function syncOrganization({readAttendance,google,token,now=new Date()}){
 const rows=await readAttendance();
 const meta=await google('?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))',token);
 const sizes={};
 for(const title of ['BASE','Participantes Out26','Presenças ao vivo']){
  const p=meta.sheets?.find(s=>s.properties.title===title)?.properties;
  if(!p||p.gridProperties.rowCount>10000)throw new Error('org_structure_changed');
  sizes[title]=p.gridProperties.rowCount;
  if(title==='Presenças ao vivo'&&p.sheetId!==LIVE_SHEET)throw new Error('org_structure_changed');
 }
 if(rows.length+4>sizes['Presenças ao vivo'])throw new Error('org_capacity');
 const ranges=[`'BASE'!B1:B${sizes.BASE}`,`'BASE'!S1:U${sizes.BASE}`,`'Participantes Out26'!B1:B${sizes['Participantes Out26']}`,`'Participantes Out26'!J1:J${sizes['Participantes Out26']}`,`'Presenças ao vivo'!A5:F${sizes['Presenças ao vivo']}`];
 const result=await google(`values:batchGet?valueRenderOption=FORMULA&${ranges.map(r=>`ranges=${encodeURIComponent(r)}`).join('&')}`,token);
 const [baseNames,baseChecks,legacyNames,legacyChecks,oldLive]=result.valueRanges.map(r=>r.values||[]);
 const plan=planOrganization(rows,{baseNames,baseChecks,legacyNames,legacyChecks});
 const live=plan.live.concat(Array.from({length:Math.max(0,oldLive.length-plan.live.length)},()=>['','','','','','']));
 const stamp=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium'}).format(now);
 const data=[...plan.data,{range:"'Presenças ao vivo'!A3",values:[[`${stamp}, horário de Brasília | ${rows.length} presenças | ${plan.review} para conferir`]]}];
 if(live.length)data.push({range:`'Presenças ao vivo'!A5:F${live.length+4}`,values:live});
 const ack=await google('values:batchUpdate',token,{valueInputOption:'RAW',data},'POST');
 if(!Array.isArray(ack.responses)||ack.responses.length!==data.length)throw new Error('org_ack');
 return {total:rows.length,matched:plan.matched,review:plan.review,marked:plan.data.length};
}
