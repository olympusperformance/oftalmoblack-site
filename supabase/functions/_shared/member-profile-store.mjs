import {CATALOG,buildProfile,selectProfile} from './member-profile-model.mjs';
const uuid=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
async function pages(db,table,columns,memberId,order){
 const rows=[];let offset=0;
 while(true){
  let query=db.from(table).select(columns,{count:'exact'}).eq('member_id',memberId).order(order,{ascending:true});
  if(order!=='revision')query=query.order('id',{ascending:true});
  const r=await query.range(offset,offset+199);if(r.error)throw Error('Não foi possível ler as fontes do perfil.');
  if(!Array.isArray(r.data))throw Error('Resposta de fonte inválida.');rows.push(...r.data);offset+=r.data.length;
  if(!r.data.length||(typeof r.count==='number'&&offset>=r.count))return rows;
 }
}
export async function loadMemberProfile(db,memberId,sections){
 if(!uuid.test(memberId||''))throw Error('Mentorado inválido');
 const [member,catalog]=await Promise.all([db.from('members').select('id,nome,email,ativo,instagram,whatsapp_url,turma,fase,criado_em').eq('id',memberId).maybeSingle(),db.from('member_profile_catalog').select('schema_version,definition').eq('schema_version',CATALOG.schema_version).maybeSingle()]);
 if(member.error||catalog.error||!catalog.data)throw Error('O perfil padrão ainda não está disponível.');
 if(!member.data)return null;
 const a=Object.keys(CATALOG.fields).sort(),b=Object.keys(catalog.data.definition?.fields||{}).sort();
 if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Catálogo do perfil incompatível.');
 const [patches,sources,connections]=await Promise.all([
  pages(db,'member_profile_patches','member_id,schema_version,revision,patch,mode,reason,created_at,created_by',memberId,'revision'),
  pages(db,'member_context_entries','id,member_id,source_type,source_ref,source_at,source_precision,recorded_at,version,data',memberId,'recorded_at'),
  Promise.resolve(db.rpc('member_profile_connections',{p_member_id:memberId})).catch(()=>({error:true}))
 ]);
 if(patches.some(p=>p.schema_version!==CATALOG.schema_version))throw Error('Atualização do perfil incompatível.');
 return selectProfile(buildProfile(member.data,patches,sources,connections.error?null:connections.data),sections);
}
