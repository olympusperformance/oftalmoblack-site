-- Integration test on the target schema; all changes roll back.
begin;
do $$
declare x uuid; s uuid; a public.fathom_actions; b public.fathom_actions; n bigint;
begin
 select id into x from memoria_operacional.extracoes limit 1;
 select id into s from public.staff where ativo limit 1;
 select count(*) into n from public.demands;
 insert into public.fathom_actions(extraction_id,group_key,titulo,reason,disposition,status,meeting_title,occurred_at,source_url,record_indices,evidence,review_version)
 values(x,'test-pending','Teste atribuição Fathom','teste','pending','needs_identity','Teste',now(),'https://fathom.video/calls/0','[0]','[{"quote":"teste","speaker_name":"Teste"}]','test') returning * into a;
 if (select count(*) from public.demands)<>n then raise exception 'Unknown owner created demand';end if;
 update public.fathom_actions set staff_id=s,status='approved' where id=a.id returning * into a;
 if a.demand_id is null or (select count(*) from public.demands)<>n+1 then raise exception 'Assignment did not create one demand';end if;
 insert into public.fathom_actions(extraction_id,group_key,titulo,reason,disposition,status,staff_id,meeting_title,occurred_at,source_url,record_indices,evidence,review_version)
 values(x,'test-equivalent',a.titulo,'teste','pending','approved',s,'Teste',now(),'https://fathom.video/calls/0','[1]','[{"quote":"teste"}]','test') returning * into b;
 if b.demand_id<>a.demand_id or b.status<>'linked' or (select count(*) from public.demands)<>n+1 then raise exception 'Equivalent duplicated';end if;
 begin
   update public.fathom_actions set status='approved' where id=a.id;
   raise exception 'unexpected_approved_update';
 exception when raise_exception then if sqlerrm='unexpected_approved_update' then raise;end if;
 end;
 insert into public.fathom_actions(extraction_id,group_key,titulo,reason,disposition,status,meeting_title,occurred_at,source_url,record_indices,evidence,review_version)
 values(x,'test-external','Clínica','teste','external','context','Teste',now(),'https://fathom.video/calls/0','[2]','[{"quote":"teste"}]','test') returning * into b;
 if b.demand_id is not null then raise exception 'Clinic action became demand';end if;
end $$;
-- Anonymous and ordinary authenticated accounts cannot see review evidence.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
do $$ begin
 if exists(select 1 from public.fathom_actions) then raise exception 'Non-admin can read actions';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='memoria_operacional' and p.proname='apply_demand_review' and has_function_privilege(current_user,p.oid,'execute')) then raise exception 'Non-admin can apply worker review';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from public.app_admins limit 1),true);
set local role authenticated;
do $$ declare s uuid;n bigint;begin
 select id into s from public.staff where ativo limit 1;
 select count(*) into n from public.demands;
 update public.fathom_actions set status='approved',disposition='pending',staff_id=s where group_key='test-external';
 if (select count(*) from public.demands)<>n+1 then raise exception 'Admin approval failed';end if;
end $$;
reset role;
rollback;
