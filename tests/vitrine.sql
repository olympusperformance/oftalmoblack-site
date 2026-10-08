-- Banco descartável local; fixtures revertidas ao final.
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
insert into public.cb_vitrine_rounds(period,status,opens_on) values('2026-T3','distributing','2026-10-01'),('2026-T4','scheduled','2026-12-31');
insert into public.cb_vitrine_preferences(member_id,period,response_status,benefits,source,period_points) values
 ('10000000-0000-0000-0000-000000000001','2026-T3','received','{catarata,grau_zero,passagem}','Fixture',43.6),
 ('10000000-0000-0000-0000-000000000002','2026-T3','declined','{}','Fixture',50);
do $$ begin
 if (select count(*) from public.cb_vitrine_preferences)<>2 then raise exception 'Equipe deve ler todas as respostas'; end if;
 if not exists(select 1 from public.cb_audit_log where entity='cb_vitrine_preferences' and actor=auth.uid()) then raise exception 'Auditoria ausente'; end if;
 begin
  insert into public.cb_vitrine_preferences(member_id,period,response_status,source) values('10000000-0000-0000-0000-000000000001','2026-T3','missing','Duplicada');
  raise exception 'DUPLICATE_ALLOWED';
 exception when unique_violation then null; end;
end $$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$ declare n int; begin
 if (select count(*) from public.cb_vitrine_preferences)<>1 then raise exception 'Vazamento de respostas'; end if;
 if (select count(*) from public.cb_vitrine_rounds)<>2 then raise exception 'Membro deve ver catálogo das rodadas'; end if;
 update public.cb_vitrine_preferences set period_points=999;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Membro alterou pontuação'; end if;
 update public.cb_vitrine_rounds set offers='[{"available":999}]';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Membro alterou vagas'; end if;
 begin
  insert into public.cb_vitrine_preferences(member_id,period,response_status,source) values('10000000-0000-0000-0000-000000000001','2026-T4','received','Fraude');
  raise exception 'MEMBER_INSERT';
 exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000099';
do $$ begin
 if exists(select 1 from public.cb_vitrine_rounds) or exists(select 1 from public.cb_vitrine_preferences) then raise exception 'Conta sem vínculo leu a Vitrine'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.cb_vitrine_preferences; raise exception 'ANON_READ'; exception when insufficient_privilege then null; end;
 begin perform * from public.cb_vitrine_rounds; raise exception 'ANON_CATALOG'; exception when insufficient_privilege then null; end;
end $$;
rollback;
