-- Banco de teste local: agrupadores, vínculos, arquivo reversível e RLS.
begin;
do $$begin
 if (select count(*) from public.cb_method_stages where kind='step')<>12 then raise exception 'Quantidade de degraus incorreta'; end if;
 if not exists(select 1 from public.cb_method_stages where id='TREINO' and kind='transversal') then raise exception 'Treino ausente'; end if;
 if exists(select 1 from public.cb_stage_deliveries d join public.artifacts a on a.id=d.artifact_id where a.archived_at is not null) then raise exception 'Arquivado aparece como entrega'; end if;
 if exists(select 1 from public.cb_checklist_catalog c left join public.cb_method_stages s on s.id=c.method_step where s.id is null) then raise exception 'Checklist órfão'; end if;
end$$;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000001','admin@example.test'),
 ('00000000-0000-0000-0000-000000000002','a@example.test'),
 ('00000000-0000-0000-0000-000000000003','b@example.test');
insert into public.app_admins(user_id) values('00000000-0000-0000-0000-000000000001');
insert into public.members(id,user_id,nome,email) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Mestre A','a@example.test'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','Mestre B','b@example.test');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
insert into public.artifacts(id,nome,method_steps,member_id,somente_equipe) values
 ('30000000-0000-0000-0000-000000000001','Entrega compartilhada QA',array['D04','D09','D10','TREINO'],null,false),
 ('30000000-0000-0000-0000-000000000002','Entrega exclusiva QA',array['D05'],'10000000-0000-0000-0000-000000000002',false),
 ('30000000-0000-0000-0000-000000000003','Entrega interna QA',array['D03'],null,true);
insert into public.artifact_steps(id,artifact_id,titulo,ordem) values('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Etapa preservada',1);
insert into public.step_progress(member_id,step_id,feito) values('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',true);
do $$begin
 if (select count(*) from public.cb_stage_deliveries where artifact_id='30000000-0000-0000-0000-000000000001')<>4 then raise exception 'Vínculos não reutilizam entrega'; end if;
end$$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$begin
 if exists(select 1 from public.cb_stage_deliveries where artifact_id in ('30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003')) then raise exception 'View vazou entrega de outro membro ou interna'; end if;
 if (select count(*) from public.cb_stage_deliveries where artifact_id='30000000-0000-0000-0000-000000000001')<>4 then raise exception 'Membro perdeu entrega compartilhada'; end if;
 begin insert into public.cb_method_stages values('D99','Indevido',null,99,'step'); raise exception 'MEMBER_WROTE_STAGE'; exception when insufficient_privilege then null; end;
end$$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
update public.artifacts set archived_at=now(),archive_reason='QA' where id='30000000-0000-0000-0000-000000000001';
do $$begin
 if exists(select 1 from public.cb_stage_deliveries where artifact_id='30000000-0000-0000-0000-000000000001') then raise exception 'Arquivo não retirou vínculo ativo'; end if;
 if not exists(select 1 from public.step_progress where step_id='40000000-0000-0000-0000-000000000001' and feito) then raise exception 'Progresso perdido'; end if;
end$$;
update public.artifacts set archived_at=null,archive_reason=null where id='30000000-0000-0000-0000-000000000001';
do $$begin
 if (select count(*) from public.cb_stage_deliveries where artifact_id='30000000-0000-0000-0000-000000000001')<>4 then raise exception 'Arquivo não é reversível'; end if;
end$$;
set local role anon;
do $$begin
 begin perform * from public.cb_stage_deliveries; raise exception 'ANON_READ'; exception when insufficient_privilege then null; end;
end$$;
rollback;
