-- Execute após schema.sql, progresso.sql, graduacao.sql e a migração, no banco de teste.
begin;
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
insert into public.cb_quarters(member_id,period,attended,eligible,video_credits,weeks,followers_growth,orphan_leads,sla_recorded,outcomes_percent,cpv_percent,call_conversion,evidence)
values ('10000000-0000-0000-0000-000000000001','2026-T2',10,10,13,13,5000,0,true,95,15,60,'Teste auditável');
insert into public.cb_missions(id,member_id,period,method_step,title,weight,requested_on,due_on,status,evidence)
values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-T2','D04','Treinar equipe',1,'2026-04-01','2026-06-30','verified','Trilha conferida'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','2026-T2','D02','Aprovar roteiro',0.5,'2026-04-01','2026-06-30','requested',null),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','2026-T2','D06','Entregável do Club',0,'2026-04-01','2026-06-30','verified','Entregue'),
 ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','2026-T2','D06','Pedido de B',1,'2026-04-01','2026-06-30','requested',null);
insert into public.cb_encontros(member_id,period,edition,publicized,video_group,video_ads,attended,evidence)
values ('10000000-0000-0000-0000-000000000001','2026-T2','2026-05-01',true,true,true,true,'Confirmado');
update public.cb_missions set artifact_step_id=(select s.id from public.artifact_steps s join public.artifacts a on a.id=s.artifact_id where a.nome='Time Premium' order by s.ordem limit 1)
where id='20000000-0000-0000-0000-000000000001';
do $$begin
 if (select total from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001')<>55 then raise exception 'Placar incorreto: esperado 55'; end if;
 if not exists(select 1 from public.cb_audit_log where actor=auth.uid() and entity='cb_quarters') then raise exception 'Auditoria ausente'; end if;
 if not exists(select 1 from public.step_progress where member_id='10000000-0000-0000-0000-000000000001' and feito) then raise exception 'Missão não sincronizou checklist existente'; end if;
end$$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$begin
 if (select count(*) from public.cb_missions)<>3 then raise exception 'Vazamento entre membros'; end if;
 if exists(select 1 from public.cb_audit_log) then raise exception 'Log interno exposto'; end if;
 begin
  insert into public.cb_quarters(member_id,period,evidence) values('10000000-0000-0000-0000-000000000001','2026-T4','Fraude');
  raise exception 'MEMBER_WROTE_SCORE';
 exception when insufficient_privilege then null; end;
 begin
  update public.cb_missions set status='verified' where id='20000000-0000-0000-0000-000000000002';
  raise exception 'MEMBER_VERIFIED';
 exception when raise_exception then if sqlerrm='MEMBER_VERIFIED' then raise; end if; end;
end$$;
update public.cb_missions set status='submitted',evidence='Link da entrega' where id='20000000-0000-0000-0000-000000000002';
do $$begin
 if (select total from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001')<>55 then raise exception 'Evidência pontuou sem verificação'; end if;
 if public.cb_ranking('2026-T2')::text like '%Mestre B%' then raise exception 'Ranking expôs identidade sem opt-in'; end if;
end$$;
insert into public.cb_cases(id,member_id,code,initials,age,sex,form,question,consent)
values('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','MGZ-TEST','AB',55,'NI','{}','Hipótese para análise',true);
insert into storage.objects(bucket_id,name) values('pgz-exams','10000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000001/test.pdf');
do $$begin
 begin
  insert into public.cb_cases(member_id,code,initials,age,sex,form,question,consent,status,lens)
  values('10000000-0000-0000-0000-000000000001','MGZ-FRAUD','AB',55,'NI','{}','Teste',true,'answered','Lente');
  raise exception 'AUTO_CLINICAL_REVIEW';
 exception when insufficient_privilege then null; end;
end$$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
do $$begin
 if exists(select 1 from public.cb_cases) then raise exception 'Caso de outro membro exposto'; end if;
 if exists(select 1 from storage.objects) then raise exception 'Exame de outro membro exposto'; end if;
 begin
  insert into storage.objects(bucket_id,name) values('pgz-exams','10000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000001/attack.pdf');
  raise exception 'CROSS_MEMBER_UPLOAD';
 exception when insufficient_privilege then null; end;
end$$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
update public.cb_missions set status='verified' where id='20000000-0000-0000-0000-000000000002';
do $$begin
 if (select total from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001')<>60 then raise exception 'Placar completo deveria ser 60'; end if;
 begin
  insert into public.cb_steps(member_id,method_step,status,checks,evidence) values('10000000-0000-0000-0000-000000000001','D04','audited','[true]','Incompleta');
  raise exception 'INCOMPLETE_AUDIT';
 exception when raise_exception then if sqlerrm='INCOMPLETE_AUDIT' then raise; end if; end;
end$$;
insert into public.cb_grades(member_id,period,grade,evidence) values('10000000-0000-0000-0000-000000000001','2026-T2',1,'Trimestre conferido');
do $$begin
 begin
  insert into public.cb_grades(member_id,period,grade,evidence) values('10000000-0000-0000-0000-000000000001','2026-T2',2,'Segundo grau indevido');
  raise exception 'TWO_GRADES';
 exception when unique_violation then null; end;
end$$;
insert into public.cb_extras(member_id,period,kind,reference,evidence) values
 ('10000000-0000-0000-0000-000000000001','2026-T2','module','iris','Contrato'),
 ('10000000-0000-0000-0000-000000000001','2026-T2','module','fabrica','Contrato'),
 ('10000000-0000-0000-0000-000000000001','2026-T2','bonus','alex','Parecer'),
 ('10000000-0000-0000-0000-000000000002','2026-T2','referral','TEST-REF','Conversão conferida');
do $$begin
 if (select total from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001')<>80 then raise exception 'Extras incorretos'; end if;
 begin
  insert into public.cb_extras(member_id,period,kind,reference,evidence) values('10000000-0000-0000-0000-000000000001','2026-T3','module','iris','Reativação');
  raise exception 'MODULE_TWICE';
 exception when unique_violation then null; end;
end$$;
insert into public.cb_rewards(id,period,title,description,stock,opens_at,closes_at)
values('40000000-0000-0000-0000-000000000001','2026-T2','Benefício teste','Condições',1,now()-interval '1 day',now()+interval '1 day');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.cb_redeem('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.cb_redeem('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
do $$begin
 begin
  update public.cb_redemptions set status='confirmed' where member_id='10000000-0000-0000-0000-000000000001';
  raise exception 'VOUCHER_PRIORITY_IGNORED';
 exception when raise_exception then if sqlerrm='VOUCHER_PRIORITY_IGNORED' then raise; end if; end;
end$$;
update public.cb_redemptions set status='confirmed' where member_id='10000000-0000-0000-0000-000000000002';
do $$begin
 if (select stock from public.cb_rewards where id='40000000-0000-0000-0000-000000000001')<>0 then raise exception 'Estoque não reservado'; end if;
 begin
  update public.cb_redemptions set status='confirmed' where member_id='10000000-0000-0000-0000-000000000001';
  raise exception 'OVERSOLD';
 exception when raise_exception then if sqlerrm='OVERSOLD' then raise; end if; end;
end$$;
update public.cb_redemptions set status='cancelled' where member_id='10000000-0000-0000-0000-000000000002';
do $$begin
 if (select stock from public.cb_rewards where id='40000000-0000-0000-0000-000000000001')<>1 then raise exception 'Estoque não devolvido'; end if;
end$$;
select public.cb_snapshot_ranking('2026-T2');
reset role;
insert into public.instagram_serie(member_id,dia,seguidores) values
 ('10000000-0000-0000-0000-000000000001','2026-03-31',10000),
 ('10000000-0000-0000-0000-000000000001','2026-06-30',12500);
set local role authenticated;
do $$begin
 if (select followers from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001')<>2.5 then raise exception 'Seguidores não usam a coleta automática'; end if;
 if (select total from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001')<>77.5 then raise exception 'Placar não refletiu a coleta automática'; end if;
end$$;
reset role;
set local role authenticated;
insert into public.cb_extras(member_id,period,kind,reference,evidence)
values('10000000-0000-0000-0000-000000000001','2026-T3','bonus','alex','Parecer do trimestre seguinte');
do $$begin
 if (select total from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001' and period='2026-T3')<>10 then raise exception 'Bônus não renova por trimestre'; end if;
end$$;
reset role;
set local role anon;
do $$begin
 begin perform public.cb_ranking('2026-T2'); raise exception 'ANON_RANKING'; exception when insufficient_privilege then null; end;
 begin perform * from public.cb_cases; raise exception 'ANON_CASES'; exception when insufficient_privilege then null; end;
end$$;
rollback;
select 'Placar, auditoria, isolamento, evidências, graus, voucher e estoque: OK' as resultado;
