-- Somente o coletor pode complementar origens recebidas. A comparação e a
-- escrita usam o mesmo bloqueio de linha, preservando correções concorrentes.
create function public.book_merge_webhook_origins(p_rows jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare
 candidate record;
 actual public.book_sale_attributions%rowtype;
 result jsonb:='[]'::jsonb;
 wrote boolean;
 outcome text;
begin
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>100 then
  raise exception 'Invalid origin batch';
 end if;
 for candidate in
  select * from jsonb_to_recordset(p_rows) as x(sale_id bigint,product_id integer,utm_source text,utm_medium text,utm_campaign text,utm_content text) order by sale_id
 loop
  insert into public.book_sale_attributions as old
   (sale_id,product_id,utm_source,utm_medium,utm_campaign,utm_content,origin_mode)
  values(candidate.sale_id,candidate.product_id,coalesce(candidate.utm_source,''),coalesce(candidate.utm_medium,''),coalesce(candidate.utm_campaign,''),coalesce(candidate.utm_content,''),'greenn_webhook')
  on conflict(sale_id) do update set
   product_id=coalesce(old.product_id,excluded.product_id),
   utm_source=coalesce(nullif(old.utm_source,''),excluded.utm_source),
   utm_medium=coalesce(nullif(old.utm_medium,''),excluded.utm_medium),
   utm_campaign=coalesce(nullif(old.utm_campaign,''),excluded.utm_campaign),
   utm_content=coalesce(nullif(old.utm_content,''),excluded.utm_content)
  where (old.product_id is null or old.product_id=excluded.product_id)
   and (old.utm_source='' or excluded.utm_source='' or old.utm_source=excluded.utm_source)
   and (old.utm_medium='' or excluded.utm_medium='' or old.utm_medium=excluded.utm_medium)
   and (old.utm_campaign='' or excluded.utm_campaign='' or old.utm_campaign=excluded.utm_campaign)
   and (old.utm_content='' or excluded.utm_content='' or old.utm_content=excluded.utm_content)
   and (old.product_id is null or (old.utm_source='' and excluded.utm_source<>'') or (old.utm_medium='' and excluded.utm_medium<>'') or (old.utm_campaign='' and excluded.utm_campaign<>'') or (old.utm_content='' and excluded.utm_content<>''));
  wrote:=found;
  select * into strict actual from public.book_sale_attributions where sale_id=candidate.sale_id;
  outcome:=case when wrote then 'saved'
   when actual.product_id is distinct from candidate.product_id
    or (actual.utm_source<>'' and coalesce(candidate.utm_source,'')<>'' and actual.utm_source<>candidate.utm_source)
    or (actual.utm_medium<>'' and coalesce(candidate.utm_medium,'')<>'' and actual.utm_medium<>candidate.utm_medium)
    or (actual.utm_campaign<>'' and coalesce(candidate.utm_campaign,'')<>'' and actual.utm_campaign<>candidate.utm_campaign)
    or (actual.utm_content<>'' and coalesce(candidate.utm_content,'')<>'' and actual.utm_content<>candidate.utm_content)
   then 'conflict' else 'unchanged' end;
  result:=result||jsonb_build_array((to_jsonb(actual)-'updated_by'-'updated_at')||jsonb_build_object('outcome',outcome));
 end loop;
 return result;
end $$;
revoke all on function public.book_merge_webhook_origins(jsonb) from public,anon,authenticated;
grant execute on function public.book_merge_webhook_origins(jsonb) to service_role;
notify pgrst,'reload schema';
