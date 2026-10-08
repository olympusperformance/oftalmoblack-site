-- One review row per consolidated obligation. Raw transcripts stay private.
create table public.fathom_actions (
 id uuid primary key default gen_random_uuid(),
 extraction_id uuid not null references memoria_operacional.extracoes(id),
 group_key text not null,
 titulo text not null check(length(titulo) between 1 and 350),
 reason text not null,
 disposition text not null check(disposition in ('pending','completed_in_call','in_call_instruction','external','suggestion','uncertain_action')),
 status text not null check(status in ('needs_identity','needs_confirmation','context','approved','linked')),
 staff_id uuid references public.staff(id),
 member_id uuid references public.members(id),
 demand_id uuid references public.demands(id),
 meeting_title text not null,
 occurred_at timestamptz not null,
 source_url text not null,
 record_indices jsonb not null,
 evidence jsonb not null,
 review_version text not null,
 created_at timestamptz not null default now(),
 approved_at timestamptz,
 decided_by uuid,
 history jsonb not null default '[]',
 unique(extraction_id,group_key),
 check(jsonb_typeof(record_indices)='array' and jsonb_array_length(record_indices)>0),
 check(jsonb_typeof(evidence)='array' and jsonb_array_length(evidence)>0),
 check((status in ('approved','linked')) = (demand_id is not null)),
 check(status not in ('approved','linked') or (staff_id is not null and disposition='pending'))
);
create index fathom_actions_queue_idx on public.fathom_actions(status,occurred_at desc);
create index fathom_actions_demand_idx on public.fathom_actions(demand_id);
create index fathom_actions_staff_idx on public.fathom_actions(staff_id);
create index fathom_actions_member_idx on public.fathom_actions(member_id);
alter table public.fathom_actions enable row level security;
create policy fathom_actions_admin_read on public.fathom_actions for select to authenticated using ((select public.is_admin()));
create policy fathom_actions_admin_update on public.fathom_actions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.fathom_actions from anon,authenticated;
grant select on public.fathom_actions to authenticated;
grant update(staff_id,member_id,status,demand_id,disposition) on public.fathom_actions to authenticated;

-- SECURITY INVOKER: approval uses the same administrator RLS as the board.
create function public.fathom_action_sync() returns trigger language plpgsql security invoker set search_path='' as $$
declare d public.demands; v_id uuid; v_description text;
begin
 if tg_op='UPDATE' and old.status in ('approved','linked') then
   raise exception 'Esta ação já foi vinculada ao quadro. Edite a demanda existente.';
 end if;
 if new.status in ('approved','linked') then
   if new.disposition<>'pending' or new.staff_id is null or not exists(select 1 from public.staff s where s.id=new.staff_id and s.ativo) then
     raise exception 'Aprovação exige pendência e integrante ativo.';
   end if;
   perform pg_advisory_xact_lock(726284871);
   if new.demand_id is not null then
     select * into d from public.demands where id=new.demand_id for update;
     if not found or d.member_id is distinct from new.member_id or not coalesce(new.staff_id=any(d.responsaveis),false) then
       raise exception 'Demanda equivalente incompatível com responsável ou mentorado.';
     end if;
     new.status='linked';
   else
     -- Exact retry/same-meeting match; semantic matches come from the review.
     select id into v_id from public.demands
      where member_id is not distinct from new.member_id and new.staff_id=any(responsaveis)
        and lower(trim(titulo))=lower(trim(new.titulo)) and origem='Fathom · '||new.source_url limit 1;
     if v_id is not null then new.demand_id=v_id;new.status='linked';
     else
       v_description=new.reason||E'\n\nReunião: '||new.meeting_title||E'\nFonte: '||new.source_url||E'\n\nEvidências:\n'||
         (select string_agg(coalesce(e->>'speaker_name','Falante')||': “'||(e->>'quote')||'”',E'\n') from jsonb_array_elements(new.evidence)e);
       insert into public.demands(titulo,descricao,responsaveis,member_id,origem,status)
        values(new.titulo,v_description,array[new.staff_id],new.member_id,'Fathom · '||new.source_url,'A fazer') returning id into new.demand_id;
       new.status='approved';
     end if;
   end if;
   new.approved_at=now();new.decided_by=auth.uid();
 else
   if new.demand_id is not null then raise exception 'Contexto/pendência de identificação não pode conter demanda.';end if;
   new.staff_id=null;
 end if;
 new.history=coalesce(case when tg_op='UPDATE' then old.history else '[]'::jsonb end,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',now(),'by',auth.uid(),'status',new.status,'staff_id',new.staff_id,'member_id',new.member_id,'demand_id',new.demand_id));
 return new;
end $$;
revoke all on function public.fathom_action_sync() from public,anon,authenticated;
create trigger fathom_action_sync before insert or update on public.fathom_actions for each row execute function public.fathom_action_sync();

create table memoria_operacional.demand_reviews (
 extraction_id uuid primary key references memoria_operacional.extracoes(id),
 status text not null default 'pending' check(status in ('pending','processing','completed','failed')),
 attempts integer not null default 0,
 reserved_at timestamptz,
 completed_at timestamptz,
 error text,
 original_document jsonb,
 result jsonb
);
alter table memoria_operacional.demand_reviews enable row level security;
revoke all on memoria_operacional.demand_reviews from public,anon,authenticated;

create function memoria_operacional.apply_demand_review(p_result jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare x memoria_operacional.extracoes; g jsonb; a public.fathom_actions; v_payload jsonb; expected integer[]; received integer[]; n integer; v_ids jsonb='[]';
begin
 perform pg_advisory_xact_lock(726284871);
 select * into x from memoria_operacional.extracoes where id=(p_result->>'extraction_id')::uuid for update;
 if not found then raise exception 'Extração inexistente';end if;
 if exists(select 1 from memoria_operacional.demand_reviews where extraction_id=x.id and status='completed') then
   return jsonb_build_object('already_applied',true,'extraction_id',x.id);
 end if;
 select payload into v_payload from memoria_operacional.eventos where id=x.event_id and status='completed';
 if v_payload is null or x.review_status='rejected' or md5(x.document::text)<>p_result->>'document_hash' or md5(v_payload::text)<>p_result->>'payload_hash' then raise exception 'Fonte alterada; revisar novamente';end if;
 if p_result->>'version'<>'whole-meeting-demands/1' then raise exception 'Versão inválida';end if;
 select coalesce(array_agg((ord-1)::integer order by ord),'{}') into expected
 from jsonb_array_elements(coalesce(x.document#>'{previous_extraction,document,records}',x.document->'records')) with ordinality as t(r,ord)
 where r->>'kind'='demand' or r#>>'{routing,original_kind}'='demand' or r#>>'{routing,status}'='needs_identity';
 select coalesce(array_agg(i::integer order by i::integer),'{}'),count(*) into received,n
 from jsonb_array_elements(p_result->'groups') grp(value) cross join lateral jsonb_array_elements_text(grp.value->'record_indices') i;
 if received is distinct from expected or n<>(p_result->>'target_count')::integer then raise exception 'Cobertura incompleta/duplicada';end if;
 for g in select value from jsonb_array_elements(p_result->'groups') loop
   if exists(select 1 from jsonb_array_elements(g->'evidence') e where
      nullif(e->>'quote','') is null or v_payload->'transcript'->((e->>'segment_id')::integer)->>'text' is null or
      position((e->>'quote') in (v_payload->'transcript'->((e->>'segment_id')::integer)->>'text'))=0) then raise exception 'Evidência inválida';end if;
   if g->>'existing_demand_id' is not null and not exists(select 1 from public.demands d where id=(g->>'existing_demand_id')::uuid and md5(to_jsonb(d)::text)=g->>'existing_hash') then raise exception 'Demanda equivalente mudou; revisar novamente';end if;
   insert into public.fathom_actions(extraction_id,group_key,titulo,reason,disposition,status,staff_id,member_id,demand_id,meeting_title,occurred_at,source_url,record_indices,evidence,review_version)
   values(x.id,g->>'group_key',g->>'title',g->>'reason',g->>'disposition',g->>'status',(g->>'staff_id')::uuid,(g->>'member_id')::uuid,(g->>'existing_demand_id')::uuid,p_result->>'meeting_title',(p_result->>'occurred_at')::timestamptz,p_result->>'source_url',g->'record_indices',g->'evidence',p_result->>'version') returning * into a;
   v_ids=v_ids||jsonb_build_array(jsonb_build_object('id',a.id,'status',a.status,'demand_id',a.demand_id));
 end loop;
 insert into memoria_operacional.demand_reviews(extraction_id,status,completed_at,original_document,result)
 values(x.id,'completed',now(),x.document,p_result)
 on conflict(extraction_id) do update set status='completed',completed_at=now(),error=null,original_document=excluded.original_document,result=excluded.result;
 update memoria_operacional.extracoes set document=jsonb_set(
   jsonb_set(document,'{records}',(select jsonb_agg(case when act.id is null then r else
     r||jsonb_build_object('kind',case when act.status in ('approved','linked') and (ord-1)=(select min(i::integer) from jsonb_array_elements_text(act.record_indices)i) then 'demand' else 'business_context' end,
       'routing',coalesce(r->'routing','{}')||jsonb_build_object('status',case when (ord-1)<>(select min(i::integer) from jsonb_array_elements_text(act.record_indices)i) then 'merged' else act.status end,'final_review_id',act.id,'demand_id',act.demand_id,'responsaveis',case when act.staff_id is not null then jsonb_build_array(act.staff_id) else '[]'::jsonb end,'eligible_for_demand',act.demand_id is not null,'review_status',case when act.demand_id is not null then 'approved' else 'pending' end)) end order by ord)
     from jsonb_array_elements(x.document->'records') with ordinality t(r,ord)
     left join public.fathom_actions act on act.extraction_id=x.id and act.record_indices @> jsonb_build_array(ord-1))),
   '{final_review}',jsonb_build_object('version',p_result->>'version','applied_at',now(),'target_count',n,'actions',v_ids)) where id=x.id;
 return jsonb_build_object('extraction_id',x.id,'actions',v_ids,'target_count',n);
end $$;
revoke all on function memoria_operacional.apply_demand_review(jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
