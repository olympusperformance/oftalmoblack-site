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
 if ranking->1->>'alias'<>'Mestre B' then raise exception 'Ranking deve mostrar os nomes dos outros membros'; end if;
 if ranking->1->>'member_id' is not null then raise exception 'ID privado de outro membro exposto'; end if;
 begin perform * from cerebro_private.ranking_standings;raise exception 'RAW_STANDINGS_EXPOSED';exception when insufficient_privilege then null;end;
 begin perform public.cb_snapshot_ranking('2026-T3');raise exception 'MEMBER_SNAPSHOT';exception when raise_exception then if sqlerrm<>'Sem acesso' then raise; end if;end;
 begin perform * from cerebro_private.ranking_points;raise exception 'RAW_RANKING_EXPOSED';exception when insufficient_privilege then null;end;
end$$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
insert into public.cb_quarters(member_id,period,evidence) values
 ('10000000-0000-4000-8000-000000000001','2026-T3','Apuração nova iniciada');
do $$declare ranking jsonb:=public.cb_ranking('2026-T3');begin
 if jsonb_array_length(ranking)<>2 then raise exception 'Histórico duplicou linha do placar novo'; end if;
 if ranking->1->>'alias'<>'Mestre B' or (ranking->1->>'total')::numeric<>55 then raise exception 'Histórico de outro membro perdido'; end if;
 if ranking->0->>'alias'<>'Mestre A' or (ranking->0->>'grade')::int<>2 then raise exception 'Mais pontos ultrapassaram maior graduação'; end if;
 if (ranking->0->>'total')::numeric<>0 or ranking->0->>'source'<>'v2.2' or (ranking->0->>'is_demo')::boolean then raise exception 'Zero novo não substituiu histórico'; end if;
 if (public.cb_ranking('2026-T2')->0->>'total')::numeric<>58.3 then raise exception 'Apuração nova alterou outro trimestre'; end if;
end$$;
select public.cb_snapshot_ranking('2026-T3');
reset role;
do $$begin
 if (select count(*) from public.cb_rank_history where period='2026-T3')<>2 then raise exception 'Snapshot ignora graduação histórica'; end if;
 if (select position from public.cb_rank_history where member_id='10000000-0000-4000-8000-000000000002' and period='2026-T3')<>2 then raise exception 'Snapshot diverge da posição exibida'; end if;
end$$;
-- Empate de graduação: pontos desempatam; empate completo compartilha posição.
insert into public.members(id,nome,email,ativo)
select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
       'Grau teste '||i,'grade-'||i||'@example.test',true from generate_series(1,8) i;
insert into public.member_graduations(member_id,source_date,is_demo,snapshot)
select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,current_date,false,
 jsonb_build_object('grade',g,'periods',jsonb_build_array(jsonb_build_object('id','2026-T3','state','closed','points',p)))
from (values (1,10,0),(2,9,100),(3,8,200),(4,7,300),(5,6,400),(6,2,10),(7,2,10),(8,0,999)) t(i,g,p);
-- Referências de pontos da semana anterior não podem gerar variação na nova regra.
insert into public.cb_rank_history(member_id,period,week,position)
values ('10000000-0000-4000-8000-000000000001','2026-T3',date_trunc('week',current_date)::date-7,99);
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$declare r jsonb:=public.cb_ranking('2026-T3');begin
 if (select array_agg((v->>'grade')::int order by n) from jsonb_array_elements(r) with ordinality t(v,n))
    <> array[10,9,8,7,6,2,2,2,1,0] then raise exception 'Hierarquia de faixas/graus incorreta'; end if;
 if (r->5->>'position')::int<>6 or (r->6->>'position')::int<>6 or (r->7->>'position')::int<>7 then raise exception 'Desempate por pontos ou empate completo incorreto'; end if;
 if r->5->>'alias'<>'Grau teste 6' or r->6->>'alias'<>'Grau teste 7' then raise exception 'Ordem estável do empate perdida'; end if;
 if exists(select 1 from jsonb_array_elements(r) v where v->>'movement' is not null) then raise exception 'Comparação misturou regras'; end if;
end$$;
reset role;
insert into public.cb_rank_history(member_id,period,week,position,ranking_rule)
values ('10000000-0000-4000-8000-000000000001','2026-T3',date_trunc('week',current_date)::date-7,8,'graduation_v2');
-- Mantém referências antigas também quando há referência nova na mesma semana.
insert into public.cb_rank_history(member_id,period,week,position)
values ('10000000-0000-4000-8000-000000000001','2026-T3',date_trunc('week',current_date)::date,99);
set local role authenticated;
select public.cb_snapshot_ranking('2026-T3');
select public.cb_snapshot_ranking('2026-T3');
do $$begin
 if (select (v->>'movement')::int from jsonb_array_elements(public.cb_ranking('2026-T3')) v where v->>'alias'='Mestre A')<>1 then raise exception 'Variação semanal diverge da graduação'; end if;
end$$;
reset role;
do $$begin
 if (select count(*) from public.cb_rank_history where period='2026-T3' and week=date_trunc('week',current_date)::date and ranking_rule='graduation_v2')<>10 then raise exception 'Referência nova duplicada ou incompleta'; end if;
 if (select position from public.cb_rank_history where member_id='10000000-0000-4000-8000-000000000001' and period='2026-T3' and week=date_trunc('week',current_date)::date and ranking_rule='graduation_v2')<>1 then raise exception 'Primeira referência da semana alterada'; end if;
 if (select position from public.cb_rank_history where member_id='20000000-0000-4000-8000-000000000007' and period='2026-T3' and week=date_trunc('week',current_date)::date and ranking_rule='graduation_v2')<>6 then raise exception 'Snapshot não respeita empate de graduação e pontos'; end if;
 if (select count(*) from public.cb_rank_history where ranking_rule='points_v1')<>2 then raise exception 'Referência antiga removida'; end if;
end$$;
set local role anon;
do $$begin
 begin perform public.cb_ranking('2026-T3');raise exception 'ANON_RANKING';exception when insufficient_privilege then null;end;
end$$;
rollback;
select 'Ranking: histórico, origem, privacidade, prioridade v2.2 e referência semanal OK' as resultado;
