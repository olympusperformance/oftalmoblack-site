-- Banco descartável: bootstrap, schema/progresso/graduacao e migrações do Placar.
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
insert into public.cb_quarters(member_id,period,video_credits,weeks,followers_growth,evidence) values
 ('10000000-0000-0000-0000-000000000001','2026-T4',1,1,1000,'Teste da régua v2.2'),
 ('10000000-0000-0000-0000-000000000001','2026-T3',1,1,1000,'Histórico preservado');
do $$declare n integer; expected numeric; actual numeric; begin
 if (select followers from public.cb_scores where period='2026-T3')<>1 then raise exception 'Histórico recalculado'; end if;
 if (select videos from public.cb_scores where period='2026-T3')<>10 then raise exception 'Vídeos históricos recalculados'; end if;
 if (select videos from public.cb_scores where period='2026-T4') is not null then raise exception 'Vídeos antes de duas semanas'; end if;
 foreach n in array array[-100,1000,2499,2500,4999,5000,10000] loop
  update public.cb_quarters set followers_growth=n where period='2026-T4';
  expected=case when n>=5000 then 5 when n>=2500 then 2.5 else 0 end;
  select followers into actual from public.cb_scores where period='2026-T4';
  if actual is distinct from expected then raise exception 'Faixa incorreta: % = %',n,actual; end if;
 end loop;
end$$;
update public.cb_quarters set followers_growth=null,video_credits=1,weeks=2 where period='2026-T4';
do $$begin
 if (select followers from public.cb_scores where period='2026-T4') is not null then raise exception 'Fonte ausente virou zero'; end if;
 if (select videos from public.cb_scores where period='2026-T4')<>5 then raise exception 'Créditos parciais incorretos'; end if;
 if (select complete from public.cb_scores where period='2026-T4') then raise exception 'Apuração incompleta marcada completa'; end if;
end$$;
insert into public.cb_extras(member_id,period,kind,reference,evidence) values
 ('10000000-0000-0000-0000-000000000001','2026-T4','referral','referral-test-1','Conversão conferida'),
 ('10000000-0000-0000-0000-000000000001','2026-T4','referral','referral-test-2','Conversão conferida');
do $$begin
 if (select extra from public.cb_scores where period='2026-T4')<>50 then raise exception 'Cada indicação deve valer 25'; end if;
 if exists(select 1 from public.cb_grades) then raise exception 'Pontos conferiram grau automaticamente'; end if;
end$$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
do $$begin
 if exists(select 1 from public.cb_scores) then raise exception 'Vazamento do placar de outro membro'; end if;
end$$;
rollback;
