-- Integração transacional: nenhum fixture chega ao cron, planilha ou notificações.
begin;
do $$
declare
 m uuid; other_member uuid; p jsonb; r jsonb; first_id uuid:=gen_random_uuid();
 alias_name text:='QA Alias Confirmado '||gen_random_uuid()::text;
 ev text:='qa-alias-'||gen_random_uuid()::text;
begin
 select id into m from public.members where ativo=true order by id limit 1;
 select id into other_member from public.members where ativo=true and id<>m order by id limit 1;
 if m is null or other_member is null then raise exception 'fixtures need two active members'; end if;
 if has_table_privilege('anon','public.black_presenca_nome_aliases','SELECT')
 or has_table_privilege('authenticated','public.black_presenca_mesclagens','SELECT')
 or has_function_privilege('anon','public.black_presenca_resolver_membro(text,text)','EXECUTE') then raise exception 'alias/audit exposure'; end if;
 insert into public.black_presenca_nome_aliases(evento,nome_chave,member_id,motivo)
 values(ev,public.black_presenca_nome_chave(alias_name),m,'Fixture transacional');
 p:=jsonb_build_object('id',first_id,'evento',ev,'nome',alias_name,'origem','presencial','utm','{}'::jsonb,'pagina','/perfil-clinica/nivel-1/');
 r:=public.black_presenca_receber_v2(p,'alias-first','qa-alias-test');
 if r->>'status'<>'created' or not exists(select 1 from public.black_presencas_evento where id=first_id and member_id=m) then raise exception 'confirmed alias was not linked'; end if;
 -- Confirmação do nome de cadastro deve cair na mesma presença do alias.
 p:=jsonb_set(jsonb_set(p,'{id}',to_jsonb(gen_random_uuid()::text)),'{nome}',to_jsonb((select nome from public.members where id=m)));
 r:=public.black_presenca_receber_v2(p,'alias-second','qa-alias-test');
 if r->>'status'<>'existing' or (select count(*) from public.black_presencas_evento where evento=ev)<>1 then raise exception 'manual/form name duplicated'; end if;
 if (select count(*) from public.black_presenca_recibos where presenca_id=first_id)<>2 then raise exception 'receipt history lost'; end if;
 -- A equivalência é do evento, não uma mudança global de cadastro.
 if public.black_presenca_resolver_membro(ev||'-other',alias_name) is not null then raise exception 'alias leaked to another event'; end if;
 if public.black_presenca_resolver_membro(ev,alias_name||' Outro') is not null then raise exception 'fuzzy name match'; end if;
 -- Colisão com nome de outro membro exige conferência, nunca associação forçada.
 insert into public.black_presenca_nome_aliases(evento,nome_chave,member_id,motivo)
 values(ev,public.black_presenca_nome_chave((select nome from public.members where id=other_member)),m,'Fixture de colisão');
 if public.black_presenca_resolver_membro(ev,(select nome from public.members where id=other_member)) is not null then raise exception 'ambiguous alias assigned to a person'; end if;
 -- Outro dia continua sendo outra presença, com o mesmo cadastro.
 update public.black_presencas_evento set dia_presenca=dia_presenca-1 where id=first_id;
 p:=jsonb_set(p,'{id}',to_jsonb(gen_random_uuid()::text));
 r:=public.black_presenca_receber_v2(p,'alias-next-day','qa-alias-test');
 if r->>'status'<>'created' or (select count(*) from public.black_presencas_evento where evento=ev)<>2 then raise exception 'next day attendance blocked'; end if;
end $$;
rollback;
