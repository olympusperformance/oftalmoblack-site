-- Entrada do novo mentorado: do fechamento até a CS encerrar a integração.
-- Trilha validada com o Felipe em 30/10/2026 (output/2026-10-30-trilha-entrada-mentorado.md).
-- Um checklist por mentorado, só da equipe. Quem já estava no Club entra com tudo marcado.

create table public.cb_entrada_passos (
  id text primary key,
  position int not null unique,
  fase text not null check (fase in ('fechamento','administrativo','integracao','encontros','pos')),
  dono text not null,
  titulo text not null,
  acao text check (acao in ('grupo','convite','perfil','prediagnostico','area'))
);

-- Dados do fechamento que não cabem em members (o e-mail e o nome já moram lá).
create table public.cb_entradas (
  member_id uuid primary key references public.members(id) on delete cascade,
  cpf text,
  whatsapp text,
  cidade text,
  pagamento text,
  criado_em timestamptz not null default now(),
  criado_por uuid
);

create table public.cb_entrada_progresso (
  member_id uuid not null references public.members(id) on delete cascade,
  passo_id text not null references public.cb_entrada_passos(id),
  feito_em timestamptz not null default now(),
  feito_por uuid,
  ator text,
  primary key (member_id, passo_id)
);

alter table public.cb_entrada_passos    enable row level security;
alter table public.cb_entradas          enable row level security;
alter table public.cb_entrada_progresso enable row level security;
grant select on public.cb_entrada_passos, public.cb_entradas, public.cb_entrada_progresso to authenticated;
create policy entrada_passos_read on public.cb_entrada_passos for select to authenticated using ((select public.is_admin()));
create policy entradas_read on public.cb_entradas for select to authenticated using ((select public.is_admin()));
create policy entrada_progresso_read on public.cb_entrada_progresso for select to authenticated using ((select public.is_admin()));

insert into public.cb_entrada_passos (id, position, fase, dono, titulo, acao) values
  ('fechamento',        1, 'fechamento',     'Dr. Alex', 'Reunião de vendas realizada e fechamento', null),
  ('dados',             2, 'fechamento',     'Jean',     'Dados básicos enviados no grupo Fechamentos Olympus', null),
  ('pagamento',         3, 'administrativo', 'Jean',     'Primeiro pagamento e data dos próximos boletos negociados', null),
  ('cobranca',          4, 'administrativo', 'Carol',    'Link de cartão ou boletos emitidos', null),
  ('contrato',          5, 'administrativo', 'Carol',    'Contrato da MLS enviado e assinado', null),
  ('plataformas',       6, 'integracao',     'Felipe',   'Cadastro no Cérebro Black e na Greenn', 'area'),
  ('grupo',             7, 'integracao',     'Felipe',   'Grupo operacional criado: foto padrão, descrição com o link de agendamento e integrantes padrão', 'grupo'),
  ('convite',           8, 'integracao',     'Felipe',   'Convite para o onboarding de segunda, 20h, com o link do diagnóstico, e presença confirmada', 'convite'),
  ('revisao_venda',     9, 'integracao',     'Felipe',   'Reunião de vendas revisada, se houver gravação', null),
  ('pesquisa',         10, 'integracao',     'Felipe',   'Pesquisa pública registrada no perfil: Instagram, Google, site, domínio e cidade', 'perfil'),
  ('formulario',       11, 'integracao',     'Felipe',   'Formulário individual enviado, só com as lacunas do perfil', 'prediagnostico'),
  ('apresentacao',     12, 'integracao',     'Felipe',   'Apresentação de diagnóstico montada', null),
  ('onboarding',       13, 'encontros',      'Dr. Alex', 'Participou do onboarding em grupo de segunda, 20h', null),
  ('diagnostico',      14, 'encontros',      'Felipe',   'Reunião de Diagnóstico realizada e D01 marcado na Subida', 'area'),
  ('reunioes',         15, 'pos',            'Felipe',   'Indicadas as reuniões de Growth, Sistema e Conteúdo que fizerem sentido', null),
  ('encerramento',     16, 'pos',            'CS',       'CS conferiu o checklist e encerrou a integração', null);

-- Abre a entrada de um mentorado recém-cadastrado. Fechamento e dados já
-- aconteceram quando alguém cadastra, por isso nascem marcados.
create or replace function public.cb_entrada_abrir(p_member uuid, p_cpf text, p_whatsapp text, p_cidade text, p_pagamento text)
returns void language plpgsql security definer set search_path to '' as $$
declare nome text;
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Entre novamente.'; end if;
  if not public.is_admin() then raise exception 'Somente a equipe abre a entrada de um mentorado.'; end if;
  select st.nome into nome from public.staff st where st.user_id = auth.uid() and st.ativo order by st.id limit 1;
  insert into public.cb_entradas (member_id, cpf, whatsapp, cidade, pagamento, criado_por)
  values (p_member, nullif(trim(p_cpf),''), nullif(trim(p_whatsapp),''), nullif(trim(p_cidade),''), nullif(trim(p_pagamento),''), auth.uid())
  on conflict (member_id) do update set cpf = excluded.cpf, whatsapp = excluded.whatsapp,
    cidade = excluded.cidade, pagamento = excluded.pagamento;
  insert into public.cb_entrada_progresso (member_id, passo_id, feito_por, ator)
  values (p_member, 'fechamento', auth.uid(), coalesce(nome,'Equipe Black')),
         (p_member, 'dados', auth.uid(), coalesce(nome,'Equipe Black'))
  on conflict do nothing;
end $$;

-- Marca ou desmarca um passo. Única porta de escrita do progresso.
create or replace function public.cb_entrada_marcar(p_member uuid, p_passo text, p_feito boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare nome text;
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Entre novamente.'; end if;
  if not public.is_admin() then raise exception 'Somente a equipe marca a entrada.'; end if;
  if p_feito then
    select st.nome into nome from public.staff st where st.user_id = auth.uid() and st.ativo order by st.id limit 1;
    insert into public.cb_entrada_progresso (member_id, passo_id, feito_por, ator)
    values (p_member, p_passo, auth.uid(), coalesce(nome,'Equipe Black'))
    on conflict (member_id, passo_id) do nothing;
  else
    delete from public.cb_entrada_progresso where member_id = p_member and passo_id = p_passo;
  end if;
end $$;

revoke all on function public.cb_entrada_abrir(uuid,text,text,text,text) from public, anon;
revoke all on function public.cb_entrada_marcar(uuid,text,boolean) from public, anon;
grant execute on function public.cb_entrada_abrir(uuid,text,text,text,text) to authenticated;
grant execute on function public.cb_entrada_marcar(uuid,text,boolean) to authenticated;

-- Quem já está no Club passou por tudo isso antes do checklist existir.
insert into public.cb_entrada_progresso (member_id, passo_id, feito_em, ator)
select m.id, p.id, coalesce(m.criado_em, now()), 'Marcado em lote em 30/10/2026: entrada anterior ao checklist.'
from public.members m cross join public.cb_entrada_passos p
on conflict do nothing;
