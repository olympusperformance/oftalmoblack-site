-- ============================================================================
-- Club OftalmoBlack — progresso do mentorado por artefato
--
-- Rode no SQL Editor depois do schema.sql.
--
-- A hierarquia que o painel mostra:
--
--   Mentorado  →  Artefato  →  Etapa
--
-- As etapas são o checklist padrão do artefato: cadastradas uma única vez na
-- aba Artefatos e valem para todo mentorado que recebe aquele artefato. Quem
-- marca o que já foi entregue é a administração, e a marcação é por mentorado
-- — daí a tabela de progresso apontar para (mentorado, etapa) e não guardar
-- nada dentro da etapa em si.
--
-- Uma tabela de "artefato atribuído ao mentorado" seria uma terceira via da
-- mesma informação: artifacts.member_id já diz de quem é o artefato (nulo =
-- turma inteira), e é essa mesma regra que a área do mentorado usa para
-- decidir o que aparece para ele. Duplicar isso só criaria como divergir.
-- ============================================================================

-- ── etapas padrão do artefato ──────────────────────────────────────────────

create table if not exists public.artifact_steps (
  id          uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  titulo      text not null,
  -- Posição no checklist. É por ela que a edição casa etapa antiga com etapa
  -- nova: renomear a etapa 3 mantém o que já estava marcado nela.
  ordem       integer not null default 0,
  criado_em   timestamptz not null default now()
);

create index if not exists artifact_steps_art_idx
  on public.artifact_steps (artifact_id, ordem);

-- ── o que cada mentorado já cumpriu ────────────────────────────────────────
-- Linha só existe depois da primeira marcação; etapa sem linha é etapa em
-- aberto. Apagar a etapa do checklist leva o progresso dela junto, o que é o
-- certo: a etapa deixou de existir.

create table if not exists public.step_progress (
  member_id      uuid not null references public.members(id) on delete cascade,
  step_id        uuid not null references public.artifact_steps(id) on delete cascade,
  feito          boolean not null default false,
  feito_em       timestamptz,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null,
  primary key (member_id, step_id)
);

-- ── acesso ─────────────────────────────────────────────────────────────────

alter table public.artifact_steps enable row level security;
alter table public.step_progress  enable row level security;

drop policy if exists "le as etapas dos artefatos liberados" on public.artifact_steps;
drop policy if exists "admin escreve etapas"                 on public.artifact_steps;
drop policy if exists "le o proprio progresso"               on public.step_progress;
drop policy if exists "admin escreve progresso"              on public.step_progress;

-- O mentorado só alcança as etapas de um artefato que ele já enxerga. O RLS de
-- artifacts não vale dentro desta política (política não dispara política),
-- então a regra de visibilidade é repetida aqui de propósito.
create policy "le as etapas dos artefatos liberados" on public.artifact_steps
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.artifacts a
       where a.id = artifact_steps.artifact_id
         and (a.member_id is null or a.member_id = public.current_member_id())
    )
  );

create policy "admin escreve etapas" on public.artifact_steps
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "le o proprio progresso" on public.step_progress
  for select to authenticated
  using (public.is_admin() or member_id = public.current_member_id());

-- Quem decide se a etapa saiu é a administração, não o mentorado: este é o
-- registro do que o Club entregou, e o mentorado marcando o próprio placar
-- tiraria o sentido do acompanhamento.
create policy "admin escreve progresso" on public.step_progress
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete
  on public.artifact_steps, public.step_progress to authenticated;
revoke all on public.artifact_steps, public.step_progress from anon;

-- ── marcar uma etapa ───────────────────────────────────────────────────────
-- Um clique no painel é um upsert: na primeira vez a linha nasce, nas
-- seguintes ela vira. Feito de fora seriam duas viagens e uma corrida entre
-- elas. O carimbo de conclusão é preservado ao remarcar uma etapa já feita e
-- limpo ao desmarcar, para "concluída quando?" nunca mentir.

create or replace function public.marcar_etapa(
  p_member_id uuid,
  p_step_id   uuid,
  p_feito     boolean
)
returns public.step_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.step_progress;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão para marcar o progresso.';
  end if;

  insert into public.step_progress as sp
    (member_id, step_id, feito, feito_em, atualizado_em, atualizado_por)
  values
    (p_member_id, p_step_id, p_feito,
     case when p_feito then now() end, now(), auth.uid())
  on conflict (member_id, step_id) do update
    set feito          = excluded.feito,
        feito_em       = case when excluded.feito
                              then coalesce(sp.feito_em, now())
                              else null end,
        atualizado_em  = now(),
        atualizado_por = auth.uid()
  returning * into r;

  return r;
end;
$$;

revoke all on function public.marcar_etapa(uuid, uuid, boolean) from public;
grant execute on function public.marcar_etapa(uuid, uuid, boolean) to authenticated;
