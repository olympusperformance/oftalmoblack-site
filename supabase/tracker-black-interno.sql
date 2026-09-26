-- Tracker Black: artefato executável exclusivo da equipe, 26/09/2026.
-- Aplicar após areas.sql e frentes-internas.sql, antes do frontend desta revisão.
-- Tipo, IDs, etapas, demandas e progresso permanecem intactos.
begin;
alter table public.artifacts add column if not exists somente_equipe boolean not null default false;
comment on column public.artifacts.somente_equipe is 'Oculta o artefato e seu progresso dos mentorados, mantendo a execução pela equipe.';
update public.artifacts
 set somente_equipe=true,
     subtitulo='Solução interna exclusiva do Sistema Black; implantação em paralelo ao sistema'
 where id='50742fcf-13a5-4f68-be80-a0e8c29da6e1' and nome='Tracker Black';
drop policy if exists "le os artefatos liberados" on public.artifacts;
create policy "le os artefatos liberados" on public.artifacts for select to authenticated
 using (public.is_admin() or (tipo='artefato' and not somente_equipe
   and (member_id is null or member_id=public.current_member_id())));
drop policy if exists "le as etapas dos artefatos liberados" on public.artifact_steps;
create policy "le as etapas dos artefatos liberados" on public.artifact_steps for select to authenticated
 using (public.is_admin() or exists (select 1 from public.artifacts a
   where a.id=artifact_steps.artifact_id and a.tipo='artefato' and not a.somente_equipe
   and (a.member_id is null or a.member_id=public.current_member_id())));
drop policy if exists "le o proprio progresso" on public.step_progress;
create policy "le o proprio progresso" on public.step_progress for select to authenticated
 using (public.is_admin() or (member_id=public.current_member_id()
   and exists (select 1 from public.artifact_steps s join public.artifacts a on a.id=s.artifact_id
     where s.id=step_progress.step_id and a.tipo='artefato' and not a.somente_equipe
     and (a.member_id is null or a.member_id=public.current_member_id()))));
notify pgrst, 'reload schema';
commit;