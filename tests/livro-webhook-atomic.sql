-- Fixtures reversíveis. Não cria pedidos ou usuários.
begin;
insert into public.book_sale_attributions(sale_id,product_id,utm_source,utm_content,origin_mode)
values(90000000000002,199893,'ig','direct-post-123457','greenn_csv');
set local role service_role;
do $$declare result jsonb;stamp timestamptz;begin
 -- Candidato lido antes da correção CSV, decisão contra o estado atual do banco.
 result:=public.book_merge_webhook_origins('[{"sale_id":90000000000002,"product_id":199893,"utm_source":"ig","utm_content":"direct-post-123456"}]');
 if result->0->>'outcome'<>'conflict' or result->0->>'utm_content'<>'direct-post-123457' then raise exception 'Correção concorrente perdida';end if;
 if (select utm_content from public.book_sale_attributions where sale_id=90000000000002)<>'direct-post-123457' then raise exception 'Origem manual sobrescrita';end if;
 result:=public.book_merge_webhook_origins('[{"sale_id":90000000000002,"product_id":199893,"utm_source":"ig","utm_medium":"social","utm_content":"direct-post-123457"}]');
 if result->0->>'utm_medium'<>'social' or result->0->>'origin_mode'<>'greenn_csv' then raise exception 'Complemento perdeu proveniência';end if;
 select updated_at into stamp from public.book_sale_attributions where sale_id=90000000000002;
 result:=public.book_merge_webhook_origins('[{"sale_id":90000000000002,"product_id":199893,"utm_source":"ig","utm_medium":"social","utm_content":"direct-post-123457"}]');
 if result->0->>'outcome'<>'unchanged' or (select updated_at from public.book_sale_attributions where sale_id=90000000000002) is distinct from stamp then raise exception 'Replay alterou auditoria';end if;
 result:=public.book_merge_webhook_origins('[{"sale_id":90000000000003,"product_id":199893,"utm_source":"ig","utm_content":"direct-post-123456"}]');
 if result->0->>'origin_mode'<>'greenn_webhook' or result->0->>'outcome'<>'saved' then raise exception 'Origem nova não salva';end if;
end$$;
reset role;
set local role authenticated;
do $$begin
 begin perform public.book_merge_webhook_origins('[]');raise exception 'Frontend executou RPC';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role anon;
do $$begin
 begin perform public.book_merge_webhook_origins('[]');raise exception 'Anon executou RPC';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
select 'atomic_merge_and_permissions_passed' as result;
