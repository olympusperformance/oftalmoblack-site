-- ============================================================================
-- Club OftalmoBlack — dados de demonstração (tarefas e agenda)
--
-- Rode no SQL Editor depois do schema.sql. Serve para gravar vídeo da área de
-- membros com o painel cheio, sem depender de cadastro manual.
--
-- Nada aqui é escrito à mão para um mentorado específico: as tarefas nascem de
-- um catálogo de doze modelos cruzado com a tabela members, e cada mentorado
-- recebe uma fatia diferente desse catálogo. Entra um médico novo no Club,
-- roda de novo, e ele já aparece com o quadro montado.
--
-- Os prazos são relativos ao dia em que o arquivo roda (current_date), então o
-- painel nunca aparece com tudo vencido em um vídeo gravado semanas depois.
--
-- Para apagar tudo, o bloco comentado no fim do arquivo.
-- ============================================================================

-- ── tarefas ────────────────────────────────────────────────────────────────
-- slot   posição no catálogo, usada para distribuir os modelos entre os médicos
-- dias   prazo em dias a partir de hoje (negativo = já venceu)
--
-- A ordem do catálogo não é decorativa: as categorias se alternam de quatro em
-- quatro e as tarefas já concluídas caem de três em três. Como cada mentorado
-- leva sete slots seguidos, qualquer fatia sai com as quatro categorias e com
-- duas ou três tarefas fechadas — nenhum painel abre só de vermelho nem só de
-- verde.

with mentorado as (
  select id, (row_number() over (order by nome))::int as n
    from public.members
   where ativo
),
modelo (slot, titulo, descricao, categoria, cadencia, dias, feito, total, status) as (
  values
    (1,  'Gravar os 3 Reels da semana',
         'Um de dor, um de prova social e um de bastidor. Os roteiros estão no acervo.',
         'Conteúdo',  'Semanal',       -2, 2, 3, 'pending'),
    (2,  'Revisar a campanha de refrativa',
         'Pausar criativo com CPL acima de 28 reais e subir as duas variações novas.',
         'Tráfego',   'Semanal',        0, 1, 4, 'pending'),
    (3,  'Revisar o script de agendamento',
         'Versão nova com a pergunta de qualificação antes de falar de valor.',
         'Vendas',    'Mensal',        -4, 1, 1, 'done'),
    (4,  'Padronizar o funil no CRM',
         'Sete etapas, uma responsável por etapa, sem lead parado em nenhuma delas.',
         'Estrutura', 'Entrega única',  8, 4, 7, 'pending'),
    (5,  'Roteirizar a VSL de catarata',
         'Estrutura de 7 blocos, com a objeção de preço resolvida antes do convite.',
         'Conteúdo',  'Entrega única',  5, 3, 7, 'pending'),
    (6,  'Fechar o relatório de tráfego do mês',
         'Investimento, leads, agendamentos e cirurgias fechadas na mesma planilha.',
         'Tráfego',   'Mensal',       -14, 1, 1, 'done'),
    (7,  'Retomar os leads sem resposta em 48h',
         'Fila do CRM ordenada por data. Áudio curto funciona melhor que texto aqui.',
         'Vendas',    'Semanal',        1, 9, 20, 'pending'),
    (8,  'Configurar o rastreamento de conversões',
         'Pixel, API de conversões e o evento de agendamento chegando no gerenciador.',
         'Estrutura', 'Entrega única', 18, 1, 5, 'pending'),
    (9,  'Publicar 2 carrosséis educativos',
         'Um sobre lente premium e um desmontando o mito da cirurgia a laser.',
         'Conteúdo',  'Semanal',       -6, 2, 2, 'done'),
    (10, 'Subir 4 criativos novos de catarata',
         'Dois com depoimento em vídeo e dois estáticos com prova de resultado.',
         'Tráfego',   'Quinzenal',      3, 2, 4, 'pending'),
    (11, 'Auditar 5 conversas do WhatsApp',
         'Ouvir onde a secretária perdeu o agendamento e anotar para o treinamento.',
         'Vendas',    'Semanal',       -1, 3, 5, 'pending'),
    (12, 'Treinar a equipe da recepção',
         'Uma hora de simulação de atendimento, com gravação para revisar depois.',
         'Estrutura', 'Mensal',        -9, 1, 1, 'done')
)
insert into public.tasks
  (member_id, titulo, descricao, categoria, cadencia, vence_em,
   progresso_atual, progresso_total, status)
select mentorado.id,
       modelo.titulo,
       modelo.descricao,
       modelo.categoria,
       modelo.cadencia,
       -- o deslocamento por mentorado evita que a turma inteira vença no mesmo dia
       current_date + modelo.dias + ((mentorado.n - 1) % 4),
       modelo.feito,
       modelo.total,
       modelo.status
  from mentorado
  join modelo
    -- sete modelos por mentorado, girando o catálogo a cada médico
    on ((modelo.slot + mentorado.n) % 12) < 7;

-- ── agenda da turma ────────────────────────────────────────────────────────
-- member_id nulo: aparece para todo mundo.

insert into public.events (member_id, titulo, mentor, inicia_em, formato, link)
values
  (null, 'Mentoria coletiva — tráfego que enche agenda', 'Dr. Alex Sá',
   current_date + 2  + time '20:00', 'Ao vivo', 'https://meet.google.com/oft-black-mentoria'),
  (null, 'Hot seat — análise de campanha ao vivo', 'Equipe Growth',
   current_date + 9  + time '20:00', 'Ao vivo', 'https://meet.google.com/oft-black-hotseat'),
  (null, 'Encontro BLACK de setembro', 'Dr. Alex Sá',
   current_date + 23 + time '19:00', 'Ao vivo', 'https://meet.google.com/oft-black-encontro'),
  (null, 'Aula — a consulta que vende sem parecer venda', 'Dr. Alex Sá',
   current_date - 5  + time '19:30', 'Gravada', 'https://vimeo.com/oftalmoblack/consulta'),
  (null, 'Onboarding Growth — como ler o seu painel', 'Equipe Growth',
   current_date - 12 + time '19:30', 'Gravada', 'https://vimeo.com/oftalmoblack/onboarding');

-- ── agenda individual ──────────────────────────────────────────────────────
-- Um 1:1 já realizado e o próximo marcado, para cada mentorado.

with mentorado as (
  select id, (row_number() over (order by nome))::int as n
    from public.members
   where ativo
)
insert into public.events (member_id, titulo, mentor, inicia_em, formato, link)
select id,
       'Alinhamento 1:1 de acompanhamento',
       'Equipe Growth',
       current_date + (1 + n) + time '18:00' + ((n % 3) * interval '1 hour'),
       'Ao vivo',
       'https://meet.google.com/oft-black-1a1'
  from mentorado
union all
select id,
       'Revisão de campanhas — 1:1',
       'Dr. Alex Sá',
       current_date - (3 + n) + time '19:00',
       'Ao vivo',
       null
  from mentorado;

-- ============================================================================
-- Para apagar a demonstração (descomente e rode):
--
-- delete from public.tasks where titulo in (
--   'Gravar os 3 Reels da semana', 'Roteirizar a VSL de catarata',
--   'Publicar 2 carrosséis educativos', 'Revisar a campanha de refrativa',
--   'Subir 4 criativos novos de catarata', 'Fechar o relatório de tráfego do mês',
--   'Retomar os leads sem resposta em 48h', 'Auditar 5 conversas do WhatsApp',
--   'Revisar o script de agendamento', 'Padronizar o funil no CRM',
--   'Treinar a equipe da recepção', 'Configurar o rastreamento de conversões');
--
-- delete from public.events where titulo in (
--   'Mentoria coletiva — tráfego que enche agenda',
--   'Hot seat — análise de campanha ao vivo',
--   'Encontro BLACK de setembro',
--   'Aula — a consulta que vende sem parecer venda',
--   'Onboarding Growth — como ler o seu painel',
--   'Alinhamento 1:1 de acompanhamento',
--   'Revisão de campanhas — 1:1');
-- ============================================================================
