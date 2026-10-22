begin;
do $$
declare p jsonb; n integer; r text; m record; original_id uuid; lease timestamptz;
begin
 if has_table_privilege('anon','public.black_presencas_evento','SELECT') or has_table_privilege('authenticated','public.black_presencas_evento','INSERT') then raise exception 'public attendance table privilege'; end if;
 if has_function_privilege('anon','public.black_presenca_receber(jsonb,text,text,uuid)','EXECUTE') then raise exception 'public attendance RPC privilege'; end if;
 p=jsonb_build_object('id',gen_random_uuid(),'evento','qa-transaction','email','qa-transaction@example.invalid','origem','presencial','utm','{}'::jsonb,'pagina','/perfil-clinica/nivel-1/');
 r=public.black_presenca_receber(p,'qa-hash','qa-network');if r<>'created' then raise exception 'expected created';end if;
 r=public.black_presenca_receber(p,'qa-hash','qa-network');if r<>'existing' then raise exception 'expected retry';end if;
 r=public.black_presenca_receber(p,'changed','qa-network');if r<>'conflict' then raise exception 'expected conflict';end if;
 p=jsonb_set(p,'{id}',to_jsonb(gen_random_uuid()::text));
 r=public.black_presenca_receber(p,'new-request','qa-network');if r<>'existing' then raise exception 'expected email dedup';end if;
 select count(*) into n from public.black_presencas_evento where evento='qa-transaction';if n<>1 then raise exception 'duplicate attendance';end if;
 r=public.black_presenca_receber(p,'new-request','qa-network',gen_random_uuid());if r<>'identity_required' then raise exception 'unknown user accepted';end if;
 select id,user_id,email into m from public.members where ativo and user_id is not null limit 1;
 if found then
   original_id=gen_random_uuid();lease=now()+interval '3 minutes';
   p=jsonb_build_object('id',original_id,'evento','qa-auth-upgrade','email',m.email,'origem','presencial','utm','{}'::jsonb,'pagina','/perfil-clinica/nivel-1/');
   r=public.black_presenca_receber(p,'self-report','qa-network');if r<>'created' then raise exception 'self report missing';end if;
   update public.black_presencas_evento set sync_lock_until=lease,synced_at=now() where id=original_id;
   p=jsonb_set(p,'{id}',to_jsonb(gen_random_uuid()::text));
   r=public.black_presenca_receber(p,'auth-upgrade','qa-network',m.user_id);if r<>'existing' then raise exception 'upgrade duplicated';end if;
   select count(*) into n from public.black_presencas_evento where id=original_id and identificacao='sessao_autenticada' and member_id=m.id and revision=2 and synced_at is null and sync_lock_until=lease;
   if n<>1 then raise exception 'upgrade lost revision/lease/identity';end if;
   update public.black_presencas_evento set synced_at=now(),sync_lock_until=null where id=original_id and revision=1;
   if found then raise exception 'stale worker could ACK new revision';end if;
 end if;
end $$;
rollback;
