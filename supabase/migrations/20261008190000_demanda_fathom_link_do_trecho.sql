-- Demanda criada a partir do Fathom leva, em cada trecho de evidência, o link
-- que abre a gravação no momento da fala (?timestamp=segundos).
create or replace function public.fathom_segundos(p text) returns text
language sql immutable set search_path='' as $$
 select case when p ~ '^\d{1,2}(:\d{2}){1,2}$' then
   (select sum(v::int * power(60, n - i))::int::text
      from unnest(string_to_array(p, ':')) with ordinality t(v, i),
           (select array_length(string_to_array(p, ':'), 1) n) c)
 end
$$;

create or replace function public.fathom_action_sync() returns trigger language plpgsql security invoker set search_path='' as $$
declare d public.demands; v_id uuid; v_description text;
begin
 if tg_op='UPDATE' and old.status in ('approved','linked') then
   raise exception 'Esta ação já foi vinculada ao quadro. Edite a demanda existente.';
 end if;
 if new.status in ('approved','linked') then
   if new.disposition<>'pending' or new.staff_id is null or not exists(select 1 from public.staff s where s.id=new.staff_id and s.ativo) then
     raise exception 'Aprovação exige pendência e integrante ativo.';
   end if;
   perform pg_advisory_xact_lock(726284871);
   if new.demand_id is not null then
     select * into d from public.demands where id=new.demand_id for update;
     if not found or d.member_id is distinct from new.member_id or not coalesce(new.staff_id=any(d.responsaveis),false) then
       raise exception 'Demanda equivalente incompatível com responsável ou mentorado.';
     end if;
     new.status='linked';
   else
     -- Exact retry/same-meeting match; semantic matches come from the review.
     select id into v_id from public.demands
      where member_id is not distinct from new.member_id and new.staff_id=any(responsaveis)
        and lower(trim(titulo))=lower(trim(new.titulo)) and origem='Fathom · '||new.source_url limit 1;
     if v_id is not null then new.demand_id=v_id;new.status='linked';
     else
       v_description=new.reason||E'\n\nReunião: '||new.meeting_title||E'\nGravação: '||new.source_url||E'\n\nTrechos da conversa (o link abre a gravação no momento da fala):\n'||
         (select string_agg(coalesce(e->>'speaker_name','Falante')
           ||coalesce(' ('||(e->>'timestamp')||')','')||': “'||(e->>'quote')||'”'
           ||coalesce(E'\n'||new.source_url||'?timestamp='||public.fathom_segundos(e->>'timestamp'),''),E'\n\n')
          from jsonb_array_elements(new.evidence)e);
       insert into public.demands(titulo,descricao,responsaveis,member_id,origem,status)
        values(new.titulo,v_description,array[new.staff_id],new.member_id,'Fathom · '||new.source_url,'A fazer') returning id into new.demand_id;
       new.status='approved';
     end if;
   end if;
   new.approved_at=now();new.decided_by=auth.uid();
 else
   if new.demand_id is not null then raise exception 'Contexto/pendência de identificação não pode conter demanda.';end if;
   new.staff_id=null;
 end if;
 new.history=coalesce(case when tg_op='UPDATE' then old.history else '[]'::jsonb end,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',now(),'by',auth.uid(),'status',new.status,'staff_id',new.staff_id,'member_id',new.member_id,'demand_id',new.demand_id));
 return new;
end $$;
