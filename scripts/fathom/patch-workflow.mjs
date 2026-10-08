import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export const CATALOG_SQL = `select jsonb_build_object(
 'staff',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.nome,'active',s.ativo,'email',u.email,'aliases','[]'::jsonb)) from public.staff s left join auth.users u on u.id=s.user_id where s.ativo),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.nome,'active',m.ativo,'email',m.email,'aliases',coalesce((select jsonb_agg(a.alias) from memoria_operacional.mentorado_aliases a where a.mentorado_id=m.id),'[]'::jsonb))) from public.members m where m.ativo),'[]'::jsonb)
) as catalog;`;

export function bundledCore() {
  const identities = readFileSync(new URL('./identities.mjs', import.meta.url), 'utf8').replace(/^export /gm, '');
  const core = readFileSync(new URL('./extraction-core.mjs', import.meta.url), 'utf8')
    .replace(/^import .*;\n/m, '').replace(/^export .*;\n/gm, '');
  return identities + '\n' + core;
}
export function patchWorkflow(original, postgresCredentials) {
  const w = structuredClone(original);
  const get = name => { const n = w.nodes.find(n => n.name === name); if (!n) throw Error('missing_node: ' + name); return n; };
  if (w.nodes.some(n => n.name === 'Identificar cadastros')) throw Error('already_patched');
  get('Configuração1').parameters.jsCode = "const p=$('Reservar evento').first().json.payload;return [{json:{recording_id:p.recording_id,source_url:p.url,scope_id:'memoria-operacional',execute_ai:true}}];";
  const core = bundledCore();
  get('Planejar reunião completa1').parameters.jsCode = core + `
const config=$('Configuração1').first().json;
const p=$('Reservar evento').first().json.payload;
const catalog=$('Identificar cadastros').first().json.catalog;
const session=sessionFromFathom(p,{transcript:p.transcript},config,catalog);
return [{json:planSession(session,{model:'gpt-6.1-sol',maxRecords:24,maxOutputTokens:5000})}];`;
  get('Consolidar e validar1').parameters.jsCode = core + `
const responses=$input.all().map((item,index)=>({chunk_index:$('Liberar blocos1').itemMatching(index).json.chunk_index,response:item.json}));
return [{json:consolidateSession($('Planejar reunião completa1').first().json,responses)}];`;
  w.nodes.push({ id: randomUUID(), name: 'Identificar cadastros', type: 'n8n-nodes-base.postgres', typeVersion: 2.6,
    position: [640, 0], credentials: postgresCredentials, onError: 'continueErrorOutput',
    parameters: { operation: 'executeQuery', query: CATALOG_SQL, options: {} } });
  const to = name => ({node:name,type:'main',index:0});
  w.connections['Existe evento?'] = { main: [[to('Identificar cadastros')]] };
  w.connections['Identificar cadastros'] = { main: [[to('Configuração1')],[to('Registrar falha')]] };
  return w;
}
