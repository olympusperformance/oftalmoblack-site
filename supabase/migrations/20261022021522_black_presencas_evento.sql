-- Check-in B2B. Autodeclaração por e-mail é separada de sessão autenticada.
-- Não altera graduação, cb_encontros, cb_quarters ou CRM de pacientes.
create table public.black_presencas_evento (
 id uuid primary key,
 sheet_row bigint generated always as identity (start with 2) unique,
 created_at timestamptz not null default now(),
 evento text not null check (length(evento) between 1 and 100),
 email text not null check (length(email) between 3 and 254 and email=lower(trim(email))),
 member_id uuid references public.members(id) on delete set null,
 nome text,
 identificacao text not null check (identificacao in ('email_informado','sessao_autenticada')),
 revision integer not null default 1,
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
 unique(evento,email)
);
alter table public.black_presencas_evento enable row level security;
revoke all on public.black_presencas_evento from public,anon,authenticated;
grant select,insert,update,delete on public.black_presencas_evento to service_role;
grant usage,select on sequence public.black_presencas_evento_sheet_row_seq to service_role;
create index black_presenca_pending on public.black_presencas_evento(next_sync_at) where synced_at is null;
create index black_presenca_rate on public.black_presencas_evento(request_hash,created_at);
create index black_presenca_member on public.black_presencas_evento(member_id);

create function public.black_presenca_receber(p_payload jsonb,p_hash text,p_ip_hash text,p_user_id uuid default null)
returns text language plpgsql security invoker set search_path='' as $$
declare
 v_email text; v_member uuid; v_nome text; v_metodo text := 'email_informado'; v_row public.black_presencas_evento;
begin
 -- Ordem fixa: serialização de ID, rede e identidade evita duplicatas concorrentes.
 perform pg_advisory_xact_lock(hashtextextended('presenca-id:'||(p_payload->>'id'),0));
 perform pg_advisory_xact_lock(hashtextextended('presenca-ip:'||p_ip_hash,0));
 if p_user_id is not null then
   select id,lower(trim(email)),nome into v_member,v_email,v_nome from public.members where user_id=p_user_id and ativo=true;
   if not found then return 'identity_required'; end if;
   v_metodo := 'sessao_autenticada';
 else
   v_email := lower(trim(p_payload->>'email'));
   if v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return 'identity_required'; end if;
   -- E-mail informado não comprova posse. Somente associação para conferência.
   select min(id::text)::uuid,min(nome) into v_member,v_nome from public.members where lower(trim(email))=v_email and ativo=true having count(*)=1;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('presenca-email:'||(p_payload->>'evento')||':'||v_email,0));
 select * into v_row from public.black_presencas_evento where id=(p_payload->>'id')::uuid;
 if found then
   if v_row.payload_hash=p_hash then return 'existing'; else return 'conflict'; end if;
 end if;
 select * into v_row from public.black_presencas_evento where evento=p_payload->>'evento' and email=v_email for update;
 if found then
   -- Uma sessão verificada pode qualificar um registro anterior por e-mail.
   if v_metodo='sessao_autenticada' and v_row.identificacao<>'sessao_autenticada' then
     update public.black_presencas_evento set identificacao=v_metodo,member_id=v_member,nome=v_nome,revision=revision+1,synced_at=null,next_sync_at=now() where id=v_row.id;
   end if;
   return 'existing';
 end if;
 if (select count(*) from public.black_presencas_evento where request_hash=p_ip_hash and created_at>now()-interval '1 hour')>=500 then return 'rate_limit'; end if;
 insert into public.black_presencas_evento(id,evento,email,member_id,nome,identificacao,origem,utm,pagina,payload_hash,request_hash)
 values((p_payload->>'id')::uuid,p_payload->>'evento',v_email,v_member,v_nome,v_metodo,p_payload->>'origem',p_payload->'utm',p_payload->>'pagina',p_hash,p_ip_hash);
 return 'created';
end;
$$;
revoke all on function public.black_presenca_receber(jsonb,text,text,uuid) from public,anon,authenticated;
grant execute on function public.black_presenca_receber(jsonb,text,text,uuid) to service_role;

create function public.black_presenca_sync_claim()
returns setof public.black_presencas_evento language sql security invoker set search_path='' as $$
 update public.black_presencas_evento set sync_lock_until=now()+interval '5 minutes',sync_attempts=sync_attempts+1
 where id in (select id from public.black_presencas_evento where synced_at is null and next_sync_at<=now() and (sync_lock_until is null or sync_lock_until<now()) order by created_at limit 3 for update skip locked)
 returning *;
$$;
revoke all on function public.black_presenca_sync_claim() from public,anon,authenticated;
grant execute on function public.black_presenca_sync_claim() to service_role;
