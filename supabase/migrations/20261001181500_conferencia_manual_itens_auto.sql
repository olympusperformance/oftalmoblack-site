-- A equipe passa a conferir qualquer item do checklist, inclusive os AUTO:
-- só 2 dos 26 itens AUTO têm leitura de integração, e os outros travavam D03, D05 e D06.
CREATE OR REPLACE FUNCTION cerebro_private.checklist_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.cb_checklist_catalog;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Somente a equipe pode conferir itens'; end if;
 select * into strict c from public.cb_checklist_catalog where id=new.item_id;
 if tg_op='UPDATE' and (new.member_id<>old.member_id or new.item_id<>old.item_id or new.edition<>old.edition) then
  raise exception 'Não é permitido transferir o registro';
 end if;
 if not exists(select 1 from public.members where id=new.member_id and ativo) then raise exception 'Membro inativo ou inexistente'; end if;
 if c.monthly then
  if new.edition !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then raise exception 'Selecione a edição'; end if;
  if not exists(select 1 from public.cb_encontros where member_id=new.member_id and edition=new.edition::date) then raise exception 'Edição não cadastrada para este membro'; end if;
 elsif new.edition<>'' then raise exception 'Este item não usa edição mensal';
 end if;
 new.updated_by=auth.uid();new.updated_at=now();
 select s.nome into new.actor_name from public.staff s where s.user_id=auth.uid() and s.ativo order by s.id limit 1;
 new.actor_name=coalesce(new.actor_name,'Equipe Black');
 return new;
end$function$;
