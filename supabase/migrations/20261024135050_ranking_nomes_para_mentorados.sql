-- Exibe os nomes no ranking para membros ativos e administradores autenticados.
create or replace function cerebro_private.ranking(p_period text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not (public.is_admin() or exists(select 1 from public.members where user_id=auth.uid() and ativo)) then raise exception 'Sem acesso'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by position,alias) from (
    select s.position,
      m.nome alias,
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

