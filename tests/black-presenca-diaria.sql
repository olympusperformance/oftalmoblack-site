begin;
do $$
declare p jsonb; original_p jsonb; r jsonb; n integer; original_id uuid; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 if has_function_privilege('anon','public.black_presenca_receber_v2(jsonb,text,text,uuid)','EXECUTE') or has_table_privilege('anon','public.black_presencas_evento','SELECT') then raise exception 'public attendance exposure'; end if;
 original_id=gen_random_uuid();
 p=jsonb_build_object('id',original_id,'evento','qa-diario','nome','Dr. QA Teste Diário','origem','presencial','utm','{}'::jsonb,'pagina','/perfil-clinica/nivel-1/','day','1999-01-01');original_p=p;
 r=public.black_presenca_receber_v2(p,'original','qa-daily-network');
 if r->>'status'<>'created' or (r->>'day')::date<>hoje then raise exception 'server day missing';end if;
 if not exists(select 1 from public.black_presencas_evento where id=original_id and email is null and nome='Dr. QA Teste Diário' and identificacao='nome_informado' and dia_presenca=hoje) then raise exception 'name receipt missing';end if;
 p=jsonb_set(jsonb_set(p,'{id}',to_jsonb(gen_random_uuid()::text)),'{nome}',to_jsonb('  QA Teste Diario  '::text));
 r=public.black_presenca_receber_v2(p,'same-day-new-id','qa-daily-network');if r->>'status'<>'existing' then raise exception 'same day name duplicated';end if;
 select count(*) into n from public.black_presencas_evento where evento='qa-diario';if n<>1 then raise exception 'same-day count';end if;
 -- Simula registro de ontem, sem depender do relógio/consulta do navegador.
 update public.black_presencas_evento set dia_presenca=hoje-1 where id=original_id;
 r=public.black_presenca_receber_v2(p,'same-day-new-id','qa-daily-network');if r->>'status'<>'existing' or (r->>'day')::date<>hoje-1 then raise exception 'deduplicated retry lost original day';end if;
 p=jsonb_set(p,'{id}',to_jsonb(gen_random_uuid()::text));
 r=public.black_presenca_receber_v2(p,'next-day-new-id','qa-daily-network');if r->>'status'<>'created' or (r->>'day')::date<>hoje then raise exception 'next day rejected';end if;
 select count(*) into n from public.black_presencas_evento where evento='qa-diario';if n<>2 then raise exception 'daily count';end if;
 r=public.black_presenca_receber_v2(original_p,'original','qa-daily-network');if r->>'status'<>'existing' or (r->>'day')::date<>hoje-1 then raise exception 'retry after midnight changed receipt day';end if;
 if public.black_presenca_nome_chave('Dra.   María SÁ')<>'maria sa' then raise exception 'name normalization';end if;
 if public.black_presenca_nome_chave('DRA.   MARÍA SÁ')<>'maria sa' then raise exception 'uppercase accent normalization';end if;
end $$;
rollback;
