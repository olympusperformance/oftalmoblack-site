-- Executar exclusivamente no banco descartável de testes; tudo é revertido.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000001','admin@example.test'),
 ('00000000-0000-0000-0000-000000000002','a@example.test'),
 ('00000000-0000-0000-0000-000000000003','b@example.test');
insert into public.app_admins(user_id) values('00000000-0000-0000-0000-000000000001');
insert into public.members(id,user_id,nome,email) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Mestre A','a@example.test'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','Mestre B','b@example.test');
insert into cerebro.instagram_contas(ig_user_id,member_id) values('ig-test','10000000-0000-0000-0000-000000000001');
insert into public.instagram_serie(member_id,dia,seguidores) values
 ('10000000-0000-0000-0000-000000000001','2026-09-30',1000),
 ('10000000-0000-0000-0000-000000000001','2026-10-07',4200);
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
insert into public.cb_scoring_profiles(member_id,entered_on,evidence) values
 ('10000000-0000-0000-0000-000000000001','2026-09-24','Planilha'),
 ('10000000-0000-0000-0000-000000000002','2026-09-24','Planilha');
do $$begin
 if (select followers_growth from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001' and period='2026-T4')<>3200 then raise exception 'Crescimento não abre automaticamente'; end if;
 if (select total from public.cb_scores where member_id='10000000-0000-0000-0000-000000000002' and period='2026-T4') is not null then raise exception 'Sem fonte virou zero confirmado'; end if;
 if (select videos from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001' and period='2026-T4') is not null then raise exception 'Sem coleta virou zero'; end if;
end$$;
insert into public.cb_quarters(member_id,period,followers_baseline,followers_baseline_date,followers_baseline_evidence,evidence)
values('10000000-0000-0000-0000-000000000001','2026-T4',1500,'2026-09-30','Planilha D8','Importação autorizada');
do $$begin
 if (select followers_growth from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001' and period='2026-T4')<>2700 then raise exception 'Base manual não teve prioridade'; end if;
 if (select followers_source from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001' and period='2026-T4')<>'auto_base_manual' then raise exception 'Fonte manual omitida'; end if;
end$$;
update public.cb_quarters set followers_growth=0,followers_evidence='Correção conferida',video_credits=1,weeks=2,videos_evidence='Vídeos conferidos' where period='2026-T4';
do $$begin
 if (select followers from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001' and period='2026-T4')<>0 then raise exception 'Zero manual ignorado'; end if;
 if (select videos from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001' and period='2026-T4')<>5 then raise exception 'Vídeo manual ignorado'; end if;
 begin
  perform public.instagram_sync_videos('ig-test','2026-10-01','2026-10-07','[]');
  raise exception 'ADMIN_IMPERSONATED_COLLECTOR';
 exception when insufficient_privilege then null; end;
end$$;
reset role;
set local role service_role;
select public.instagram_sync_videos('ig-test','2026-10-01','2026-10-07','[{"media_id":"v1","published_at":"2026-10-04T12:00:00Z","media_type":"VIDEO","product_type":"REELS","permalink":"https://www.instagram.com/reel/Ab_123/"},{"media_id":"v2","published_at":"2026-10-04T13:00:00Z","media_type":"VIDEO","product_type":"FEED"},{"media_id":"photo","published_at":"2026-10-04T12:00:00Z","media_type":"IMAGE"}]');
-- Repetir a coleta não duplica publicações.
select public.instagram_sync_videos('ig-test','2026-10-01','2026-10-07','[{"media_id":"v1","published_at":"2026-10-04T12:00:00Z","media_type":"VIDEO","product_type":"REELS"}]');
reset role;
do $$begin
 if (select permalink from public.cb_instagram_videos where media_id='v1') is distinct from 'https://www.instagram.com/reel/Ab_123/' then raise exception 'Link perdido na recoleta sem permalink'; end if;
 if (select count(*) from public.cb_instagram_videos)<>2 then raise exception 'Contagem duplicada ou imagem contou como vídeo'; end if;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
do $$begin
 if (select video_credits from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001' and period='2026-T4')<>1 then raise exception 'Coleta apagou correção'; end if;
end$$;
update public.cb_quarters set followers_growth=null,followers_evidence=null,video_credits=null,weeks=null,videos_evidence=null where period='2026-T4';
do $$declare s record; begin
 select * into s from public.cb_scores where member_id='10000000-0000-0000-0000-000000000001' and period='2026-T4';
 if s.followers_growth<>2700 then raise exception 'Retorno ao automático perdeu base da planilha'; end if;
 -- Janela inicial de outubro: 01 a 04, 4/7 de semana. Não usar semana aberta.
 if current_date between date '2026-10-05' and date '2026-10-11' then
  if abs(s.video_credits-4::numeric/7)>0.00001 or abs(s.weeks-4::numeric/7)>0.00001 then raise exception 'Semana parcial incorreta: %',row_to_json(s); end if;
  if s.videos is not null then raise exception 'Pontuou antes de duas semanas'; end if;
 end if;
end$$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
do $$begin
 if exists(select 1 from public.cb_instagram_videos) or exists(select 1 from public.cb_instagram_scores where member_id='10000000-0000-0000-0000-000000000001') then raise exception 'Dados de outro mentorado expostos'; end if;
 begin
  insert into public.cb_instagram_videos(ig_user_id,media_id,member_id,published_at,media_type) values('attack','a','10000000-0000-0000-0000-000000000002',now(),'VIDEO');
  raise exception 'MEMBER_WROTE_COLLECTION';
 exception when insufficient_privilege then null; end;
end$$;
rollback;
