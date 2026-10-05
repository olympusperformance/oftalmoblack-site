-- Voz do bot por conta de Instagram (05/10/2026).
--
-- Até aqui bot_exemplos e bot_respostas eram só do @dralexsa. Com a IA de
-- comentários chegando ao @drjoaocoelho, cada conta precisa da própria voz: o
-- exemplo que ensina o Alex não pode ensinar o João, e a fila de um não pode
-- aparecer na tela do outro.
--
-- O que já existe vira 'dralexsa' pelo default, e a função antiga
-- (bot_exemplos_parecidos, chamada pelo roteador do Alex) passa a ler só a conta
-- dele, sem mudar de assinatura: o n8n do Alex não precisa ser tocado.
begin;

alter table public.bot_exemplos  add column if not exists conta text not null default 'dralexsa';
alter table public.bot_respostas add column if not exists conta text not null default 'dralexsa';
create index if not exists bot_exemplos_conta_grupo_idx on public.bot_exemplos (conta, grupo) where ativo;

create or replace function public.bot_exemplos_da_conta(p_conta text, p_texto text, p_grupo text default null, p_quantos integer default 4)
returns table(comentario text, resposta text, forca real)
language sql stable as $$
  with consulta as (
    select plainto_tsquery('portuguese', coalesce(p_texto, '')) as q
  )
  select e.comentario, e.resposta,
         ts_rank(to_tsvector('portuguese', e.comentario), c.q) as forca
    from public.bot_exemplos e, consulta c
   where e.ativo
     and e.conta = p_conta
     and e.resposta is not null and btrim(e.resposta) <> ''
     and (p_grupo is null or e.grupo = p_grupo)
   order by forca desc, e.criado_em desc
   limit greatest(p_quantos, 1);
$$;

create or replace function public.bot_exemplos_parecidos(p_texto text, p_grupo text default null, p_quantos integer default 4)
returns table(comentario text, resposta text, forca real)
language sql stable as $$
  select * from public.bot_exemplos_da_conta('dralexsa', p_texto, p_grupo, p_quantos);
$$;

-- Aprovar uma resposta a transforma em exemplo da MESMA conta.
create or replace function public.bot_virar_exemplo(p_id uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare
  r public.bot_respostas%rowtype;
  novo_id uuid;
begin
  if not public.is_admin() then
    raise exception 'só admin';
  end if;
  select * into r from public.bot_respostas where id = p_id;
  if not found then
    raise exception 'resposta não encontrada';
  end if;
  if r.decisao is not null then
    return r.exemplo_id;   -- já decidida, não duplica
  end if;
  insert into public.bot_exemplos (grupo, comentario, resposta, origem, conta)
  values (coalesce(r.grupo, 'outro'), r.comentario, r.resposta, 'bot aprovado', r.conta)
  returning id into novo_id;
  update public.bot_respostas
     set decisao = 'exemplo', exemplo_id = novo_id, decidido = now()
   where id = p_id;
  return novo_id;
end $function$;

commit;
