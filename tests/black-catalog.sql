-- Somente banco descartável com todas as migrações aplicadas.
begin;
do $$begin
 if (select count(*) from cb_deliveries)<>44 then raise exception '44 entregas esperadas'; end if;
 if (select count(*) from cb_checklist_catalog where delivery_id is not null)<>90 then raise exception 'Checklist incompleto'; end if;
 if exists(select 1 from cb_deliveries d left join cb_checklist_catalog c on c.delivery_id=d.id where c.id is null) then raise exception 'Entrega sem checklist'; end if;
 begin
  update cb_checklist_catalog set delivery_id='D07/bonus' where id='D05-01';
  raise exception 'Aceitou checklist em outro degrau';
 exception when foreign_key_violation then null; end;
end$$;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000001','admin@example.test'),
 ('00000000-0000-0000-0000-000000000002','a@example.test'),
 ('00000000-0000-0000-0000-000000000003','b@example.test');
insert into app_admins(user_id) values('00000000-0000-0000-0000-000000000001');
insert into members(id,user_id,nome,email) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Mestre A','a@example.test'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','Mestre B','b@example.test');
insert into artifacts(id,nome,method_steps,member_id,somente_equipe) values
 ('30000000-0000-0000-0000-000000000001','Processo compartilhado',array['D04','D09','D10','TREINO'],null,false),
 ('30000000-0000-0000-0000-000000000002','Exclusivo B',array['D05'],'10000000-0000-0000-0000-000000000002',false),
 ('30000000-0000-0000-0000-000000000003','Privado',array['D03'],null,true);
insert into cb_delivery_artifacts(delivery_id,stage_id,artifact_id) values
 ('D04/formacao','D04','30000000-0000-0000-0000-000000000001'),
 ('D09/preparo','D09','30000000-0000-0000-0000-000000000001'),
 ('D10/consulta','D10','30000000-0000-0000-0000-000000000001'),
 ('TREINO/vendas','TREINO','30000000-0000-0000-0000-000000000001'),
 ('D05/site','D05','30000000-0000-0000-0000-000000000002'),
 ('D03/rastreio','D03','30000000-0000-0000-0000-000000000003');
insert into artifact_steps(id,artifact_id,titulo,ordem) values
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Etapa histórica',1);
insert into step_progress(member_id,step_id,feito) values
 ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',true);
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$begin
 if (select count(*) from cb_deliveries)<>44 then raise exception 'Membro sem catálogo'; end if;
 if exists(select 1 from cb_delivery_artifacts where artifact_id in ('30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003')) then raise exception 'Vazou vínculo privado'; end if;
 if (select count(*) from cb_delivery_artifacts where artifact_id='30000000-0000-0000-0000-000000000001')<>4 then raise exception 'Processo compartilhado perdido'; end if;
 begin update cb_deliveries set name='Indevido'; raise exception 'Membro alterou catálogo'; exception when insufficient_privilege then null; end;
end$$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
update artifacts set nome='Novo nome',method_steps=array['D04'] where id='30000000-0000-0000-0000-000000000001';
do $$begin
 if (select count(*) from cb_delivery_artifacts where artifact_id='30000000-0000-0000-0000-000000000001')<>1 then raise exception 'Vínculo removido ainda visível'; end if;
 if (select count(*) from step_progress where step_id='40000000-0000-0000-0000-000000000001' and feito)<>1 then raise exception 'Histórico alterado'; end if;
end$$;
set local role anon;
do $$begin
 begin perform * from cb_deliveries; raise exception 'Anônimo leu catálogo'; exception when insufficient_privilege then null; end;
 begin perform * from cb_delivery_artifacts; raise exception 'Anônimo leu vínculos'; exception when insufficient_privilege then null; end;
end$$;
rollback;
