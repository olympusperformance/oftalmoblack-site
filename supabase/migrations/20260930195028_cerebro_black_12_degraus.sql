-- Evolução aditiva: checklists, métricas do CRM e graduação histórica permanecem.
begin;
create schema if not exists cerebro_private;
revoke all on schema cerebro_private from public;
grant usage on schema cerebro_private to authenticated;

alter table public.artifacts add column if not exists method_steps text[] not null default '{}';
alter table public.artifacts add constraint artifacts_method_steps_valid
  check (method_steps <@ array['D01','D02','D03','D04','D05','D06','D07','D08','D09','D10','D11','D12']);

-- Só etiquetas novas; não altera IDs, etapas ou progresso já existentes.
update public.artifacts set method_steps=case
 when nome ~* 'onboarding|diagnóstico' then array['D01']
 when nome ~* 'posicionamento|linha editorial' then array['D02']
 when nome ~* 'tracker|trackeamento' then array['D03','D06']
 when nome ~* 'sistema black' then array['D03']
 when nome ~* 'time premium' then array['D04']
 when nome ~* 'site institucional|gbp|aeo|google meu negócio' then array['D05']
 when nome ~* 'meta ads|google ads|tráfego|funil expresso' then array['D06']
 when nome ~* 'captação ativa' then array['D07']
 when nome ~* '^encontro grau zero$' then array['D08']
 when nome ~* 'chamada consultiva' then array['D09']
 when nome ~* 'in the bag|closer' then array['D10']
 when nome ~* 'encantamento' then array['D11']
 when nome ~* 'recorrência|seguro premium' then array['D12']
 else method_steps end where cardinality(method_steps)=0 and coalesce(to_jsonb(artifacts)->>'tipo','artefato')<>'interna';
update public.artifacts set nome='Método In The Bag' where nome='Conversão In The Bag';
with catalog(name,step,description) as (values
 ('Time Premium','D04','Quatro funções com dono e trilha Cultura Premium & Atendimento Premium.'),
 ('Captação Ativa','D07','Rotina do Social Seller e indicação ativa.'),
 ('Encontro Grau Zero','D08','Divulgação, vídeos para grupo e tráfego, presença no pitch.'),
 ('Chamada Consultiva','D09','Funil de High Ticket e resgate de leads parados.'),
 ('Método In The Bag','D10','SDR, sequência consultiva e cadência D+1 · D+5 · D+9 · D+16 · D+21.'),
 ('Protocolo de Encantamento','D11','Rituais, provas consentidas e NPS.'),
 ('Recorrência Black','D12','Seguro Premium e Cuidado Premium.'),
 ('Treino de Competição',null,'Cultura Premium & Atendimento Premium e técnica das quatro funções.'),
 ('Íris Black',null,'Produto separado: assistente virtual de qualificação e agendamento.')
), created as (
insert into public.artifacts(nome,subtitulo,status,method_steps)
select c.name,c.description,'Em produção',case when c.step is null then '{}'::text[] else array[c.step] end
from catalog c where not exists(select 1 from public.artifacts a where lower(a.nome)=lower(c.name) and a.member_id is null and coalesce(to_jsonb(a)->>'tipo','artefato')='artefato')
returning id,nome
), criteria(name,items) as (values
 ('Time Premium',array['Social Seller com dono','SDR com dono','Closer com dona','Equipe clínica com responsáveis','Trilha Cultura Premium & Atendimento Premium concluída','Padrões implantados no balcão']),
 ('Captação Ativa',array['Rotina diária do Social Seller','Roteiro de indicação ativa','Desfecho de todos os Leads Bônus']),
 ('Encontro Grau Zero',array['Divulgação marcando @dralexsa','Vídeos para grupo e tráfego','Presença no pitch']),
 ('Chamada Consultiva',array['Closer treinada','Agenda com dupla de horários','Ciclo mensal de resgate']),
 ('Método In The Bag',array['SDR com dono','Sequência consultiva e temperamentos em roleplay','Agenda protegida','Cadência D+1 · D+5 · D+9 · D+16 · D+21']),
 ('Protocolo de Encantamento',array['Três rituais com gatilho','Provas com consentimento','NPS pós-operatório']),
 ('Recorrência Black',array['Seguro Premium precificado','Oferta na alta','Pacotes Cuidado Premium']),
 ('Treino de Competição',array['Trilha Cultura Premium & Atendimento Premium','Técnica das quatro funções','Roleplay mensal e check-in']),
 ('Íris Black',array['Contratação do módulo','Identificação como assistente virtual','Transbordo para humano','Registro no Sistema Black'])
)
insert into public.artifact_steps(artifact_id,titulo,ordem)
select c.id,t.title,t.position::integer from created c join criteria k on k.name=c.nome
cross join lateral unnest(k.items) with ordinality t(title,position);

create table public.cb_quarters (
  member_id uuid not null references public.members(id),
  period text not null check(period ~ '^20[0-9]{2}-T[1-4]$'),
  attended numeric check(attended >= 0), eligible numeric check(eligible > 0),
  video_credits numeric check(video_credits >= 0), weeks numeric check(weeks > 0),
  followers_growth integer, orphan_leads integer check(orphan_leads >= 0),
  sla_recorded boolean, outcomes_percent numeric check(outcomes_percent between 0 and 100),
  cpv_percent numeric check(cpv_percent >= 0), call_conversion numeric check(call_conversion between 0 and 100),
  evidence text not null check(length(trim(evidence)) between 1 and 4000),
  updated_at timestamptz not null default now(), updated_by uuid not null default auth.uid(),
  primary key(member_id,period), check(attended <= eligible), check(video_credits <= weeks)
);
create table public.cb_steps (
  member_id uuid not null references public.members(id),
  method_step text not null check(method_step ~ '^D(0[1-9]|1[0-2])$'),
  status text not null default 'pending' check(status in ('pending','running','audited')),
  checks jsonb not null default '[]' check(jsonb_typeof(checks)='array'),
  metrics jsonb not null default '{}' check(jsonb_typeof(metrics)='object'),
  evidence text not null check(length(trim(evidence)) between 1 and 4000),
  updated_at timestamptz not null default now(), updated_by uuid not null default auth.uid(),
  primary key(member_id,method_step)
);
create table public.cb_missions (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id),
  period text not null check(period ~ '^20[0-9]{2}-T[1-4]$'),
  method_step text not null check(method_step ~ '^D(0[1-9]|1[0-2])$'),
  artifact_step_id uuid references public.artifact_steps(id),
  title text not null check(length(trim(title)) between 1 and 500),
  weight numeric not null check(weight in (0,0.5,1)),
  requested_on date not null default current_date, due_on date not null,
  status text not null default 'requested' check(status in ('requested','submitted','verified','cancelled')),
  evidence text, verified_at timestamptz, verified_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid not null default auth.uid(),
  check(due_on >= requested_on), check(status <> 'verified' or (verified_at is not null and verified_by is not null)),
  unique(member_id,period,artifact_step_id)
);
create index cb_missions_member_period on public.cb_missions(member_id,period);
create table public.cb_extras (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id),
  period text not null check(period ~ '^20[0-9]{2}-T[1-4]$'),
  kind text not null check(kind in ('bonus','referral','module')),
  reference text not null check(length(trim(reference)) between 1 and 200),
  evidence text not null check(length(trim(evidence)) between 1 and 4000),
  updated_at timestamptz not null default now(), updated_by uuid not null default auth.uid(),
  check(kind <> 'module' or reference in ('iris','fabrica'))
);
create unique index cb_module_once on public.cb_extras(member_id,reference) where kind='module';
create unique index cb_referral_once on public.cb_extras(reference) where kind='referral';
create unique index cb_bonus_once on public.cb_extras(member_id,period) where kind='bonus';
create index cb_extras_member_period on public.cb_extras(member_id,period);
create table public.cb_encontros (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id),
  period text not null check(period ~ '^20[0-9]{2}-T[1-4]$'),
  edition date not null, publicized boolean not null default false,
  video_group boolean not null default false, video_ads boolean not null default false,
  attended boolean not null default false, leads integer check(leads >= 0),
  evidence text not null check(length(trim(evidence)) between 1 and 4000),
  updated_at timestamptz not null default now(), updated_by uuid not null default auth.uid(),
  unique(member_id,edition), check(period=extract(year from edition)::text||'-T'||extract(quarter from edition)::text)
);
create table public.cb_grades (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id),
  period text not null check(period ~ '^20[0-9]{2}-T[1-4]$'),
  grade integer not null check(grade between 0 and 10),
  evidence text not null check(length(trim(evidence)) between 1 and 4000),
  updated_at timestamptz not null default now(), updated_by uuid not null default auth.uid(),
  unique(member_id,period), unique(member_id,grade)
);
create table public.cb_rewards (
  id uuid primary key default gen_random_uuid(), period text not null check(period ~ '^20[0-9]{2}-T[1-4]$'),
  title text not null check(length(trim(title)) between 1 and 200), description text not null,
  stock integer not null check(stock >= 0), opens_at timestamptz not null, closes_at timestamptz not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(), updated_by uuid not null default auth.uid(),
  check(closes_at > opens_at)
);
create table public.cb_redemptions (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id),
  reward_id uuid not null references public.cb_rewards(id),
  voucher_id uuid references public.cb_extras(id),
  status text not null default 'requested' check(status in ('requested','confirmed','completed','cancelled')),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), updated_by uuid not null default auth.uid()
);
create unique index cb_active_reward_request on public.cb_redemptions(member_id,reward_id) where status<>'cancelled';
create unique index cb_voucher_used_once on public.cb_redemptions(voucher_id) where status <> 'cancelled';
create index cb_redemptions_member on public.cb_redemptions(member_id);
create index cb_redemptions_reward on public.cb_redemptions(reward_id);
create table public.cb_cases (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id),
  code text not null check(code ~ '^MGZ-[A-Za-z0-9-]{1,30}$'),
  initials text not null check(initials ~ '^[A-Za-zÀ-ÿ. ]{1,12}$'),
  age integer not null check(age between 0 and 120), sex text not null check(sex in ('F','M','NI')),
  form jsonb not null check(jsonb_typeof(form)='object'),
  question text not null check(length(trim(question)) between 1 and 4000),
  consent boolean not null check(consent),
  status text not null default 'waiting' check(status in ('waiting','answered','completed')),
  lens text, rationale text, feedback text, revenue numeric check(revenue >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), updated_by uuid not null default auth.uid(),
  unique(member_id,code)
);
create index cb_cases_member on public.cb_cases(member_id,created_at desc);
create table public.cb_case_files (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id),
  case_id uuid not null references public.cb_cases(id), path text not null unique,
  size_bytes bigint not null check(size_bytes between 1 and 157286400),
  updated_at timestamptz not null default now(), updated_by uuid not null default auth.uid()
);
create index cb_case_files_member on public.cb_case_files(member_id,case_id);
create table public.cb_audit_log (
  id bigint generated always as identity primary key,
  member_id uuid, entity text not null, actor uuid not null, occurred_at timestamptz not null default now(),
  previous jsonb, current jsonb
);
create index cb_audit_member on public.cb_audit_log(member_id,occurred_at desc);
create table public.cb_rank_history (
 member_id uuid not null references public.members(id),period text not null,
 week date not null,position integer not null,primary key(member_id,period,week)
);
alter table public.cb_rank_history enable row level security;
revoke all on public.cb_rank_history from public,anon,authenticated;

create function cerebro_private.stamp() returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_by=auth.uid(); new.updated_at=now();
  if new.updated_by is null then raise exception 'Login necessário'; end if;
  if tg_table_name='cb_missions' then
    if new.status='verified' then new.verified_at=now(); new.verified_by=auth.uid();
    else new.verified_at=null; new.verified_by=null; end if;
  end if;
  if tg_table_name='cb_steps' then
   if new.status='audited' then
    if jsonb_array_length(new.checks)<(case new.method_step when 'D01' then 2 when 'D04' then 6 when 'D06' then 4 when 'D10' then 4 else 3 end)
       or exists(select 1 from jsonb_array_elements(new.checks) v where v <> 'true'::jsonb) then
      raise exception 'Todos os critérios precisam ser verificados antes da auditoria';
    end if;
   end if;
  end if;
  return new;
end $$;
create function cerebro_private.audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Login necessário'; end if;
  insert into public.cb_audit_log(member_id,entity,actor,previous,current)
  values((to_jsonb(new)->>'member_id')::uuid,tg_table_name,auth.uid(),
    case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
  return new;
end $$;
revoke all on function cerebro_private.stamp(),cerebro_private.audit() from public,anon,authenticated;

do $$ declare t text; begin
  foreach t in array array['cb_quarters','cb_steps','cb_missions','cb_extras','cb_encontros','cb_grades','cb_cases','cb_case_files','cb_redemptions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update on public.%I to authenticated',t);
    execute format('create policy own_read on public.%I for select to authenticated using ((select public.is_admin()) or member_id in (select id from public.members where user_id=(select auth.uid()) and ativo))',t);
    execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select public.is_admin()))',t);
    execute format('create policy admin_update on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',t);
    execute format('create trigger stamp before insert or update on public.%I for each row execute function cerebro_private.stamp()',t);
    execute format('create trigger audit after insert or update on public.%I for each row execute function cerebro_private.audit()',t);
  end loop;
end $$;
alter table public.cb_rewards enable row level security;
alter table public.cb_audit_log enable row level security;
revoke all on public.cb_rewards,public.cb_audit_log from public,anon,authenticated;
grant select,insert,update on public.cb_rewards to authenticated;
grant select on public.cb_audit_log to authenticated;
create policy reward_read on public.cb_rewards for select to authenticated using ((select public.is_admin()) or exists(select 1 from public.members where user_id=(select auth.uid()) and ativo));
create policy reward_write on public.cb_rewards for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy audit_read on public.cb_audit_log for select to authenticated using ((select public.is_admin()));
create trigger stamp before insert or update on public.cb_rewards for each row execute function cerebro_private.stamp();
create trigger audit after insert or update on public.cb_rewards for each row execute function cerebro_private.audit();

-- Membres não alteram peso, prazo, conclusão auditada nem decisões clínicas.
create function cerebro_private.member_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if public.is_admin() then return new; end if;
  if tg_table_name='cb_missions' then
    if (to_jsonb(new)-array['evidence','status','updated_at','updated_by']) is distinct from
       (to_jsonb(old)-array['evidence','status','updated_at','updated_by']) or new.status<>'submitted'
       or old.status not in ('requested','submitted') or length(trim(coalesce(new.evidence,'')))=0 then
      raise exception 'Envie somente a evidência da missão solicitada';
    end if;
  elsif tg_table_name='cb_cases' and tg_op='UPDATE' then
    if (to_jsonb(new)-array['feedback','updated_at','updated_by']) is distinct from
       (to_jsonb(old)-array['feedback','updated_at','updated_by']) or old.status<>'answered' then
      raise exception 'Somente o feedback de um caso respondido pode ser atualizado';
    end if;
  end if;
  return new;
end $$;
revoke all on function cerebro_private.member_guard() from public,anon,authenticated;
create trigger member_guard before update on public.cb_missions for each row execute function cerebro_private.member_guard();
create trigger member_guard before update on public.cb_cases for each row execute function cerebro_private.member_guard();
create policy mission_submit on public.cb_missions for update to authenticated
  using(member_id in(select id from public.members where user_id=(select auth.uid()) and ativo) and status in('requested','submitted'))
  with check(member_id in(select id from public.members where user_id=(select auth.uid()) and ativo) and status='submitted');
create function cerebro_private.sync_mission_step() returns trigger language plpgsql set search_path='' as $$
begin
 if new.artifact_step_id is not null and public.is_admin() then
   if new.status='verified' then perform public.marcar_etapa(new.member_id,new.artifact_step_id,true);
   elsif tg_op='UPDATE' then
     if old.status='verified' and new.status='requested' then perform public.marcar_etapa(new.member_id,new.artifact_step_id,false); end if;
   end if;
 end if;
 return new;
end $$;
revoke all on function cerebro_private.sync_mission_step() from public,anon,authenticated;
create trigger sync_mission_step after insert or update on public.cb_missions for each row execute function cerebro_private.sync_mission_step();
create policy case_insert on public.cb_cases for insert to authenticated with check(
  member_id in(select id from public.members where user_id=(select auth.uid()) and ativo)
  and status='waiting' and lens is null and rationale is null and revenue is null and feedback is null);
create policy case_feedback on public.cb_cases for update to authenticated
  using(member_id in(select id from public.members where user_id=(select auth.uid()) and ativo) and status='answered')
  with check(member_id in(select id from public.members where user_id=(select auth.uid()) and ativo) and status='answered');
create policy case_file_insert on public.cb_case_files for insert to authenticated with check(
  member_id in(select id from public.members where user_id=(select auth.uid()) and ativo)
  and exists(select 1 from public.cb_cases c where c.id=case_id and c.member_id=cb_case_files.member_id)
  and split_part(path,'/',1)=member_id::text and split_part(path,'/',2)=case_id::text);
revoke insert on public.cb_redemptions from authenticated;

-- A fonte autoritativa do placar. NULL = fonte ainda não apurada, nunca zero inventado.
create view public.cb_scores with(security_invoker=true) as
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
 case when q.video_credits is not null and q.weeks>0 then least(10,q.video_credits/q.weeks*10) end videos,
 case when en.possible>0 then en.delivered::numeric/en.possible*10 end encontro,
 coalesce(ig.growth,q.followers_growth) followers_growth,
 case when ig.growth is not null then 'auto' else 'manual' end followers_source,
 case when coalesce(ig.growth,q.followers_growth) is not null then least(5,greatest(0,coalesce(ig.growth,q.followers_growth)::numeric/1000)) end followers,
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
revoke all on public.cb_scores from public,anon,authenticated;
grant select on public.cb_scores to authenticated;

-- Ranking divulga apenas pseudônimo, pontos e grau. Nenhum prontuário ou receita.
create function cerebro_private.ranking(p_period text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not (public.is_admin() or exists(select 1 from public.members where user_id=auth.uid() and ativo)) then raise exception 'Sem acesso'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by position,alias) from (
    select dense_rank() over(order by s.total desc) position,
      case when m.user_id=auth.uid() or public.is_admin() then m.nome else 'Mestre '||upper(substr(md5(m.id::text),1,6)) end alias,
      case when m.user_id=auth.uid() or public.is_admin() then m.id end member_id,
      s.total,s.complete,coalesce((select max(g.grade) from public.cb_grades g where g.member_id=m.id),
        (select (mg.snapshot->>'grade')::integer from public.member_graduations mg where mg.member_id=m.id),0) grade,
      (select h.position from public.cb_rank_history h where h.member_id=m.id and h.period=p_period
        and h.week=date_trunc('week',current_date)::date-7) - (dense_rank() over(order by s.total desc))::integer movement
    from public.cb_scores s join public.members m on m.id=s.member_id where s.period=p_period and m.ativo
  ) r),'[]'::jsonb);
end $$;
revoke all on function cerebro_private.ranking(text) from public,anon;
grant execute on function cerebro_private.ranking(text) to authenticated;
create function public.cb_ranking(p_period text) returns jsonb language sql security invoker set search_path='' as $$select cerebro_private.ranking(p_period)$$;
revoke all on function public.cb_ranking(text) from public,anon;
grant execute on function public.cb_ranking(text) to authenticated;

create function cerebro_private.snapshot_ranking(p_period text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Sem acesso'; end if;
 insert into public.cb_rank_history(member_id,period,week,position)
 select s.member_id,s.period,date_trunc('week',current_date)::date,dense_rank() over(order by s.total desc)::integer
 from public.cb_scores s join public.members m on m.id=s.member_id and m.ativo where s.period=p_period
 on conflict(member_id,period,week) do nothing;
end $$;
revoke all on function cerebro_private.snapshot_ranking(text) from public,anon;
grant execute on function cerebro_private.snapshot_ranking(text) to authenticated;
create function public.cb_snapshot_ranking(p_period text) returns void language sql security invoker set search_path='' as $$select cerebro_private.snapshot_ranking(p_period)$$;
revoke all on function public.cb_snapshot_ranking(text) from public,anon;
grant execute on function public.cb_snapshot_ranking(text) to authenticated;

create function cerebro_private.grade_guard() returns trigger language plpgsql set search_path='' as $$
declare previous_grade integer; points numeric; period_end date;
begin
 if tg_op='UPDATE' then
   if new.grade<>old.grade or new.member_id<>old.member_id or new.period<>old.period then raise exception 'Grau conferido é permanente'; end if;
   return new;
 end if;
 select coalesce(max(g.grade),(select (s.snapshot->>'grade')::integer from public.member_graduations s where s.member_id=new.member_id),0)
 into previous_grade from public.cb_grades g where g.member_id=new.member_id;
 select total into points from public.cb_scores where member_id=new.member_id and period=new.period;
 period_end=(make_date(left(new.period,4)::integer,right(new.period,1)::integer*3,1)+interval '1 month - 1 day')::date;
 if new.grade<>previous_grade+1 or coalesce(points,0)<50 or current_date<=period_end then
   raise exception 'Grau exige meta 50, trimestre encerrado e avanço de no máximo um grau';
 end if;
 return new;
end $$;
revoke all on function cerebro_private.grade_guard() from public,anon,authenticated;
create trigger grade_guard before insert or update on public.cb_grades for each row execute function cerebro_private.grade_guard();

-- Pedido entra na fila; confirmação reserva estoque sob lock.
create function cerebro_private.redeem(p_reward uuid,p_member uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.cb_rewards; v uuid; points numeric; result uuid;
begin
  if auth.uid() is null or not (public.is_admin() or exists(select 1 from public.members where id=p_member and user_id=auth.uid() and ativo)) then raise exception 'Sem acesso'; end if;
  perform 1 from public.members where id=p_member for update;
  select * into r from public.cb_rewards where id=p_reward and active for update;
  if r.id is null or now()<r.opens_at or now()>r.closes_at then raise exception 'Vitrine fora da janela de resgate'; end if;
  if r.stock<=0 then raise exception 'Sem vagas disponíveis'; end if;
  select e.id into v from public.cb_extras e where e.member_id=p_member and e.kind='referral'
    and not exists(select 1 from public.cb_redemptions d where d.voucher_id=e.id and d.status<>'cancelled') order by e.updated_at limit 1;
  select total into points from public.cb_scores where member_id=p_member and period=r.period;
  if v is null and coalesce(points,0)<50 then raise exception 'É necessário um voucher ou 50 pontos no trimestre'; end if;
  insert into public.cb_redemptions(member_id,reward_id,voucher_id) values(p_member,p_reward,v) returning id into result;
  return result;
end $$;
revoke all on function cerebro_private.redeem(uuid,uuid) from public,anon;
grant execute on function cerebro_private.redeem(uuid,uuid) to authenticated;
create function public.cb_redeem(p_reward uuid,p_member uuid) returns uuid language sql security invoker set search_path='' as $$select cerebro_private.redeem(p_reward,p_member)$$;
revoke all on function public.cb_redeem(uuid,uuid) from public,anon;
grant execute on function public.cb_redeem(uuid,uuid) to authenticated;

create function cerebro_private.reserve_reward() returns trigger language plpgsql security definer set search_path='' as $$
declare available integer; own_points numeric;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Somente a equipe confirma resgates'; end if;
  if new.reward_id<>old.reward_id or new.member_id<>old.member_id or new.voucher_id is distinct from old.voucher_id then raise exception 'Identidade do pedido imutável'; end if;
  if new.status=old.status then return new; end if;
  if old.status='requested' and new.status='confirmed' then
    select stock into available from public.cb_rewards where id=new.reward_id for update;
    if available<=0 then raise exception 'Estoque esgotado'; end if;
    select s.total into own_points from public.cb_scores s join public.cb_rewards r on r.period=s.period
      where r.id=new.reward_id and s.member_id=new.member_id;
    if new.voucher_id is null and coalesce(own_points,0)<50 then raise exception 'Elegibilidade de pontuação não confirmada'; end if;
    if exists(select 1 from public.cb_redemptions d
      join public.cb_rewards r on r.id=d.reward_id
      left join public.cb_scores s on s.member_id=d.member_id and s.period=r.period
      where d.reward_id=new.reward_id and d.status='requested' and d.id<>new.id
      and (d.voucher_id is not null or coalesce(s.total,0)>=50)
      and ((d.voucher_id is not null and new.voucher_id is null)
        or ((d.voucher_id is null)=(new.voucher_id is null) and
          (coalesce(s.total,0)>coalesce(own_points,0) or
           (coalesce(s.total,0)=coalesce(own_points,0) and d.requested_at<new.requested_at)))))
    then raise exception 'Há um pedido com prioridade nesta fila'; end if;
    update public.cb_rewards set stock=stock-1 where id=new.reward_id;
  elsif old.status='confirmed' and new.status='cancelled' then
    update public.cb_rewards set stock=stock+1 where id=new.reward_id;
  elsif not ((old.status='requested' and new.status='cancelled') or (old.status='confirmed' and new.status='completed')) then
    raise exception 'Transição de resgate inválida';
  end if;
  return new;
end $$;
revoke all on function cerebro_private.reserve_reward() from public,anon,authenticated;
create trigger reserve_reward before update on public.cb_redemptions for each row execute function cerebro_private.reserve_reward();

-- Bucket privado. Arquivos até 150 MiB; upload retomável TUS no cliente.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pgz-exams','pgz-exams',false,157286400,array['application/pdf']) on conflict(id) do nothing;
create policy pgz_read on storage.objects for select to authenticated using(bucket_id='pgz-exams' and exists(
  select 1 from public.cb_cases c where c.id::text=(storage.foldername(name))[2]
  and c.member_id::text=(storage.foldername(name))[1]
  and ((select public.is_admin()) or c.member_id in(select id from public.members where user_id=(select auth.uid()) and ativo))));
create policy pgz_upload on storage.objects for insert to authenticated with check(bucket_id='pgz-exams' and exists(
  select 1 from public.cb_cases c where c.id::text=(storage.foldername(name))[2]
  and c.member_id::text=(storage.foldername(name))[1]
  and ((select public.is_admin()) or c.member_id in(select id from public.members where user_id=(select auth.uid()) and ativo))));
commit;
