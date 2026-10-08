with input as materialized (
 select * from jsonb_to_recordset($1::jsonb) as i(id uuid,document_hash text,payload_hash text,document jsonb)
), locked as materialized (
 select x.id,x.document,x.processing_version,x.review_status,e.payload,e.status as event_status
 from memoria_operacional.extracoes x join input i on i.id=x.id
 join memoria_operacional.eventos e on e.id=x.event_id
 where x.id=any($3::uuid[])
 for update of x
), eligible as materialized (
 select l.id from locked l join input i on i.id=l.id
 where l.review_status='pending' and l.event_status='completed'
 and md5(l.document::text)=i.document_hash and md5(l.payload::text)=i.payload_hash
 and not (l.document ? 'backfill')
 and i.document#>>'{backfill,version}'='existing-demands-ownership/1'
 and i.document#>>'{processing,identity_version}'='participants-and-ownership/1'
 and i.document->'source'=l.document->'source'
 and jsonb_array_length(i.document->'records')=jsonb_array_length(l.document->'records')
 and not exists(select 1 from jsonb_array_elements(i.document->'records') r where r->>'kind'='demand'
   and (r#>>'{routing,eligible_for_demand}' is distinct from 'true'
     or r#>>'{routing,review_status}' is distinct from 'pending'
     or r#>>'{ownership,identity_uncertain}' is distinct from 'false'
     or jsonb_array_length(r#>'{routing,responsaveis}')<>1
     or not exists(select 1 from public.staff s where s.id=(r#>>'{routing,responsaveis,0}')::uuid and s.ativo)))
), gate as (
 select (select count(*) from input)=5
 and (select count(distinct id) from input)=5
 and (select count(*) from eligible)=5
 and not exists(select 1 from memoria_operacional.atas_reunioes a where a.extraction_id=any($3::uuid[]) and a.status='processing') as ok
), changed as (
 update memoria_operacional.extracoes x set document=i.document || jsonb_build_object(
   'backfill',(i.document->'backfill') || jsonb_build_object('applied_at',now(),'batch_id',$4::text),
   'previous_extraction',jsonb_build_object('archived_at',now(),'document',l.document,'processing_version',l.processing_version))
 from input i join locked l on l.id=i.id
 where x.id=i.id and (select ok from gate) and $2::boolean
 returning x.id
)
select jsonb_build_object('eligible',(select count(*) from eligible),'all_checks_passed',(select ok from gate),
 'applied_count',(select count(*) from changed),'applied_ids',(select jsonb_agg(id) from changed)) as result;
