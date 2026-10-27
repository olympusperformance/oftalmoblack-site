-- Operational context belongs to the member, not to a city/unit or login.
-- Original entries are append-only. Revisions point to new dated sources.
begin;
create table public.sdr_intake_links (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.members(id),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 version text not null check(version='sdr-onboarding-v1'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 issued_by uuid references auth.users(id),
 check(expires_at>created_at)
);
create index sdr_intake_links_member_idx on public.sdr_intake_links(member_id);
create table public.sdr_context_entries (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.members(id),
 source_type text not null check(source_type in ('sdr_onboarding')),
 source_ref text not null check(length(source_ref) between 1 and 500),
 source_key text not null check(length(source_key) between 1 and 200),
 source_at timestamptz not null,
 source_precision text not null default 'day' check(source_precision in ('day','timestamp')),
 recorded_at timestamptz not null default now(),
 version text not null,
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=40000),
 intake_link_id uuid references public.sdr_intake_links(id),
 content_hash text,
 unique(member_id,source_key),
 check(source_type<>'sdr_onboarding' or (intake_link_id is not null and content_hash is not null and content_hash ~ '^[a-f0-9]{64}$'))
);
create index sdr_context_entries_member_idx on public.sdr_context_entries(member_id,source_at desc);
alter table public.sdr_intake_links enable row level security;
alter table public.sdr_context_entries enable row level security;
revoke all on public.sdr_intake_links,public.sdr_context_entries from anon,authenticated;
grant select on public.sdr_intake_links,public.sdr_context_entries to authenticated;
grant insert on public.sdr_context_entries to authenticated;
revoke all on public.sdr_intake_links,public.sdr_context_entries from service_role;
grant select,insert,update on public.sdr_intake_links to service_role;
grant select,insert on public.sdr_context_entries to service_role;
create policy intake_admin_read on public.sdr_intake_links for select to authenticated using((select public.is_admin()));
create policy context_admin_read on public.sdr_context_entries for select to authenticated using((select public.is_admin()));
create policy context_admin_insert on public.sdr_context_entries for insert to authenticated
 with check((select public.is_admin()) and false);

create function public.sdr_intake_load(p_token_hash text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('nome',m.nome,'version',l.version,'references',coalesce((
  select jsonb_strip_nulls(jsonb_build_object('whatsapp',e.data->'fatos'->'whatsapp','equipe',e.data->'fatos'->'equipe','consulta',e.data->'fatos'->'consulta','locais',e.data->'fatos'->'locais','convenios',e.data->'fatos'->'convenios','acordo',e.data->'fatos'->'acordo')) from public.member_context_entries e where e.member_id=l.member_id
   and e.version='sdr-ficha-base-v1' order by e.recorded_at desc,e.id desc limit 1
 ),'{}'::jsonb),'answers',coalesce((
  select e.data from public.sdr_context_entries e where e.member_id=l.member_id
   and e.source_type='sdr_onboarding' and e.version=l.version order by e.recorded_at desc,e.id desc limit 1
 ),'{}'::jsonb))
 from public.sdr_intake_links l join public.members m on m.id=l.member_id
 where l.token_hash=p_token_hash and l.revoked_at is null and l.expires_at>now();
$$;
create function public.sdr_intake_submit(p_token_hash text,p_submission_id uuid,p_version text,p_answers jsonb,p_content_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare l public.sdr_intake_links; e public.sdr_context_entries; k text; v jsonb;
begin
 select * into l from public.sdr_intake_links where token_hash=p_token_hash for update;
 if not found or l.revoked_at is not null or l.expires_at<=now() then return jsonb_build_object('status','invalid_link'); end if;
 -- Serialize submissions across multiple links issued to the same member.
 perform pg_advisory_xact_lock(hashtextextended(l.member_id::text,0));
 if p_version<>l.version or p_version<>'sdr-onboarding-v1' or p_content_hash!~'^[a-f0-9]{64}$'
  or p_content_hash is null or p_answers is null or jsonb_typeof(p_answers)<>'object' or p_answers='{}'::jsonb
  or octet_length(p_answers::text)>32768 then raise exception 'invalid answers'; end if;
 -- Validate again at the durable boundary, including direct service-role callers.
 for k,v in select * from jsonb_each(p_answers) loop
  if k not in ('canal_principal','canais_adicionais','equipe_papeis','horario_equipe','horario_assistente','posse_conversa','mensagem_automatica','pacientes_existentes','unidades','servicos_consulta','agenda_grade','agenda_confirmacao','teleconsulta','preco_cirurgia','outros_servicos','convenios','plano_suspenso','plano_nao_coberto','pagamento_consulta','sinal','nome_assistente','tom','informacoes_aprovadas','perguntas_frequentes','audio_imagem','limites_humano','followup_regras','followup_atual','origens','testadores','cenarios','observacoes','responsavel')
   or jsonb_typeof(v)<>'string' or length(v#>>'{}')>3000 or length(trim(v#>>'{}'))=0 then raise exception 'invalid answer'; end if;
 end loop;
 select * into e from public.sdr_context_entries where id=p_submission_id;
 if found then
  if e.member_id=l.member_id and e.intake_link_id=l.id and e.content_hash=p_content_hash and e.data=p_answers then
   return jsonb_build_object('status','duplicate','id',e.id,'created_at',e.recorded_at);
  end if;
  return jsonb_build_object('status','conflict');
 end if;
 if (select count(*) from public.sdr_context_entries where member_id=l.member_id and source_type='sdr_onboarding' and recorded_at>now()-interval '1 hour')>=10 then
  return jsonb_build_object('status','rate_limit'); end if;
 insert into public.sdr_context_entries(id,member_id,source_type,source_ref,source_key,source_at,source_precision,version,data,intake_link_id,content_hash)
 values(p_submission_id,l.member_id,'sdr_onboarding','Ficha de preparação SDR',p_submission_id::text,now(),'timestamp',p_version,p_answers,l.id,p_content_hash)
 on conflict do nothing returning * into e;
 if not found then return jsonb_build_object('status','conflict'); end if;
 return jsonb_build_object('status','created','id',e.id,'created_at',e.recorded_at);
end;
$$;
revoke all on function public.sdr_intake_load(text),public.sdr_intake_submit(text,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.sdr_intake_load(text),public.sdr_intake_submit(text,uuid,text,jsonb,text) to service_role;
comment on table public.sdr_context_entries is 'Fontes datadas do perfil do mentorado no Cérebro Black. Não implica ingestão automática no índice de busca/LLM.';
commit;
