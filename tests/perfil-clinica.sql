begin;
do $$
declare v_id uuid:=gen_random_uuid(); payload jsonb; got text;
begin
 if has_table_privilege('anon','public.black_perfis_clinica','select') or has_table_privilege('authenticated','public.black_perfis_clinica','insert') then raise exception 'cadastros expostos'; end if;
 if has_function_privilege('anon','public.black_perfil_receber(jsonb,text,text)','execute') then raise exception 'RPC pública'; end if;
 payload:=jsonb_build_object('id',v_id,'nome','QA técnico','email','qa@example.invalid','whatsapp','+5592999990000','lentes_premium',false,'volume_lentes',null,'faturamento','ate_50','desafios',jsonb_build_array('atrair_particulares','equipe_processos'),'outro_desafio',null,'origem','direto','utm','{}'::jsonb,'pagina','/perfil-clinica/');
 got:=public.black_perfil_receber(payload,'fixture-hash','fixture-network');
 if got<>'created' then raise exception 'primeiro recebimento: %',got; end if;
 got:=public.black_perfil_receber(payload,'fixture-hash','fixture-network');
 if got<>'existing' then raise exception 'reenvio duplicado: %',got; end if;
 got:=public.black_perfil_receber(payload,'different-hash','fixture-network');
 if got<>'conflict' then raise exception 'sobrescrita permitida'; end if;
 if (select count(*) from public.black_perfis_clinica where id=v_id)<>1 then raise exception 'contagem inválida'; end if;
 if (select cardinality(desafios) from public.black_perfis_clinica where id=v_id)<>2 then raise exception 'perdeu múltipla escolha'; end if;
end $$;
rollback;
select 'isolamento, idempotência e múltipla escolha verificados; fixture revertida' as resultado;
