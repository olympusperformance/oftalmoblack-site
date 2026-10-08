-- Exclusão lógica de demandas. A linha continua no banco (com etapas, vínculos
-- e histórico); as telas, a TV e o resumo diário passam a ignorar quem tem
-- `excluida_em`. Desfazer: `update demands set excluida_em = null ...`.

alter table public.demands add column if not exists excluida_em timestamptz;
alter table public.demands add column if not exists excluida_motivo text;

create index if not exists demands_ativas_idx on public.demands (criado_em) where excluida_em is null;

comment on column public.demands.excluida_em is 'Exclusão lógica: preenchida = some das telas, da TV e do resumo diário.';

-- Limpeza pedida em 08/10/2026: tudo o que foi criado antes de 25/09/2026
-- (horário de Brasília), de qualquer status.
update public.demands
   set excluida_em = now(),
       excluida_motivo = 'Limpeza de 08/10/2026: criadas antes de 25/09/2026'
 where criado_em < timestamptz '2026-09-25 00:00:00-03'
   and excluida_em is null;
