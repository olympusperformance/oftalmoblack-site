-- Ranking e referência semanal compartilham os pontos da graduação existente.
-- Apenas leitura: não concede pontos, graus, vouchers nem elegibilidade.
create view cerebro_private.ranking_points with (security_invoker=true) as
select s.member_id,s.period,s.total,s.complete,'v2.2'::text source,
       false is_demo,null::date source_date
from public.cb_scores s
union all
select mg.member_id,p.value->>'id',(p.value->>'points')::numeric,
       coalesce(p.value->>'state'='closed',false),'graduacao',mg.is_demo,mg.source_date
from public.member_graduations mg
cross join lateral jsonb_array_elements(coalesce(mg.snapshot->'periods','[]'::jsonb)) with ordinality p(value,ordinal)
where jsonb_typeof(p.value->'points')='number'
  and coalesce(p.value->>'state','')<>'future'
  and p.value->>'id' ~ '^20[0-9]{2}-T[1-4]$'
  and not exists(select 1 from public.cb_scores s where s.member_id=mg.member_id and s.period=p.value->>'id')
  and not exists(select 1 from jsonb_array_elements(mg.snapshot->'periods') with ordinality prior(value,ordinal)
                 where prior.value->>'id'=p.value->>'id' and prior.ordinal<p.ordinal);
revoke all on cerebro_private.ranking_points from public,anon,authenticated;

create or replace function cerebro_private.ranking(p_period text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not (public.is_admin() or exists(select 1 from public.members where user_id=auth.uid() and ativo)) then raise exception 'Sem acesso'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by position,alias) from (
    select dense_rank() over(order by s.total desc) position,
      case when m.user_id=auth.uid() or public.is_admin() then m.nome else 'Mestre '||upper(substr(md5(m.id::text),1,6)) end alias,
      case when m.user_id=auth.uid() or public.is_admin() then m.id end member_id,
      s.total,s.complete,s.source,s.is_demo,s.source_date,
      coalesce((select max(g.grade) from public.cb_grades g where g.member_id=m.id),
        (select (mg.snapshot->>'grade')::integer from public.member_graduations mg where mg.member_id=m.id),0) grade,
      (select h.position from public.cb_rank_history h where h.member_id=m.id and h.period=p_period
        and h.week=date_trunc('week',current_date)::date-7) - (dense_rank() over(order by s.total desc))::integer movement
    from cerebro_private.ranking_points s join public.members m on m.id=s.member_id
    where s.period=p_period and m.ativo
  ) r),'[]'::jsonb);
end $$;
revoke all on function cerebro_private.ranking(text) from public,anon;
grant execute on function cerebro_private.ranking(text) to authenticated;

create or replace function cerebro_private.snapshot_ranking(p_period text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Sem acesso'; end if;
  insert into public.cb_rank_history(member_id,period,week,position)
  select s.member_id,s.period,date_trunc('week',current_date)::date,dense_rank() over(order by s.total desc)::integer
  from cerebro_private.ranking_points s join public.members m on m.id=s.member_id and m.ativo
  where s.period=p_period on conflict(member_id,period,week) do nothing;
end $$;
revoke all on function cerebro_private.snapshot_ranking(text) from public,anon;
grant execute on function cerebro_private.snapshot_ranking(text) to authenticated;
