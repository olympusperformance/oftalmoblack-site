-- PostgREST inclui a PK na cláusula UPDATE do upsert, mesmo sem mudá-la.
grant update(sale_id) on public.book_sale_attributions to authenticated;
notify pgrst,'reload schema';
