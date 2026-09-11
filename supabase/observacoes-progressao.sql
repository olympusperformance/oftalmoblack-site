-- Observações internas da Progressão. Rodar depois de schema.sql e progresso.sql.
-- Não altera checklists, marcações, datas de conclusão ou notas de outro mentorado.
begin;

create table if not exists public.progress_notes (
  member_id uuid not null references public.members(id) on delete cascade,
  artifact_id uuid references public.artifacts(id) on delete cascade,
  step_id uuid references public.artifact_steps(id) on delete cascade,
  alvo text generated always as (
    case when step_id is not null then 'etapa:' || step_id::text
         when artifact_id is not null then 'artefato:' || artifact_id::text
         else 'mentorado' end
  ) stored,
  observacao text not null default '' check (char_length(observacao) <= 2000),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null,
  primary key (member_id, alvo),
  constraint progress_notes_um_alvo check (artifact_id is null or step_id is null)
);

create index if not exists progress_notes_artifact_idx on public.progress_notes (artifact_id);
create index if not exists progress_notes_step_idx on public.progress_notes (step_id);

-- Tabela separada: step_progress é lida pelo mentorado; estas notas não são.
alter table public.progress_notes enable row level security;
drop policy if exists "admin acessa observacoes" on public.progress_notes;
create policy "admin acessa observacoes" on public.progress_notes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.progress_notes from anon, authenticated;
grant select, insert, update on public.progress_notes to authenticated;

create or replace function public.carimbar_observacao_progresso()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  new.atualizado_por = auth.uid();
  return new;
end;
$$;
revoke all on function public.carimbar_observacao_progresso() from public;
grant execute on function public.carimbar_observacao_progresso() to authenticated;
drop trigger if exists carimbar_observacao_progresso on public.progress_notes;
create trigger carimbar_observacao_progresso
  before insert or update on public.progress_notes
  for each row execute function public.carimbar_observacao_progresso();

comment on table public.progress_notes is
  'Notas internas por mentorado e linha da Progressão; nunca compartilhadas entre mentorados.';
notify pgrst, 'reload schema';
commit;
