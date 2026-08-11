-- ============================================================================
-- Club OftalmoBlack — primeiro acesso
--
-- Rode DEPOIS do schema.sql e DEPOIS de ter criado os logins em
-- Authentication → Users no painel do Supabase.
--
-- Troque os e-mails abaixo pelos de verdade antes de executar.
-- ============================================================================

-- 1) Promover o administrador ------------------------------------------------
-- O e-mail precisa já existir em Authentication → Users.

insert into public.app_admins (user_id)
select id from auth.users where lower(email) = lower('SEU-EMAIL-DE-ADMIN@AQUI')
on conflict (user_id) do nothing;

-- Confere: deve devolver uma linha.
-- select u.email from public.app_admins a join auth.users u on u.id = a.user_id;


-- 2) Cadastrar os mentorados --------------------------------------------------
-- Pode fazer isso pelo painel em /admin/ depois de entrar. Este bloco é só um
-- atalho para começar com a turma já dentro.
--
-- O user_id fica nulo aqui de propósito: o gatilho on_auth_user_created costura
-- o cadastro ao login assim que você criar o usuário no Auth com o mesmo
-- e-mail — em qualquer ordem.

insert into public.members (nome, email, iniciais, turma, fase, tier, instagram, ativo)
values
  ('Dra. Cintia Santini',  'cintia@oftalmoblack.com.br',  'CS', 'Turma 03', 'Fase 1', 'BLACK', '@cintiaoftalmo', true),
  ('Dra. Luciana da Hora', 'luciana@oftalmoblack.com.br', 'LH', 'Turma 03', 'Fase 1', 'BLACK', '', true),
  ('Dr. Gustavo Ribeiro',  'gustavo@oftalmoblack.com.br', 'GR', 'Turma 03', 'Fase 1', 'BLACK', '', true),
  ('Dra. Nauara Naissa',   'nauara@oftalmoblack.com.br',  'NN', 'Turma 03', 'Fase 1', 'BLACK', '', true)
on conflict (email) do nothing;


-- 3) Agenda e artefatos da turma ---------------------------------------------
-- member_id nulo = vale para todo mundo.

insert into public.events (member_id, titulo, mentor, inicia_em, formato)
values
  (null, 'Mesa de pares — diagnóstico de funil',      'Ítalo Monte',  '2026-08-13 20:00', 'Ao vivo'),
  (null, 'Treinamento de vendas para a secretária',   'Equipe Black', '2026-08-18 19:30', 'Ao vivo'),
  (null, 'Precificação premium na oftalmologia',      'Dr. Alex Sá',  '2026-08-25 19:30', 'Gravada');

insert into public.artifacts (member_id, nome, subtitulo, icone, status, meta, url)
values
  (null, 'Sistema Black',       'CRM próprio da mentoria', 'grid', 'Disponível',  'Acesso liberado',   ''),
  (null, 'Automação ManyChat',  'Fluxos de Instagram',     'zap',  'Bloqueado',   'Libera na fase 2',  '');

-- Artefatos de uma pessoa só, ligados pelo e-mail para não precisar copiar uuid:
insert into public.artifacts (member_id, nome, subtitulo, icone, status, meta, url)
select m.id, 'Central de análises', 'Relatórios de tráfego e funil', 'file-text',
       'Disponível', '6 documentos', '/mentorados/cintia-santini/analises/'
  from public.members m where m.email = 'cintia@oftalmoblack.com.br';

insert into public.artifacts (member_id, nome, subtitulo, icone, status, meta, url)
select m.id, 'Roteiros de VSL', 'Catarata e faco refrativa', 'file-text',
       'Disponível', '2 roteiros', '/mentorados/luciana-da-hora/roteiros/'
  from public.members m where m.email = 'luciana@oftalmoblack.com.br';
