-- Ficha B2B isolada do CRM. Somente service_role acessa cadastros e RPCs.
create table public.black_perfis_clinica (
 id uuid primary key,
 sheet_row bigint generated always as identity (start with 2) unique,
 created_at timestamptz not null default now(),
 nome text not null check (length(nome) between 2 and 160),
 email text not null check (length(email) <= 254),
 whatsapp text not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
 lentes_premium boolean not null,
 volume_lentes text,
 faturamento text not null check (faturamento in ('ate_50','50_100','100_200','200_500','acima_500')),
 desafios text[] not null check (cardinality(desafios) between 1 and 6 and desafios <@ array['atrair_particulares','converter_cirurgias','faturamento_margem','equipe_processos','dependencia','outro']),
 outro_desafio text,
 origem text not null check (origem in ('stories','presencial','direto')),
 utm jsonb not null default '{}'::jsonb,
 pagina text not null,
 payload_hash text not null,
 request_hash text not null,
 synced_at timestamptz,
 sync_attempts integer not null default 0,
 sync_error text,
 next_sync_at timestamptz not null default now(),
 sync_lock_until timestamptz,
 constraint black_perfil_volume check ((lentes_premium and volume_lentes is not null and volume_lentes in ('1_5','6_10','11_20','mais_20')) or (not lentes_premium and volume_lentes is null)),
 constraint black_perfil_outro check (case when 'outro'=any(desafios) then outro_desafio is not null and length(trim(outro_desafio)) between 1 and 500 else outro_desafio is null end)
);
alter table public.black_perfis_clinica enable row level security;
revoke all on public.black_perfis_clinica from public, anon, authenticated;
grant select, insert, update, delete on public.black_perfis_clinica to service_role;
grant usage, select on sequence public.black_perfis_clinica_sheet_row_seq to service_role;
create index black_perfil_pending on public.black_perfis_clinica(next_sync_at) where synced_at is null;
create index black_perfil_rate on public.black_perfis_clinica(request_hash,created_at);

create function public.black_perfil_receber(p_payload jsonb,p_hash text,p_ip_hash text)
returns text language plpgsql security invoker set search_path = '' as $$
declare existing_hash text;
begin
 -- Serializa mesmo ID e a cota por origem de rede. Um evento compartilha Wi-Fi:
 -- cota de 500/h serve apenas como contenção de abuso, sem limitar participantes.
 perform pg_advisory_xact_lock(hashtextextended('perfil:' || p_ip_hash,0));
 select payload_hash into existing_hash from public.black_perfis_clinica where id=(p_payload->>'id')::uuid;
 if found then
   if existing_hash=p_hash then return 'existing'; else return 'conflict'; end if;
 end if;
 if (select count(*) from public.black_perfis_clinica where request_hash=p_ip_hash and created_at>now()-interval '1 hour')>=500 then return 'rate_limit'; end if;
 insert into public.black_perfis_clinica (id,nome,email,whatsapp,lentes_premium,volume_lentes,faturamento,desafios,outro_desafio,origem,utm,pagina,payload_hash,request_hash)
 values ((p_payload->>'id')::uuid,p_payload->>'nome',p_payload->>'email',p_payload->>'whatsapp',(p_payload->>'lentes_premium')::boolean,p_payload->>'volume_lentes',p_payload->>'faturamento',array(select jsonb_array_elements_text(p_payload->'desafios')),p_payload->>'outro_desafio',p_payload->>'origem',p_payload->'utm',p_payload->>'pagina',p_hash,p_ip_hash);
 return 'created';
exception when unique_violation then
 select payload_hash into existing_hash from public.black_perfis_clinica where id=(p_payload->>'id')::uuid;
 if existing_hash=p_hash then return 'existing'; else return 'conflict'; end if;
end;
$$;
revoke all on function public.black_perfil_receber(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.black_perfil_receber(jsonb,text,text) to service_role;

create function public.black_perfil_sync_claim()
returns setof public.black_perfis_clinica language sql security invoker set search_path = '' as $$
 update public.black_perfis_clinica set sync_lock_until=now()+interval '2 minutes',sync_attempts=sync_attempts+1
 where id in (select id from public.black_perfis_clinica where synced_at is null and next_sync_at<=now() and (sync_lock_until is null or sync_lock_until<now()) order by created_at limit 10 for update skip locked)
 returning *;
$$;
revoke all on function public.black_perfil_sync_claim() from public, anon, authenticated;
grant execute on function public.black_perfil_sync_claim() to service_role;
