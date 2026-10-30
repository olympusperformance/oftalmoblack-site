-- A entrada guarda o fechamento inteiro, como vem no grupo Fechamentos Olympus:
-- participante, contratante (quando é pessoa jurídica) e pagamento.
-- Nenhuma entrada tinha sido aberta com o formato anterior.

alter table public.cb_entradas
  drop column cpf, drop column whatsapp, drop column cidade, drop column pagamento,
  add column fechamento jsonb not null default '{}'::jsonb;

drop function public.cb_entrada_abrir(uuid,text,text,text,text);

create or replace function public.cb_entrada_abrir(p_member uuid, p_fechamento jsonb)
returns void language plpgsql security definer set search_path to '' as $$
declare nome text;
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Entre novamente.'; end if;
  if not public.is_admin() then raise exception 'Somente a equipe abre a entrada de um mentorado.'; end if;
  if jsonb_typeof(coalesce(p_fechamento,'{}'::jsonb)) <> 'object' then raise exception 'Dados do fechamento inválidos.'; end if;
  select st.nome into nome from public.staff st where st.user_id = auth.uid() and st.ativo order by st.id limit 1;
  insert into public.cb_entradas (member_id, fechamento, criado_por)
  values (p_member, coalesce(p_fechamento,'{}'::jsonb), auth.uid())
  on conflict (member_id) do update set fechamento = excluded.fechamento;
  insert into public.cb_entrada_progresso (member_id, passo_id, feito_por, ator)
  values (p_member, 'fechamento', auth.uid(), coalesce(nome,'Equipe Black')),
         (p_member, 'dados', auth.uid(), coalesce(nome,'Equipe Black'))
  on conflict do nothing;
end $$;

revoke all on function public.cb_entrada_abrir(uuid,jsonb) from public, anon;
grant execute on function public.cb_entrada_abrir(uuid,jsonb) to authenticated;
