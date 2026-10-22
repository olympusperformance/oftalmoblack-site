-- Presença diária autodeclarada por nome para o evento presencial.
-- Não altera graduação ou as tabelas de frequência do método.
create function public.black_presenca_nome_chave(p_nome text)
returns text language sql immutable strict security invoker set search_path='' as $$
 select regexp_replace(regexp_replace(translate(lower(trim(p_nome)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[[:space:]]+',' ','g'),'^(dr|dra)\.?[[:space:]]+','','i');
$$;
revoke all on function public.black_presenca_nome_chave(text) from public,anon,authenticated;
grant execute on function public.black_presenca_nome_chave(text) to service_role;

alter table public.black_presencas_evento add column dia_presenca date;
update public.black_presencas_evento set dia_presenca=(created_at at time zone 'America/Sao_Paulo')::date;
alter table public.black_presencas_evento alter column dia_presenca set default ((now() at time zone 'America/Sao_Paulo')::date);
alter table public.black_presencas_evento alter column dia_presenca set not null;
alter table public.black_presencas_evento alter column email drop not null;
alter table public.black_presencas_evento drop constraint black_presencas_evento_identificacao_check;
alter table public.black_presencas_evento add constraint black_presencas_evento_identificacao_check check (identificacao in ('email_informado','sessao_autenticada','nome_informado'));
alter table public.black_presencas_evento add constraint black_presenca_identidade_check check (
 case when identificacao='nome_informado' then nome is not null and length(public.black_presenca_nome_chave(nome)) between 2 and 160
 else email is not null end
);
alter table public.black_presencas_evento add column identity_key text;
update public.black_presencas_evento set identity_key=(
 case when member_id is not null then 'member:'||member_id::text
 when email is not null then 'email:'||email
 else 'nome:'||public.black_presenca_nome_chave(nome) end
);
alter table public.black_presencas_evento alter column identity_key set not null;
alter table public.black_presencas_evento drop constraint black_presencas_evento_evento_email_key;
alter table public.black_presencas_evento add constraint black_presenca_diaria_key unique(evento,dia_presenca,identity_key);

-- Cada tentativa confirmada mantém seu recibo, mesmo quando deduplicada.
-- Retry após meia-noite continua apontando à presença do dia original.
create table public.black_presenca_recibos (
 id uuid primary key,
 presenca_id uuid not null references public.black_presencas_evento(id) on delete cascade,
 payload_hash text not null,
 request_hash text not null,
 created_at timestamptz not null default now()
);
alter table public.black_presenca_recibos enable row level security;
revoke all on public.black_presenca_recibos from public,anon,authenticated;
grant select,insert,update,delete on public.black_presenca_recibos to service_role;
create index black_presenca_recibo_presenca on public.black_presenca_recibos(presenca_id);
create index black_presenca_recibo_rate on public.black_presenca_recibos(request_hash,created_at);
insert into public.black_presenca_recibos(id,presenca_id,payload_hash,request_hash) select id,id,payload_hash,request_hash from public.black_presencas_evento;

create function public.black_presenca_receber_v2(p_payload jsonb,p_hash text,p_ip_hash text,p_user_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_email text; v_member uuid; v_nome text; v_metodo text; v_chave text;
 v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
 v_row public.black_presencas_evento; v_hash text;
begin
 perform pg_advisory_xact_lock(hashtextextended('presenca-id:'||(p_payload->>'id'),0));
 perform pg_advisory_xact_lock(hashtextextended('presenca-ip:'||p_ip_hash,0));
 select r.payload_hash,p.dia_presenca into v_hash,v_dia from public.black_presenca_recibos r join public.black_presencas_evento p on p.id=r.presenca_id where r.id=(p_payload->>'id')::uuid;
 if found then
   if v_hash=p_hash then return jsonb_build_object('status','existing','day',v_dia); else return jsonb_build_object('status','conflict'); end if;
 end if;
 v_dia := (now() at time zone 'America/Sao_Paulo')::date;
 if (select count(*) from public.black_presenca_recibos where request_hash=p_ip_hash and created_at>now()-interval '1 hour')>=500 then return jsonb_build_object('status','rate_limit'); end if;
 if p_user_id is not null then
   select id,lower(trim(email)),nome into v_member,v_email,v_nome from public.members where user_id=p_user_id and ativo=true;
   if not found then return jsonb_build_object('status','identity_required'); end if;
   v_metodo := 'sessao_autenticada';
 elsif nullif(trim(p_payload->>'nome'),'') is not null then
   v_nome := regexp_replace(trim(p_payload->>'nome'),'[[:space:]]+',' ','g');
   if length(v_nome)>160 or length(public.black_presenca_nome_chave(v_nome))<2 then return jsonb_build_object('status','identity_required'); end if;
   -- Associação somente quando o nome completo normalizado é único na base ativa.
   -- Não comprova identidade e não publica nomes/cadastros ao navegador.
   select min(id::text)::uuid into v_member from public.members where ativo=true and public.black_presenca_nome_chave(nome)=public.black_presenca_nome_chave(v_nome) having count(*)=1;
   v_metodo := 'nome_informado';
 else
   v_email := lower(trim(p_payload->>'email'));
   if v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return jsonb_build_object('status','identity_required'); end if;
   select min(id::text)::uuid,min(nome) into v_member,v_nome from public.members where lower(trim(email))=v_email and ativo=true having count(*)=1;
   v_metodo := 'email_informado';
 end if;
 v_chave := case when v_member is not null then 'member:'||v_member::text when v_email is not null then 'email:'||v_email else 'nome:'||public.black_presenca_nome_chave(v_nome) end;
 perform pg_advisory_xact_lock(hashtextextended('presenca-dia:'||(p_payload->>'evento')||':'||v_dia::text||':'||v_chave,0));
 select * into v_row from public.black_presencas_evento where evento=p_payload->>'evento' and dia_presenca=v_dia and identity_key=v_chave for update;
 if found then
   if v_metodo='sessao_autenticada' and v_row.identificacao<>'sessao_autenticada' then
     update public.black_presencas_evento set identificacao=v_metodo,member_id=v_member,nome=v_nome,email=v_email,revision=revision+1,synced_at=null,next_sync_at=now() where id=v_row.id;
   end if;
   insert into public.black_presenca_recibos(id,presenca_id,payload_hash,request_hash) values((p_payload->>'id')::uuid,v_row.id,p_hash,p_ip_hash);
   return jsonb_build_object('status','existing','day',v_row.dia_presenca);
 end if;
 if (select count(*) from public.black_presencas_evento where request_hash=p_ip_hash and created_at>now()-interval '1 hour')>=500 then return jsonb_build_object('status','rate_limit'); end if;
 insert into public.black_presencas_evento(id,evento,email,member_id,nome,identificacao,origem,utm,pagina,payload_hash,request_hash,dia_presenca,identity_key)
 values((p_payload->>'id')::uuid,p_payload->>'evento',v_email,v_member,v_nome,v_metodo,p_payload->>'origem',p_payload->'utm',p_payload->>'pagina',p_hash,p_ip_hash,v_dia,v_chave);
 insert into public.black_presenca_recibos(id,presenca_id,payload_hash,request_hash) values((p_payload->>'id')::uuid,(p_payload->>'id')::uuid,p_hash,p_ip_hash);
 return jsonb_build_object('status','created','day',v_dia);
end;
$$;
revoke all on function public.black_presenca_receber_v2(jsonb,text,text,uuid) from public,anon,authenticated;
grant execute on function public.black_presenca_receber_v2(jsonb,text,text,uuid) to service_role;

-- Mantém compatibilidade do receptor anterior durante a publicação.
create or replace function public.black_presenca_receber(p_payload jsonb,p_hash text,p_ip_hash text,p_user_id uuid default null)
returns text language sql security invoker set search_path='' as $$
 select public.black_presenca_receber_v2(p_payload,p_hash,p_ip_hash,p_user_id)->>'status';
$$;
