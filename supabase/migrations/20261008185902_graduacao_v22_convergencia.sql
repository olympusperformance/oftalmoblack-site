-- Régua v2.2 a partir de 2026-T4. Histórico anterior preservado.
-- Arredondamento único do total em duas casas, igual ao painel.
create or replace view public.cb_scores with(security_invoker=true) as
with mission as (
 select member_id,period,sum(weight) filter(where status<>'cancelled') asked,
 sum(weight) filter(where status='verified') done from public.cb_missions group by member_id,period
), extra as (
 select member_id,period,sum(case kind when 'referral' then 25 when 'bonus' then 10 else 5 end) points,
 count(*) filter(where kind='referral') referrals from public.cb_extras group by member_id,period
), encontro as (
 select member_id,period,count(*)*3 possible,
 sum(publicized::int+(video_group and video_ads)::int+attended::int) delivered
 from public.cb_encontros group by member_id,period
), periods as (
 select member_id,period from public.cb_quarters union select member_id,period from public.cb_missions
 union select member_id,period from public.cb_extras union select member_id,period from public.cb_encontros
), windowed as (
 select *,make_date(left(period,4)::integer,(right(period,1)::integer-1)*3+1,1) starts,
 (make_date(left(period,4)::integer,right(period,1)::integer*3,1)+interval '1 month - 1 day')::date ends from periods
), instagram as (
 select p.member_id,p.period,last_day.seguidores-base.seguidores growth
 from windowed p
 left join lateral(select i.seguidores from public.instagram_serie i where i.member_id=p.member_id and i.dia=p.starts-1 and i.seguidores is not null limit 1) base on true
 left join lateral(select i.seguidores from public.instagram_serie i where i.member_id=p.member_id
   and i.dia between p.starts and least(p.ends,current_date) and i.seguidores is not null
   and (p.ends>=current_date or i.dia=p.ends) order by i.dia desc limit 1) last_day on true
), parts as (
 select p.member_id,p.period,
 case when q.attended is not null and q.eligible>0 then least(10,q.attended/q.eligible*10) end attendance,
 case when q.video_credits is not null and q.weeks>0 and (p.period<'2026-T4' or q.weeks>=2) then least(10,q.video_credits/q.weeks*10) end videos,
 case when en.possible>0 then en.delivered::numeric/en.possible*10 end encontro,
 coalesce(ig.growth,q.followers_growth) followers_growth,
 case when ig.growth is not null then 'auto' else 'manual' end followers_source,
 case when coalesce(ig.growth,q.followers_growth) is null then null
   when p.period<'2026-T4' then least(5,greatest(0,coalesce(ig.growth,q.followers_growth)::numeric/1000))
   when coalesce(ig.growth,q.followers_growth)>=5000 then 5
   when coalesce(ig.growth,q.followers_growth)>=2500 then 2.5 else 0 end followers,
 case when q.orphan_leads is not null and q.sla_recorded is not null and q.outcomes_percent is not null
   then case when q.orphan_leads=0 and q.sla_recorded and q.outcomes_percent>=95 then 5 else 0 end end system,
 case when mi.asked>0 then coalesce(mi.done,0)/mi.asked*15 else 0 end missions,
 case when q.cpv_percent<15 or q.call_conversion>=60 then 5 when q.cpv_percent is null and q.call_conversion is null then null else 0 end result,
 coalesce(ex.points,0) extra,coalesce(ex.referrals,0) referrals
 from periods p left join public.cb_quarters q using(member_id,period)
 left join instagram ig using(member_id,period)
 left join mission mi using(member_id,period) left join extra ex using(member_id,period) left join encontro en using(member_id,period)
)
select *,round(coalesce(attendance,0)+coalesce(videos,0)+coalesce(encontro,0)+coalesce(followers,0)+coalesce(system,0)+missions+coalesce(result,0)+extra,2) total,
 (attendance is not null and videos is not null and encontro is not null and followers is not null and system is not null and result is not null) complete
from parts;

comment on column public.cb_quarters.orphan_leads is 'Leads que não receberam resposta pelo Sistema Black; não confundir com leads sem responsável.';
