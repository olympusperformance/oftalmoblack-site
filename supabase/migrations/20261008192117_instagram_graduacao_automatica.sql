-- Dados automáticos e ajustes humanos são fontes separadas. A coleta nunca
-- escreve cb_quarters: a correção da equipe continua prevalecendo.
create table public.cb_scoring_profiles (
 member_id uuid primary key references public.members(id),
 entered_on date not null,
 instagram_username text,
 evidence text not null check(length(evidence)>0),
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
alter table public.cb_scoring_profiles enable row level security;
revoke all on public.cb_scoring_profiles from public,anon,authenticated;
grant select,insert,update on public.cb_scoring_profiles to authenticated;
create policy own_read on public.cb_scoring_profiles for select to authenticated using
 ((select public.is_admin()) or member_id in (select id from public.members where user_id=(select auth.uid()) and ativo));
create policy admin_insert on public.cb_scoring_profiles for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.cb_scoring_profiles for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger stamp before insert or update on public.cb_scoring_profiles for each row execute function cerebro_private.stamp();
create trigger audit after insert or update on public.cb_scoring_profiles for each row execute function cerebro_private.audit();

alter table public.cb_quarters
 add column followers_baseline integer check(followers_baseline>=0),
 add column followers_baseline_date date,
 add column followers_baseline_evidence text,
 add column followers_evidence text,
 add column videos_evidence text,
 add constraint followers_baseline_pair check((followers_baseline is null)=(followers_baseline_date is null));

create function cerebro_private.instagram_override_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.period>='2026-T4' then
  if (new.video_credits is null)<>(new.weeks is null) then raise exception 'Informe créditos e semanas juntos, ou deixe ambos no automático'; end if;
  if new.followers_growth is not null and length(trim(coalesce(new.followers_evidence,new.evidence,'')))=0 then raise exception 'Informe a fonte do ajuste de seguidores'; end if;
  if new.video_credits is not null and length(trim(coalesce(new.videos_evidence,new.evidence,'')))=0 then raise exception 'Informe a fonte do ajuste de vídeos'; end if;
  if new.followers_baseline is not null and length(trim(coalesce(new.followers_baseline_evidence,'')))=0 then raise exception 'Informe a fonte da base de seguidores'; end if;
 end if;
 return new;
end$$;
revoke all on function cerebro_private.instagram_override_guard() from public,anon,authenticated;
create trigger instagram_override_guard before insert or update on public.cb_quarters for each row execute function cerebro_private.instagram_override_guard();

create table public.cb_instagram_videos (
 ig_user_id text not null, media_id text not null,
 member_id uuid not null references public.members(id),
 published_at timestamptz not null,
 media_type text not null check(media_type='VIDEO'), product_type text,
 collected_at timestamptz not null default now(),
 primary key(ig_user_id,media_id)
);
create index cb_instagram_videos_member_date on public.cb_instagram_videos(member_id,published_at);
create table public.cb_instagram_video_sync (
 ig_user_id text not null, period text not null, member_id uuid not null references public.members(id),
 covered_from date not null, covered_until date not null,
 updated_at timestamptz not null default now(),
 primary key(ig_user_id,period),check(covered_until>=covered_from)
);
create index cb_instagram_video_sync_member on public.cb_instagram_video_sync(member_id);
alter table public.cb_instagram_videos enable row level security;
alter table public.cb_instagram_video_sync enable row level security;
revoke all on public.cb_instagram_videos,public.cb_instagram_video_sync from public,anon,authenticated;
grant select on public.cb_instagram_videos,public.cb_instagram_video_sync to authenticated;
create policy own_read on public.cb_instagram_videos for select to authenticated using
 ((select public.is_admin()) or member_id in (select id from public.members where user_id=(select auth.uid()) and ativo));
create policy own_read on public.cb_instagram_video_sync for select to authenticated using
 ((select public.is_admin()) or member_id in (select id from public.members where user_id=(select auth.uid()) and ativo));

create function cerebro_private.sync_instagram_videos(p_ig_user_id text,p_desde date,p_ate date,p_videos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare member uuid; n integer;
begin
 if p_desde is null or p_ate is null or p_ate<p_desde or p_ate>=(now() at time zone 'America/Manaus')::date then raise exception 'Janela de coleta inválida'; end if;
 if jsonb_typeof(p_videos)<>'array' then raise exception 'Publicações inválidas'; end if;
 select c.member_id into member from cerebro.instagram_contas c join public.members m on m.id=c.member_id and m.ativo
 where c.ig_user_id=p_ig_user_id and c.ativo;
 if member is null then return jsonb_build_object('linked',false,'videos',0); end if;
 insert into public.cb_instagram_videos(ig_user_id,media_id,member_id,published_at,media_type,product_type)
 select p_ig_user_id,x.media_id,member,x.published_at,x.media_type,x.product_type
 from jsonb_to_recordset(p_videos) x(media_id text,published_at timestamptz,media_type text,product_type text)
 where x.media_type='VIDEO' and x.product_type is distinct from 'STORY'
 and (x.published_at at time zone 'America/Manaus')::date between p_desde and p_ate
 on conflict(ig_user_id,media_id) do update set published_at=excluded.published_at,product_type=excluded.product_type,member_id=excluded.member_id,collected_at=now();
 get diagnostics n=row_count;
 -- A janela de um trimestre encerrado não desaparece nas coletas seguintes.
 insert into public.cb_instagram_video_sync(ig_user_id,period,member_id,covered_from,covered_until)
 select p_ig_user_id,to_char(q,'YYYY')||'-T'||extract(quarter from q)::integer,member,
   greatest(p_desde,q::date),least(p_ate,(q+interval '3 months - 1 day')::date)
 from generate_series(date_trunc('quarter',p_desde)::date,p_ate,interval '3 months') q
 on conflict(ig_user_id,period) do update set member_id=excluded.member_id,
   covered_from=case when excluded.covered_from<=cb_instagram_video_sync.covered_until+1 and excluded.covered_until>=cb_instagram_video_sync.covered_from-1 then least(cb_instagram_video_sync.covered_from,excluded.covered_from) else excluded.covered_from end,
   covered_until=case when excluded.covered_from<=cb_instagram_video_sync.covered_until+1 and excluded.covered_until>=cb_instagram_video_sync.covered_from-1 then greatest(cb_instagram_video_sync.covered_until,excluded.covered_until) else excluded.covered_until end,
   updated_at=now();
 return jsonb_build_object('linked',true,'videos',n);
end$$;
revoke all on function cerebro_private.sync_instagram_videos(text,date,date,jsonb) from public,anon,authenticated;
grant usage on schema cerebro_private to service_role;
grant execute on function cerebro_private.sync_instagram_videos(text,date,date,jsonb) to service_role;
create function public.instagram_sync_videos(p_ig_user_id text,p_desde date,p_ate date,p_videos jsonb)
returns jsonb language sql security invoker set search_path='' as $$select cerebro_private.sync_instagram_videos(p_ig_user_id,p_desde,p_ate,p_videos)$$;
revoke all on function public.instagram_sync_videos(text,date,date,jsonb) from public,anon,authenticated;
grant execute on function public.instagram_sync_videos(text,date,date,jsonb) to service_role;

create view public.cb_instagram_scores with(security_invoker=true) as
with periods as (
 select member_id,period from public.cb_quarters where period>='2026-T4'
 union
 select p.member_id,to_char(t,'YYYY')||'-T'||extract(quarter from t)::integer
 from public.cb_scoring_profiles p join public.members m on m.id=p.member_id and m.ativo
 cross join lateral generate_series(greatest(date '2026-10-01',date_trunc('quarter',p.entered_on)::date),date_trunc('quarter',now() at time zone 'America/Manaus')::date,interval '3 months') t
), bounds as (
 select p.*,make_date(left(p.period,4)::integer,(right(p.period,1)::integer-1)*3+1,1) starts,
 (make_date(left(p.period,4)::integer,right(p.period,1)::integer*3,1)+interval '1 month - 1 day')::date ends,
 (now() at time zone 'America/Manaus')::date today
 from periods p
), windows as (
 select b.*,sp.entered_on,greatest(b.starts,sp.entered_on) eligible_start,
 case when b.ends<b.today then b.ends else least(b.ends,date_trunc('week',b.today)::date-1) end closed_until
 from bounds b left join public.cb_scoring_profiles sp using(member_id)
), raw as (
 select w.*,q.followers_growth manual_growth,q.video_credits manual_credits,q.weeks manual_weeks,
 q.followers_baseline manual_baseline,q.followers_baseline_date manual_baseline_date,
 q.followers_baseline_evidence,coalesce(q.followers_evidence,q.evidence) followers_evidence,coalesce(q.videos_evidence,q.evidence) videos_evidence,
 base.seguidores auto_baseline,latest.seguidores latest_followers,latest.dia latest_date,
 vs.updated_at videos_updated_at,
 case when w.entered_on is not null and vs.covered_from<=w.eligible_start and vs.covered_until>=w.closed_until and w.closed_until>=w.eligible_start then weekly.credits end auto_video_credits,
 case when w.entered_on is not null and vs.covered_from<=w.eligible_start and vs.covered_until>=w.closed_until and w.closed_until>=w.eligible_start then weekly.weeks end auto_weeks,
 case when w.entered_on is null then 'entry_missing' when vs.updated_at is null then 'awaiting_sync'
   when w.closed_until<w.eligible_start then 'awaiting_closed_week'
   when vs.covered_from>w.eligible_start or vs.covered_until<w.closed_until then 'incomplete_coverage' else 'ready' end videos_status
 from windows w left join public.cb_quarters q using(member_id,period)
 left join lateral(select max(i.seguidores) seguidores from public.instagram_serie i where i.member_id=w.member_id and i.dia=w.eligible_start-1 and i.seguidores is not null having count(*)=1) base on true
 left join lateral(select i.dia,max(i.seguidores) seguidores from public.instagram_serie i
   where i.member_id=w.member_id and i.dia between greatest(w.eligible_start,coalesce(q.followers_baseline_date,w.eligible_start)) and least(w.ends,w.today)
   and i.seguidores is not null and (w.ends>=w.today or i.dia=w.ends)
   group by i.dia having count(*)=1 order by i.dia desc limit 1) latest on true
 left join lateral(select max(s.covered_from) covered_from,max(s.covered_until) covered_until,max(s.updated_at) updated_at from public.cb_instagram_video_sync s where s.member_id=w.member_id and s.period=w.period having count(*)=1) vs on true
 left join lateral(
   select sum(least((we-ws+1)::numeric/7,n::numeric/3)) credits,sum((we-ws+1)::numeric/7) weeks
   from (
    select greatest(d::date,w.eligible_start) ws,least(d::date+6,w.closed_until) we,
      (select count(*) from public.cb_instagram_videos v where v.member_id=w.member_id
       and (v.published_at at time zone 'America/Manaus')::date between greatest(d::date,w.eligible_start) and least(d::date+6,w.closed_until)) n
    from generate_series(date_trunc('week',w.eligible_start)::date,w.closed_until,interval '1 week') d
   ) weeks
 ) weekly on true
), effective as (
 select r.*,coalesce(manual_baseline,auto_baseline) baseline,
 coalesce(manual_baseline_date,eligible_start-1) baseline_date,
 latest_followers-coalesce(manual_baseline,auto_baseline) auto_growth
 from raw r
)
select member_id,period,eligible_start,closed_until,
 coalesce(manual_growth,auto_growth) followers_growth,auto_growth followers_auto_growth,
 case when manual_growth is not null then 'manual' when auto_growth is null then 'missing' when manual_baseline is not null then 'auto_base_manual' else 'auto' end followers_source,
 baseline followers_baseline,baseline_date followers_baseline_date,auto_baseline followers_api_baseline,
 latest_followers,latest_date,followers_baseline_evidence,followers_evidence,
 coalesce(manual_credits,auto_video_credits) video_credits,coalesce(manual_weeks,auto_weeks) weeks,
 auto_video_credits,auto_weeks,
 case when manual_credits is not null and manual_weeks is not null then 'manual' when auto_video_credits is not null then 'auto' else 'missing' end videos_source,
 videos_status,videos_updated_at,videos_evidence
from effective;
revoke all on public.cb_instagram_scores from public,anon,authenticated;
grant select on public.cb_instagram_scores to authenticated;

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
 union select member_id,period from public.cb_instagram_scores
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
 case when src.credits is not null and src.weeks>0 and (p.period<'2026-T4' or src.weeks>=2) then least(10,src.credits/src.weeks*10) end videos,
 case when en.possible>0 then en.delivered::numeric/en.possible*10 end encontro,
 src.growth followers_growth,
 case when p.period>='2026-T4' then soc.followers_source when ig.growth is not null then 'auto' else 'manual' end followers_source,
 case when src.growth is null then null
   when p.period<'2026-T4' then least(5,greatest(0,src.growth::numeric/1000))
   when src.growth>=5000 then 5
   when src.growth>=2500 then 2.5 else 0 end followers,
 case when q.orphan_leads is not null and q.sla_recorded is not null and q.outcomes_percent is not null
   then case when q.orphan_leads=0 and q.sla_recorded and q.outcomes_percent>=95 then 5 else 0 end end system,
 case when mi.asked>0 then coalesce(mi.done,0)/mi.asked*15 else 0 end missions,
 case when q.cpv_percent<15 or q.call_conversion>=60 then 5 when q.cpv_percent is null and q.call_conversion is null then null else 0 end result,
 coalesce(ex.points,0) extra,coalesce(ex.referrals,0) referrals,
 coalesce(mi.asked,0)>0 missions_recorded,
 src.credits video_credits,src.weeks weeks,soc.videos_source,soc.auto_video_credits,soc.auto_weeks,
 soc.followers_auto_growth,soc.followers_baseline,soc.followers_baseline_date,soc.latest_followers,soc.latest_date,
 soc.videos_updated_at,soc.videos_status,soc.followers_baseline_evidence,soc.followers_evidence,soc.videos_evidence
 from periods p left join public.cb_quarters q using(member_id,period)
 left join instagram ig using(member_id,period)
 left join public.cb_instagram_scores soc using(member_id,period)
 left join lateral(select
   case when p.period>='2026-T4' then soc.followers_growth else coalesce(ig.growth,q.followers_growth) end growth,
   case when p.period>='2026-T4' then soc.video_credits else q.video_credits end credits,
   case when p.period>='2026-T4' then soc.weeks else q.weeks end weeks
 ) src on true
 left join mission mi using(member_id,period) left join extra ex using(member_id,period) left join encontro en using(member_id,period)
)
select member_id,period,attendance,videos,encontro,followers_growth,followers_source,followers,system,missions,result,extra,referrals,
 case when period<'2026-T4' or attendance is not null or videos is not null or encontro is not null or followers is not null or system is not null or result is not null or missions_recorded or extra>0
 then round(coalesce(attendance,0)+coalesce(videos,0)+coalesce(encontro,0)+coalesce(followers,0)+coalesce(system,0)+missions+coalesce(result,0)+extra,2) end total,
 (attendance is not null and videos is not null and encontro is not null and followers is not null and system is not null and result is not null) complete,
 video_credits,weeks,videos_source,auto_video_credits,auto_weeks,followers_auto_growth,followers_baseline,followers_baseline_date,latest_followers,latest_date,
 videos_updated_at,videos_status,followers_baseline_evidence,followers_evidence,videos_evidence
from parts;

create or replace view cerebro_private.ranking_points with (security_invoker=true) as
select s.member_id,s.period,s.total,s.complete,'v2.2'::text source,
       false is_demo,null::date source_date
from public.cb_scores s where s.total is not null
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
