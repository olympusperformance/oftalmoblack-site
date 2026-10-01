-- Índice cobrindo a FK composta do catálogo, sem alterar dados.
create index cb_delivery_artifacts_delivery_stage_idx
 on public.cb_delivery_artifacts(delivery_id,stage_id);
