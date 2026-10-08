import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {CATALOG_SQL} from './patch-workflow.mjs';
export function reviewBundle(){return readFileSync(new URL('./identities.mjs',import.meta.url),'utf8').replace(/^export /gm,'')+'\n'+readFileSync(new URL('./final-review.mjs',import.meta.url),'utf8').replace(/^import .*;\n/m,'').replace(/^export /gm,'');}
export const RESERVE_REVIEW_SQL=`with gate as materialized (select pg_try_advisory_xact_lock(726284871) as acquired),
candidate as (
 select x.id from memoria_operacional.extracoes x
 join memoria_operacional.eventos e on e.id=x.event_id
 left join memoria_operacional.demand_reviews r on r.extraction_id=x.id
 where (select acquired from gate) and e.status='completed' and x.review_status<>'rejected'
 and (x.document#>>'{processing,identity_version}'='participants-and-ownership/1' or x.document#>>'{backfill,batch_id}'='4add78af-5746-4d7b-a089-4d931f210619')
 and (r.extraction_id is null or (r.attempts<3 and (r.status='pending' or r.status in ('processing','failed') and r.reserved_at<now()-interval '30 minutes')))
 and not exists(select 1 from memoria_operacional.demand_reviews busy where busy.status='processing' and busy.reserved_at>now()-interval '30 minutes')
 order by x.created_at for update of x skip locked limit 1
), claim as (
 insert into memoria_operacional.demand_reviews(extraction_id,status,reserved_at,attempts)
 select id,'processing',now(),1 from candidate
 on conflict(extraction_id) do update set status='processing',reserved_at=now(),attempts=demand_reviews.attempts+1,error=null
 returning extraction_id
)
select jsonb_build_object('id',x.id,'document',x.document,'document_hash',md5(x.document::text),'payload',e.payload,'payload_hash',md5(e.payload::text)) as snapshot,
 (select catalog from (${CATALOG_SQL.replace(/;\s*$/,'')}) c) as catalog,
 (select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('document_hash',md5(to_jsonb(d)::text))),'[]') from public.demands d) as demands
from claim c join memoria_operacional.extracoes x on x.id=c.extraction_id join memoria_operacional.eventos e on e.id=x.event_id;`;

export function makeReviewWorkflow(sourceWorkflow){
 const credentials=sourceWorkflow.nodes.find(n=>n.name==='Identificar cadastros').credentials;
 const code=(name,jsCode)=>({id:randomUUID(),name,type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{jsCode},onError:'continueErrorOutput'});
 const pg=(name,query,queryReplacement)=>({id:randomUUID(),name,type:'n8n-nodes-base.postgres',typeVersion:2.6,position:[0,0],credentials,parameters:{operation:'executeQuery',query,options:queryReplacement?{queryReplacement}:{}},onError:'continueErrorOutput'});
 const bundle=reviewBundle(),ai=structuredClone(sourceWorkflow.nodes.find(n=>n.name==='Extrair blocos OpenAI1'));
 ai.id=randomUUID();ai.name='Revisar reunião inteira';ai.onError='continueErrorOutput';ai.parameters.options.timeout=600000;
 const nodes=[{id:randomUUID(),name:'A cada minuto',type:'n8n-nodes-base.scheduleTrigger',typeVersion:1.2,position:[0,0],parameters:{rule:{interval:[{field:'minutes',minutesInterval:1}]}}},
 {id:randomUUID(),name:'Iniciar manualmente',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,180],parameters:{}},
 pg('Reservar revisão',RESERVE_REVIEW_SQL),code('Planejar revisão',bundle+'\nreturn [{json:planFinalReview($json.snapshot,$json.catalog,$json.demands)}];'),ai,
 code('Validar revisão',bundle+"\nreturn [{json:finishFinalReview($('Planejar revisão').first().json,$json)}];"),
 pg('Aprovar e vincular','select memoria_operacional.apply_demand_review($1::jsonb) as result;','={{ [JSON.stringify($json)] }}'),
 pg('Registrar falha da revisão',"update memoria_operacional.demand_reviews set status='failed',error=$2 where extraction_id=$1::uuid and status='processing' returning extraction_id,status;","={{ [$('Reservar revisão').first().json.snapshot.id, String($json.error?.message || $json.message || 'Falha na revisão').slice(0,1000)] }}")];
 nodes.forEach((n,i)=>{n.position=[i*220,0];});
 delete nodes.find(n=>n.name==='Reservar revisão').onError;delete nodes.find(n=>n.name==='Registrar falha da revisão').onError;
 const to=node=>({node,type:'main',index:0}),connections={};
 for(const name of ['A cada minuto','Iniciar manualmente'])connections[name]={main:[[to('Reservar revisão')]]};
 const flow=['Reservar revisão','Planejar revisão','Revisar reunião inteira','Validar revisão','Aprovar e vincular'];
 for(let i=0;i<flow.length-1;i++)connections[flow[i]]={main:[[to(flow[i+1])],...(i?[ [to('Registrar falha da revisão')]]:[])]};
 connections['Aprovar e vincular']={main:[[],[to('Registrar falha da revisão')]]};
 return {name:'Fathom → Cérebro Black — demandas automáticas',nodes,connections,settings:{executionOrder:'v1',executionTimeout:900,saveDataErrorExecution:'none',saveDataSuccessExecution:'none',saveManualExecutions:false}};
}
