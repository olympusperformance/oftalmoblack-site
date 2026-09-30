-- Somente banco descartável: cenários de graduação histórica e placar v2.2.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000001','rank-admin@example.test'),
 ('00000000-0000-4000-8000-000000000002','rank-a@example.test'),
 ('00000000-0000-4000-8000-000000000003','rank-b@example.test');
insert into public.app_admins(user_id) values('00000000-0000-4000-8000-000000000001');
insert into public.members(id,user_id,nome,email,ativo) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','Mestre A','rank-a@example.test',true),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','Mestre B','rank-b@example.test',true),
 ('10000000-0000-4000-8000-000000000003',null,'Sem apuração','rank-empty@example.test',true),
 ('10000000-0000-4000-8000-000000000004',null,'Inativo','rank-inactive@example.test',false);
insert into public.member_graduations(member_id,source_date,is_demo,snapshot) values
 ('10000000-0000-4000-8000-000000000001','2026-09-20',true,'{"grade":2,"periods":[{"id":"2026-T2","state":"closed","points":58.3},{"id":"2026-T3","state":"current","points":63.9},{"id":"2026-T4","state":"future","points":100}]}'),
 ('10000000-0000-4000-8000-000000000002','2026-09-20',false,'{"grade":1,"periods":[{"id":"2026-T3","state":"current","points":55}]}'),
 ('10000000-0000-4000-8000-000000000003','2026-09-20',false,'{"grade":0,"periods":[{"id":"2026-T3","state":"current","points":null}]}'),
 ('10000000-0000-4000-8000-000000000004','2026-09-20',false,'{"grade":4,"periods":[{"id":"2026-T3","state":"current","points":300}]}');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$declare ranking jsonb:=public.cb_ranking('2026-T3');begin
 if jsonb_array_length(ranking)<>2 then raise exception 'Ranking precisa incluir históricos e excluir inativos/sem apuração'; end if;
 if (ranking->0->>'total')::numeric<>63.9 or ranking->0->>'alias'<>'Mestre A' or (ranking->0->>'grade')::int<>2 then raise exception 'Ranking diverge da graduação'; end if;
 if ranking->0->>'source'<>'graduacao' or not (ranking->0->>'is_demo')::boolean then raise exception 'Origem/aviso de prévia perdido'; end if;
 if (public.cb_ranking('2026-T2')->0->>'total')::numeric<>58.3 then raise exception 'Trimestres misturados'; end if;
 if jsonb_array_length(public.cb_ranking('2026-T4'))<>0 then raise exception 'Pontos futuros indevidos'; end if;
end$$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
do $$declare ranking jsonb:=public.cb_ranking('2026-T3');begin
 if ranking->0->>'member_id'<>'10000000-0000-4000-8000-000000000001' then raise exception 'Linha própria ausente'; end if;
 if ranking->1->>'member_id' is not null or ranking->1->>'alias'='Mestre B' then raise exception 'Identidade de outro membro exposta'; end if;
 begin perform * from cerebro_private.ranking_points;raise exception 'RAW_RANKING_EXPOSED';exception when insufficient_privilege then null;end;
end$$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
insert into public.cb_quarters(member_id,period,evidence) values
 ('10000000-0000-4000-8000-000000000001','2026-T3','Apuração nova iniciada');
do $$declare ranking jsonb:=public.cb_ranking('2026-T3');begin
 if jsonb_array_length(ranking)<>2 then raise exception 'Histórico duplicou linha do placar novo'; end if;
 if ranking->0->>'alias'<>'Mestre B' or (ranking->0->>'total')::numeric<>55 then raise exception 'Histórico de outro membro perdido'; end if;
 if (ranking->1->>'total')::numeric<>0 or ranking->1->>'source'<>'v2.2' or (ranking->1->>'is_demo')::boolean then raise exception 'Zero novo não substituiu histórico'; end if;
 if (public.cb_ranking('2026-T2')->0->>'total')::numeric<>58.3 then raise exception 'Apuração nova alterou outro trimestre'; end if;
end$$;
select public.cb_snapshot_ranking('2026-T3');
reset role;
do $$begin
 if (select count(*) from public.cb_rank_history where period='2026-T3')<>2 then raise exception 'Snapshot ignora graduação histórica'; end if;
 if (select position from public.cb_rank_history where member_id='10000000-0000-4000-8000-000000000002' and period='2026-T3')<>1 then raise exception 'Snapshot diverge da posição exibida'; end if;
end$$;
set local role anon;
do $$begin
 begin perform public.cb_ranking('2026-T3');raise exception 'ANON_RANKING';exception when insufficient_privilege then null;end;
end$$;
rollback;
select 'Ranking: histórico, origem, privacidade, prioridade v2.2 e referência semanal OK' as resultado;
