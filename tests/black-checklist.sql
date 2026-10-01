-- Somente banco local descartável, com as migrações do Método aplicadas.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000001','admin@example.test'),
 ('00000000-0000-0000-0000-000000000002','a@example.test'),
 ('00000000-0000-0000-0000-000000000003','b@example.test');
insert into public.app_admins(user_id) values('00000000-0000-0000-0000-000000000001');
insert into public.staff(id,user_id,nome,ativo) values('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Equipe QA',true);
insert into public.members(id,user_id,nome,email) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Mestre A','a@example.test'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','Mestre B','b@example.test');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
insert into public.cb_checklist_progress(member_id,item_id,done,actor_name,updated_at)
 values('10000000-0000-0000-0000-000000000001','D04-01',true,'Autor forjado','2000-01-01');
do $$begin
 if (select count(*) from public.cb_checklist_catalog)<>90 then raise exception 'Catálogo incompleto'; end if;
 if not exists(select 1 from public.cb_checklist_progress where actor_name='Equipe QA' and updated_by=auth.uid() and updated_at>now()-interval '1 minute') then raise exception 'Carimbo não protegido'; end if;
 if not exists(select 1 from public.cb_audit_log where entity='cb_checklist_progress' and actor=auth.uid()) then raise exception 'Auditoria ausente'; end if;
 begin
  insert into public.cb_checklist_progress(member_id,item_id,done) values('10000000-0000-0000-0000-000000000001','D03-04',true);
  raise exception 'AUTO_MANUAL';
 exception when raise_exception then if sqlerrm='AUTO_MANUAL' then raise; end if; end;
 begin
  update public.cb_checklist_progress set member_id='10000000-0000-0000-0000-000000000002';
  raise exception 'MOVED_OWNER';
 exception when raise_exception then if sqlerrm='MOVED_OWNER' then raise; end if; end;
 begin
  insert into public.cb_checklist_progress(member_id,item_id,edition,done) values('10000000-0000-0000-0000-000000000001','D08-01','2026-10-01',true);
  raise exception 'MISSING_EDITION';
 exception when raise_exception then if sqlerrm='MISSING_EDITION' then raise; end if; end;
end$$;
insert into public.cb_encontros(member_id,period,edition,evidence) values
 ('10000000-0000-0000-0000-000000000001','2026-T4','2026-10-01','QA'),
 ('10000000-0000-0000-0000-000000000001','2026-T4','2026-11-01','QA');
insert into public.cb_checklist_progress(member_id,item_id,edition,done) values
 ('10000000-0000-0000-0000-000000000001','D08-01','2026-10-01',true),
 ('10000000-0000-0000-0000-000000000001','D08-01','2026-11-01',false)
 on conflict(member_id,item_id,edition) do update set done=excluded.done;
insert into public.cb_missions(member_id,period,method_step,checklist_item_id,title,weight,requested_on,due_on,status)
 values('10000000-0000-0000-0000-000000000001','2026-T4','D02','D02-06','Aprovar roteiro',0.5,'2026-10-01','2026-10-05','requested');
do $$begin
 if (select count(*) from public.cb_checklist_progress where item_id='D08-01')<>2 then raise exception 'Edições sobrescritas'; end if;
 if not (select publicized from public.cb_encontros where edition='2026-10-01') then raise exception 'Checklist não sincronizou rotina'; end if;
 if (select publicized from public.cb_encontros where edition='2026-11-01') then raise exception 'Conclusão vazou para outro mês'; end if;
 begin
  update public.cb_missions set weight=1 where checklist_item_id='D02-06';
  raise exception 'WRONG_WEIGHT';
 exception when raise_exception then if sqlerrm='WRONG_WEIGHT' then raise; end if; end;
end$$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$begin
 if (select count(*) from public.cb_checklist_progress)<>9 then raise exception 'Membro não lê seus itens'; end if;
 begin
  insert into public.cb_checklist_progress(member_id,item_id,done) values('10000000-0000-0000-0000-000000000001','D04-02',true);
  raise exception 'MEMBER_MARKED';
 exception when insufficient_privilege then null;
 when raise_exception then if sqlerrm='MEMBER_MARKED' then raise; end if; end;
end$$;
update public.cb_missions set status='submitted',evidence='Entrega para conferência' where checklist_item_id='D02-06';
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
do $$begin
 if exists(select 1 from public.cb_checklist_progress) then raise exception 'Vazamento entre membros'; end if;
end$$;
set local role anon;
do $$begin
 begin perform * from public.cb_checklist_progress; raise exception 'ANON_READ'; exception when insufficient_privilege then null; end;
end$$;
rollback;
