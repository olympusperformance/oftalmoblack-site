-- Graduação é cumulativa: 0–6 preta, 7–8 coral, 9 vermelha, 10 dourada.
-- A mesma fonte define posições exibidas e referências semanais.
create view cerebro_private.ranking_standings with (security_invoker=true) as
select entries.*,dense_rank() over(partition by period order by grade desc,total desc)::integer position
from (
  select s.*,coalesce(
    (select max(g.grade) from public.cb_grades g where g.member_id=s.member_id),
    (select (mg.snapshot->>'grade')::integer from public.member_graduations mg where mg.member_id=s.member_id),0) grade
  from cerebro_private.ranking_points s
  join public.members m on m.id=s.member_id and m.ativo
) entries;
revoke all on cerebro_private.ranking_standings from public,anon,authenticated;

-- Preserva as referências antigas, sem comparar posições de regras diferentes.
alter table public.cb_rank_history add column ranking_rule text not null default 'points_v1';
alter table public.cb_rank_history drop constraint cb_rank_history_pkey;
alter table public.cb_rank_history add primary key(member_id,period,week,ranking_rule);

create or replace function cerebro_private.ranking(p_period text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not (public.is_admin() or exists(select 1 from public.members where user_id=auth.uid() and ativo)) then raise exception 'Sem acesso'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by position,alias) from (
    select s.position,
      case when m.user_id=auth.uid() or public.is_admin() then m.nome else 'Mestre '||upper(substr(md5(m.id::text),1,6)) end alias,
      case when m.user_id=auth.uid() or public.is_admin() then m.id end member_id,
      s.total,s.complete,s.source,s.is_demo,s.source_date,s.grade,
      (select h.position from public.cb_rank_history h where h.member_id=m.id and h.period=p_period
        and h.ranking_rule='graduation_v2'
        and h.week=date_trunc('week',current_date)::date-7) - s.position movement
    from cerebro_private.ranking_standings s join public.members m on m.id=s.member_id
    where s.period=p_period
  ) r),'[]'::jsonb);
end $$;
revoke all on function cerebro_private.ranking(text) from public,anon;
grant execute on function cerebro_private.ranking(text) to authenticated;

create or replace function cerebro_private.snapshot_ranking(p_period text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Sem acesso'; end if;
  insert into public.cb_rank_history(member_id,period,week,position,ranking_rule)
  select member_id,period,date_trunc('week',current_date)::date,position,'graduation_v2'
  from cerebro_private.ranking_standings where period=p_period
  on conflict(member_id,period,week,ranking_rule) do nothing;
end $$;
revoke all on function cerebro_private.snapshot_ranking(text) from public,anon;
grant execute on function cerebro_private.snapshot_ranking(text) to authenticated;
