-- Executar inteiro. Fixtures reversíveis; não cria usuários nem pagamentos.
begin;
select set_config('book_test.admin',(select user_id::text from public.app_admins limit 1),true);
insert into public.book_publications(media_id,title) values('99999999999999999999','Fixture RLS');
set local role anon;
do $$begin
 begin perform * from public.book_publications; raise exception 'Anon leu dados';
 exception when insufficient_privilege then null; end;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.book_publications) then raise exception 'Membro leu dados';end if;
 if exists(select 1 from public.book_dashboard_snapshots) then raise exception 'Membro leu métricas';end if;
 if exists(select 1 from public.book_sale_attributions) then raise exception 'Membro leu origens';end if;
 begin insert into public.book_sale_attributions(sale_id,origin_mode) values(90000000000000,'greenn_csv');raise exception 'Membro escreveu';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('book_test.admin'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if not public.is_admin() then raise exception 'Fixture admin ausente';end if;
 if not exists(select 1 from public.book_publications where media_id='99999999999999999999') then raise exception 'Admin não leu';end if;
 insert into public.book_sale_attributions(sale_id,product_id,utm_source,utm_content,origin_mode) values(90000000000000,199893,'ig','direct-post-123456','greenn_csv') on conflict(sale_id) do update set sale_id=excluded.sale_id,product_id=excluded.product_id,utm_source=excluded.utm_source,utm_content=excluded.utm_content,origin_mode=excluded.origin_mode;
 insert into public.book_sale_attributions(sale_id,utm_source,origin_mode) values(90000000000000,'ig','greenn_csv') on conflict(sale_id) do update set sale_id=excluded.sale_id,utm_source=excluded.utm_source,origin_mode=excluded.origin_mode;
 if (select updated_by is distinct from auth.uid() from public.book_sale_attributions where sale_id=90000000000000) then raise exception 'Auditoria incorreta';end if;
 begin update public.book_sale_attributions set updated_at='2000-01-01' where sale_id=90000000000000;raise exception 'Admin alterou auditoria';exception when insufficient_privilege then null;end;
 begin insert into public.book_sale_attributions(sale_id,origin_mode) values(90000000000001,'greenn_webhook');raise exception 'Admin forjou webhook';exception when insufficient_privilege then null;end;
 begin insert into public.book_dashboard_snapshots(source) values('ga4');raise exception 'Admin alterou métricas';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
select 'anon_member_admin_passed' as result;
