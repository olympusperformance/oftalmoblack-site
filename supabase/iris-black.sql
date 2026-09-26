-- Renomeação aprovada por Felipe em 26/09/2026: SDR IA passa a Íris Black.
-- Aplicar após frentes-internas.sql. Somente nomes; preserva IDs e vínculos.
begin;
update public.artifacts set nome = 'Íris Black' where nome in ('SDR IA', 'SDR de IA');
update public.demands set projeto_legado = case projeto_legado
  when 'Clínica Dr. Alex / SDR IA Marina' then 'Clínica Dr. Alex / Íris Black'
  when 'Olympus / SDR IA (produto)' then 'Olympus / Íris Black'
  else projeto_legado end
where projeto_legado in ('Clínica Dr. Alex / SDR IA Marina', 'Olympus / SDR IA (produto)');
commit;
