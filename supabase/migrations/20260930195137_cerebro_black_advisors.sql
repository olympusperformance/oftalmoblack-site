-- Mantém a tabela de snapshots fechada para o cliente, mas explicita a leitura
-- administrativa para o linter e acelera as duas FKs usadas nos fluxos novos.
create policy rank_history_admin_read on public.cb_rank_history
  for select to authenticated using ((select public.is_admin()));

create index cb_missions_artifact_step on public.cb_missions(artifact_step_id)
  where artifact_step_id is not null;
create index cb_case_files_case on public.cb_case_files(case_id);
