-- Turma, fase e tier saem do cadastro de membros. As iniciais continuam, calculadas do nome.
-- Aplicar depois que o front sem esses campos estiver no ar.
alter table public.members drop column turma, drop column fase, drop column tier;
