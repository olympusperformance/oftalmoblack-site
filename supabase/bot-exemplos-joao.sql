-- Primeira voz do @drjoaocoelho (05/10/2026): os pares do documento de
-- instruções da equipe, que já eram genéricos, copiados para a conta dele.
-- Ficam fora o "dói?" (a duração de 5 a 10 minutos é do Alex) e tudo que cite
-- o nome ou a credencial do Alex. A desconfiança fecha no direct em vez da
-- assinatura, porque a credencial do Dr. João ainda não foi confirmada.
-- Origem própria para a equipe dele revisar e trocar pela voz do médico.
insert into public.bot_exemplos (conta, grupo, comentario, resposta, origem, ativo)
select 'drjoaocoelho', e.grupo,
       replace(e.comentario, 'Dr. Alex', 'Dr. João'),
       regexp_replace(e.resposta, '\s*Dr\.? Alex S[áa]\s*·.*$', ' Me chama no direct.'),
       'documento (cópia do Alex)', true
  from public.bot_exemplos e
 where e.conta = 'dralexsa' and e.ativo
   and e.grupo in ('duvida', 'relato', 'objecao')
   and e.resposta is not null
   and e.resposta !~* '5 a 10 minutos|indolor'
   and not exists (select 1 from public.bot_exemplos j
                    where j.conta = 'drjoaocoelho' and j.comentario = replace(e.comentario, 'Dr. Alex', 'Dr. João'));
