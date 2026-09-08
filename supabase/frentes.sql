-- ============================================================================
-- Grupos de artefatos, etapas tipadas e o catálogo de 06/09/2026
--
-- Roda DEPOIS de schema.sql e progresso.sql e DEPOIS de frentes-0-retrato.sql,
-- inteiro, no SQL Editor, com o admin fechado (o sync por posição do modal
-- regravaria por cima no meio da transação). Idempotente: rodar duas vezes
-- deixa o banco igual.
--
-- O que muda:
--   1. artifact_groups: o nível acima do artefato (SEO / Site, Conteúdo,
--      Tráfego, Sistema Black), com pilar do método, ordem e responsáveis.
--   2. artifacts ganha group_id, ordem e responsaveis.
--   3. artifact_steps ganha tipo (aceite | entrega | trava | opcional | rotina)
--      e cadencia_dias (rótulo da rotina: 1, 7, 14, 30).
--   4. Catálogo: renomes decididos, encaixe dos artefatos nos grupos, tipagem
--      das etapas existentes, etapas novas no FIM dos checklists com marcação,
--      artefatos novos com checklist completo.
--
-- Regra de ouro das marcações (step_progress é chaveado por step_id):
--   · artefato COM linha de progresso (marcada ou não): etapa existente só é
--     renomeada NA POSIÇÃO (mesmo id, mesma ordem); etapa nova entra depois da
--     última. Nada é apagado. Dry-run de 06/09: caiu aqui também Site
--     Institucional e Automação Instagram, que têm linhas desmarcadas.
--   · artefato SEM nenhuma linha de progresso: o checklist é substituído inteiro.
--   · step_progress e a RPC marcar_etapa não mudam.
-- ============================================================================

begin;

-- ── 1. grupo ────────────────────────────────────────────────────────────────

create table if not exists public.artifact_groups (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null unique,
  pilar        text,
  ordem        integer not null default 0,
  responsaveis uuid[],
  criado_em    timestamptz not null default now()
);

alter table public.artifact_groups enable row level security;
drop policy if exists "admin le e escreve grupos" on public.artifact_groups;
create policy "admin le e escreve grupos" on public.artifact_groups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.artifact_groups to authenticated;
revoke all on public.artifact_groups from anon;

-- ── 2. artefato: grupo, ordem, responsáveis ────────────────────────────────

alter table public.artifacts
  add column if not exists group_id     uuid references public.artifact_groups(id) on delete set null,
  add column if not exists ordem        integer not null default 0,
  add column if not exists responsaveis uuid[];
create index if not exists artifacts_group_idx on public.artifacts (group_id, ordem);

-- ── 3. etapa: tipo e cadência ───────────────────────────────────────────────

alter table public.artifact_steps
  add column if not exists tipo          text not null default 'entrega',
  add column if not exists cadencia_dias integer;
alter table public.artifact_steps drop constraint if exists artifact_steps_tipo_ck;
alter table public.artifact_steps add constraint artifact_steps_tipo_ck
  check (tipo in ('aceite', 'entrega', 'opcional', 'trava', 'rotina'));
alter table public.artifact_steps drop constraint if exists artifact_steps_cadencia_ck;
alter table public.artifact_steps add constraint artifact_steps_cadencia_ck
  check (cadencia_dias is null or cadencia_dias > 0);

-- ── 4. grupos: escopo vendido, pilar do método (rascunho 04/09, gate Alex) ──

insert into public.artifact_groups (nome, ordem, pilar) values
  ('SEO / Site',    1, 'P04 Black Branding'),
  ('Conteúdo',      2, 'P06 Referência Black'),
  ('Tráfego',       3, 'P07 Máquina Black de Tráfego'),
  ('Sistema Black', 4, 'P05 Sistema Black')
on conflict (nome) do nothing;

-- Responsáveis por sigla da equipe (staff.apelido). Sigla que não existir é
-- ignorada em silêncio: conferir na prova.
update public.artifact_groups g set responsaveis = r.ids
from (
  select x.grupo, array_agg(s.id order by s.apelido) as ids
  from (values ('SEO / Site', 'JF'), ('SEO / Site', 'TA'),
               ('Conteúdo', 'JF'),
               ('Tráfego', 'TA'), ('Tráfego', 'FM'),
               ('Sistema Black', 'IM'), ('Sistema Black', 'PL')) as x(grupo, sigla)
  join public.staff s on s.apelido = x.sigla
  group by x.grupo
) r where r.grupo = g.nome;

-- ── 5. renomes decididos (02/09 e 06/09) ────────────────────────────────────

update public.artifacts set nome = 'Quiz', subtitulo = 'Qualificação na bio'
  where nome = 'Formulário Qualificatório - Bio';
update public.artifacts set nome = 'Meta Ads', subtitulo = 'Máquina Black de Tráfego'
  where nome = 'Gestão de Tráfego';
update public.artifacts set nome = 'Linha Editorial', subtitulo = 'Feed e stories na voz do Mestre'
  where nome = 'Linha Editorial Completa';
update public.artifacts set subtitulo = 'Comentário com gatilho vira conversa no direct'
  where nome = 'Automação Instagram' and coalesce(subtitulo, '') = '';
update public.artifacts set subtitulo = 'Perfil da empresa no Google'
  where nome = 'GBP' and coalesce(subtitulo, '') = '';
update public.artifacts set subtitulo = 'Site próprio com blog e rotina de artigos'
  where nome = 'Site Institucional' and coalesce(subtitulo, '') = '';

-- ── 6. artefatos novos (turma inteira; o aceite decide pra quem vale) ────────

insert into public.artifacts (nome, subtitulo, icone, status, meta, member_id)
select x.nome, x.subtitulo, x.icone, 'Em produção', '', null
from (values
  ('Google Ads',            'Captura em Search por procedimento',        'zap'),
  ('Trackeamento',          'Pixel, MQL, CAPI e origem no CRM',          'settings'),
  ('Funil VSL',             'Roteiro, vídeo, LP pedagiada e campanha',   'video'),
  ('Fábrica de Conteúdo',   'Doxa: vídeos com IA na voz do Mestre',      'play-circle'),
  ('Agente de comentários', 'Responde o comentário na voz do Mestre',    'zap'),
  ('SDR IA',                'Atendimento por IA no WhatsApp da clínica', 'grid')
) as x(nome, subtitulo, icone)
where not exists (select 1 from public.artifacts a where a.nome = x.nome and a.member_id is null);

-- ── 7. encaixe nos grupos, ordem e dono por artefato ────────────────────────

update public.artifacts a
   set group_id = g.id, ordem = x.ordem,
       responsaveis = coalesce((select array_agg(s.id) from public.staff s where s.apelido = any(x.siglas)), a.responsaveis)
from (values
  ('GBP',                   'SEO / Site',    1, array['TA']),
  ('Site Institucional',    'SEO / Site',    2, array['JF']),
  ('Meta Ads',              'Tráfego',       1, array['TA']),
  ('Google Ads',            'Tráfego',       2, array['TA']),
  ('Trackeamento',          'Tráfego',       3, array['TA']),
  ('Funil VSL',             'Tráfego',       4, array['TA']),
  ('Quiz',                  'Tráfego',       5, array['JF']),
  ('Linha Editorial',       'Conteúdo',      1, array['JF']),
  ('Fábrica de Conteúdo',   'Conteúdo',      2, array['JF']),
  ('Automação Instagram',   'Conteúdo',      3, array['IM']),
  ('Agente de comentários', 'Conteúdo',      4, array['IM']),
  ('Sistema Black',         'Sistema Black', 1, array['IM']),
  ('SDR IA',                'Sistema Black', 2, array['FM'])
) as x(nome, grupo, ordem, siglas)
join public.artifact_groups g on g.nome = x.grupo
where a.nome = x.nome and a.member_id is null;

-- ── 8. CATALOGO: checklist por artefato (ordem, título, tipo, cadência) ──────
-- Uma linha por etapa. Pra artefato COM marcação, as primeiras N linhas (N =
-- etapas que ele já tem) são renome em posição; o resto é append. Pra artefato
-- SEM marcação, a lista substitui o checklist inteiro.

create temp table catalogo (art text, ordem int, titulo text, tipo text, cad int) on commit drop;
insert into catalogo values
-- GBP (5 existentes com marcação: posições 0-4 renomeadas)
('GBP', 0,  'Aceite da gestão do GBP (SEO incluso)', 'aceite', null),
('GBP', 1,  'Ficha localizada e verificada', 'entrega', null),
('GBP', 2,  'Acesso de proprietário concedido (gerente se resistir)', 'trava', null),
('GBP', 3,  'Auditoria da ficha (nota 0-100) e NAP corrigido', 'entrega', null),
('GBP', 4,  'Avaliações recentes respondidas (só se a clínica não faz)', 'opcional', null),
('GBP', 5,  'Ficha cadastrada no registro da API e leitura validada', 'entrega', null),
('GBP', 6,  'Descrição, serviços e horários aprovados', 'trava', null),
('GBP', 7,  'Lote A: descrição, serviços, categoria, site com UTM', 'entrega', null),
('GBP', 8,  'Botão de WhatsApp com frase de origem', 'entrega', null),
('GBP', 9,  'Fotos reais da clínica e equipe enviadas', 'trava', null),
('GBP', 10, 'Fotos, Q&A semeado e 1ª leva de posts publicados', 'entrega', null),
('GBP', 11, 'Link de avaliação entregue ao balcão', 'entrega', null),
('GBP', 12, 'Post e foto da semana publicados', 'rotina', 7),
('GBP', 13, 'Avaliações e Q&A respondidos pela clínica', 'rotina', 7),
('GBP', 14, 'Criar ficha do zero e aguardar verificação', 'opcional', null),
('GBP', 15, 'Duplicidade ou ficha adicional da mesma clínica', 'opcional', null),
('GBP', 16, 'Cartão NFC de avaliação no balcão', 'opcional', null),
-- Site Institucional (4 existentes, 0 marcação: substitui)
('Site Institucional', 0,  'Aceite do site institucional (SEO incluso)', 'aceite', null),
('Site Institucional', 1,  'Dados gerais levantados do onboarding e das fontes (CRM/RQE, CNPJ)', 'entrega', null),
('Site Institucional', 2,  'Fotos, logo e manual de marca enviados', 'trava', null),
('Site Institucional', 3,  'Acesso ao domínio e DNS concedido (ou domínio registrado pela Olympus)', 'trava', null),
('Site Institucional', 4,  'Brief, keywords-alvo e mapa de redirects', 'entrega', null),
('Site Institucional', 5,  'Site construído (home, procedimento, blog, AI SEO) com GA4, Clarity e pixel base', 'entrega', null),
('Site Institucional', 6,  'Prévia aprovada pelo médico', 'trava', null),
('Site Institucional', 7,  'Domínio apontado com redirects, SPF e DMARC', 'entrega', null),
('Site Institucional', 8,  'Produção validada (Lighthouse) e GSC com sitemap', 'entrega', null),
('Site Institucional', 9,  'Nota aceitável no is-agentic.com', 'entrega', null),
('Site Institucional', 10, '3 primeiros artigos por frente publicados', 'entrega', null),
('Site Institucional', 11, 'Pauta editorial montada', 'entrega', null),
('Site Institucional', 12, 'Artigo da semana publicado no ar e revisado pelo médico', 'rotina', 7),
('Site Institucional', 13, 'Auditar o site atual antes de decidir', 'opcional', null),
('Site Institucional', 14, 'Recuperar acessos do fornecedor antigo', 'opcional', null),
-- Meta Ads (2 existentes com marcação: posições 0-1 renomeadas)
('Meta Ads', 0,  'Acesso à BM (BM do Alex como parceira)', 'trava', null),
('Meta Ads', 1,  'Conta, página e IG compartilhados com a BM do Alex', 'trava', null),
('Meta Ads', 2,  'Conta ativa, cartão com limite e WhatsApp da clínica na página', 'trava', null),
('Meta Ads', 3,  'Conta registrada com System User, leitura e escrita validadas', 'entrega', null),
('Meta Ads', 4,  'Escopo definido: gestão ou auditoria', 'trava', null),
('Meta Ads', 5,  'Verba, cidades, idades de corte e número do fundo informados', 'trava', null),
('Meta Ads', 6,  '3 a 5 Reels dos últimos 15 dias entregues', 'trava', null),
('Meta Ads', 7,  'Públicos, baseline e checklist pré-campanha completos', 'entrega', null),
('Meta Ads', 8,  'Tracking validado (ver Trackeamento)', 'entrega', null),
('Meta Ads', 9,  'Plano de subida escrito e aprovado', 'entrega', null),
('Meta Ads', 10, 'Estrutura 3x4 ABO no ar (auditoria: pauta entregue na sessão)', 'entrega', null),
('Meta Ads', 11, 'Primeira leitura ou auditoria entregue', 'entrega', null),
('Meta Ads', 12, 'Auditoria de segunda (conformidade, kill criteria, seguidores)', 'rotina', 7),
('Meta Ads', 13, 'Lote de criativo quinzenal (só gestão)', 'rotina', 14),
('Meta Ads', 14, 'Aceite do tráfego', 'aceite', null),
('Meta Ads', 15, 'Migração de campanha legada', 'opcional', null),
('Meta Ads', 16, 'Campanha Quiz ou VSL em paralelo ao CTWA', 'opcional', null),
-- Google Ads (novo)
('Google Ads', 0,  'Aceite do Google Ads (captura em Search)', 'aceite', null),
('Google Ads', 1,  'Conta Google Ads existente ou criada, sem débito e fora da agência antiga', 'trava', null),
('Google Ads', 2,  'Conta vinculada ao MCC Olympus e cartão ativo', 'trava', null),
('Google Ads', 3,  'Verba mensal e procedimentos/praça definidos', 'trava', null),
('Google Ads', 4,  'Página espelho por procedimento no ar', 'entrega', null),
('Google Ads', 5,  'Conversion actions criadas (MQL, Agendamento)', 'entrega', null),
('Google Ads', 6,  'Keywords, negativas e anúncios "somente particular" montados', 'entrega', null),
('Google Ads', 7,  'Aprovação pra ativar', 'trava', null),
('Google Ads', 8,  '1 campanha por procedimento no ar', 'entrega', null),
('Google Ads', 9,  'Prova ponta a ponta: 1º lead com gclid', 'entrega', null),
('Google Ads', 10, 'Primeira leitura entregue', 'entrega', null),
('Google Ads', 11, 'Leitura quinzenal: termos, negativação, custo por degrau', 'rotina', 14),
('Google Ads', 12, 'Performance Max além do Search', 'opcional', null),
-- Trackeamento (novo; CAPI obrigatório)
('Trackeamento', 0,  'Aceite do trackeamento', 'aceite', null),
('Trackeamento', 1,  'Dataset próprio criado na BM do Mestre e vinculado à conta', 'trava', null),
('Trackeamento', 2,  'Acesso a quem publica as páginas (repo, gerador ou CMS)', 'trava', null),
('Trackeamento', 3,  'Pixel base + MQL no clique + frase de origem por canal nas páginas de captura', 'entrega', null),
('Trackeamento', 4,  'Carimbo de ids de clique na 1ª mensagem', 'entrega', null),
('Trackeamento', 5,  'Conversão personalizada MQL criada', 'entrega', null),
('Trackeamento', 6,  'Prova em 3 datas: disparo real, confirmado no Events Manager, contando no dataset', 'entrega', null),
('Trackeamento', 7,  'Padrão de origem cadastrado no CRM', 'entrega', null),
('Trackeamento', 8,  'Contrato mínimo no CRM: origem imutável, estado com data, ICP, valor real', 'entrega', null),
('Trackeamento', 9,  'Emissor CAPI (outbox, event_id determinístico) em shadow 7 dias', 'entrega', null),
('Trackeamento', 10, 'Cutover do CAPI e emissor antigo aposentado', 'entrega', null),
('Trackeamento', 11, 'EMQ >= 6 medido antes e depois do cutover', 'entrega', null),
('Trackeamento', 12, 'Marcador de uptime apontando o bloco de tracking', 'entrega', null),
('Trackeamento', 13, 'Observabilidade semanal: contagem por evento e caminhada após republicação', 'rotina', 7),
('Trackeamento', 14, 'Perna Google: conversion action MQL e service account', 'opcional', null),
-- Funil VSL (novo)
('Funil VSL', 0,  'Aceite: gravar a VSL e rodar a LP pedagiada', 'aceite', null),
('Funil VSL', 1,  'Trilhas que o Mestre opera confirmadas', 'trava', null),
('Funil VSL', 2,  'Acervo transcrito e perfil de gravação (compartilhado com Linha Editorial)', 'entrega', null),
('Funil VSL', 3,  'Direção aprovada (1 linha por trilha)', 'entrega', null),
('Funil VSL', 4,  'Roteiro por trilha e doc dos 7 pontos publicado na central', 'entrega', null),
('Funil VSL', 5,  'Colchetes preenchidos pelo Mestre (protocolo, tempo, valor)', 'trava', null),
('Funil VSL', 6,  'Vídeo gravado e entregue', 'trava', null),
('Funil VSL', 7,  'Domínio e hospedagem da LP definidos', 'trava', null),
('Funil VSL', 8,  'LP construída com saída WhatsApp com frase', 'entrega', null),
('Funil VSL', 9,  'LP no ar provada (200 e QA)', 'entrega', null),
('Funil VSL', 10, 'Tracking validado (ver Trackeamento)', 'entrega', null),
('Funil VSL', 11, 'Aprovado pra subir a campanha', 'trava', null),
('Funil VSL', 12, 'Campanha VSL no ar otimizando MQL, end_time registrado', 'entrega', null),
('Funil VSL', 13, 'Leitura semanal do funil VSL e end_time estendido', 'rotina', 7),
('Funil VSL', 14, 'Trilha adicional (glaucoma, refrativa)', 'opcional', null),
('Funil VSL', 15, 'Auditoria Andrômeda entre trilhas ou vs Mestre da praça', 'opcional', null),
-- Quiz (5 existentes com marcação: posições 0-4 renomeadas)
('Quiz', 0,  'Solicitar informações', 'entrega', null),
('Quiz', 1,  'Informações recebidas (praça, trilhas, endereço)', 'trava', null),
('Quiz', 2,  'Desenvolvimento da página do quiz', 'entrega', null),
('Quiz', 3,  'Revisão pelo mentorado', 'trava', null),
('Quiz', 4,  'Página publicada', 'entrega', null),
('Quiz', 5,  'Valor da consulta definido', 'trava', null),
('Quiz', 6,  'Número de WhatsApp igual ao do CRM', 'trava', null),
('Quiz', 7,  'Provado no ar (fluxo e número certos)', 'entrega', null),
('Quiz', 8,  'Link colocado na bio pelo Mestre', 'trava', null),
('Quiz', 9,  'Tracking validado (ver Trackeamento)', 'entrega', null),
('Quiz', 10, 'Aceite do quiz', 'aceite', null),
('Quiz', 11, 'Campanha de link da bio otimizando MQL', 'opcional', null),
('Quiz', 12, 'Ramo de teleconsulta', 'opcional', null),
-- Linha Editorial (0 etapas hoje: insere)
('Linha Editorial', 0,  'Aceite da linha editorial', 'aceite', null),
('Linha Editorial', 1,  'IG do Mestre acessível pela BM do Alex (mesma trava do Meta Ads)', 'trava', null),
('Linha Editorial', 2,  'Perfis de referência enviados', 'trava', null),
('Linha Editorial', 3,  'Acervo inventariado e transcrito', 'entrega', null),
('Linha Editorial', 4,  'Mapa de conteúdo e perfil de gravação, revisados pelo executor', 'entrega', null),
('Linha Editorial', 5,  'Direção aprovada (gate 1)', 'trava', null),
('Linha Editorial', 6,  'Linha editorial completa com roteiros e semana 1 pronta', 'entrega', null),
('Linha Editorial', 7,  'Revisão do Mestre (gate 2)', 'trava', null),
('Linha Editorial', 8,  'Publicada na central do mentorado', 'entrega', null),
('Linha Editorial', 9,  'Execução da linha verificada toda semana', 'rotina', 7),
('Linha Editorial', 10, 'Scripts e ideias de conteúdo do mês entregues', 'rotina', 30),
('Linha Editorial', 11, 'Mentorado-referência (só quem não tem acervo)', 'opcional', null),
-- Fábrica de Conteúdo (novo)
('Fábrica de Conteúdo', 0,  'Aceite da Fábrica de Conteúdo (R$8.400 por 3 meses; não mentorado R$16.800)', 'aceite', null),
('Fábrica de Conteúdo', 1,  'Contato avisando que o contrato vai pra revisão', 'entrega', null),
('Fábrica de Conteúdo', 2,  'Contrato da Doxa enviado pra revisão e assinatura', 'entrega', null),
('Fábrica de Conteúdo', 3,  'Contrato assinado', 'trava', null),
('Fábrica de Conteúdo', 4,  'Link de pagamento enviado', 'entrega', null),
('Fábrica de Conteúdo', 5,  'Pagamento confirmado', 'trava', null),
('Fábrica de Conteúdo', 6,  'Conta criada e acesso enviado', 'entrega', null),
('Fábrica de Conteúdo', 7,  'Onboarding marcado e realizado', 'entrega', null),
('Fábrica de Conteúdo', 8,  'Primeiros passos dados pelo Mestre na plataforma', 'trava', null),
('Fábrica de Conteúdo', 9,  '1º lote de vídeos publicado (com auxílio da Olympus)', 'entrega', null),
('Fábrica de Conteúdo', 10, 'Check semanal: está conseguindo, precisa de ajuda', 'rotina', 7),
('Fábrica de Conteúdo', 11, 'Continuidade após os 3 meses (R$900/mês)', 'opcional', null),
-- Automação Instagram (7 existentes com 2 duplicadas, 0 marcação: substitui)
('Automação Instagram', 0,  'Aceite da automação de Instagram (direct)', 'aceite', null),
('Automação Instagram', 1,  'Instagram profissional confirmado', 'trava', null),
('Automação Instagram', 2,  'Mestre cria o app Meta próprio e loga o Instagram nele', 'trava', null),
('Automação Instagram', 3,  'Token e webhooks (comments e messages) validados', 'entrega', null),
('Automação Instagram', 4,  'Fluxo do direct espelhando o quiz da bio (ramos, copy CFM)', 'entrega', null),
('Automação Instagram', 5,  'Palavra-gatilho definida pelo mecanismo único do Mestre', 'trava', null),
('Automação Instagram', 6,  'Link do WhatsApp (frase de origem só se Sistema Black)', 'entrega', null),
('Automação Instagram', 7,  'Workflow no n8n da Olympus ativo e webhook cadastrado', 'entrega', null),
('Automação Instagram', 8,  'Teste real ponta a ponta', 'entrega', null),
('Automação Instagram', 9,  'Refresh de token (30d) e observabilidade', 'entrega', null),
('Automação Instagram', 10, 'Token vivo e revisão mensal do fluxo', 'rotina', 30),
-- Agente de comentários (novo)
('Agente de comentários', 0, 'Aceite do agente de comentários', 'aceite', null),
('Agente de comentários', 1, 'Automação de Instagram no ar (pré-requisito)', 'entrega', null),
('Agente de comentários', 2, 'Varredura dos comentários e respostas existentes via API', 'entrega', null),
('Agente de comentários', 3, 'Grupos de comentário e banco de exemplos semeados com a voz do Mestre', 'entrega', null),
('Agente de comentários', 4, 'Guardrails CFM no prompt', 'entrega', null),
('Agente de comentários', 5, 'Rodada em modo revisão humana (sem publicar)', 'entrega', null),
('Agente de comentários', 6, 'Mestre ou equipe aprova a voz e libera a publicação', 'trava', null),
('Agente de comentários', 7, 'Agente publicando comentários no ar', 'entrega', null),
('Agente de comentários', 8, 'Curadoria semanal (Ítalo e equipe do Mestre)', 'rotina', 7),
('Agente de comentários', 9, 'Handoff pro direct em comentário de lead quente', 'opcional', null),
-- Sistema Black (13 existentes com marcação: títulos intocados, só tipo)
('Sistema Black', 0,  'Solicitar implementação do Sistema Black', 'aceite', null),
('Sistema Black', 1,  'Pedido de dados da Clínica', 'entrega', null),
('Sistema Black', 2,  'Dados Recebidos', 'trava', null),
('Sistema Black', 3,  'Clínica Cadastrada', 'entrega', null),
('Sistema Black', 4,  'Pedido de dados da Equipe', 'entrega', null),
('Sistema Black', 5,  'Dados da equipe recebidos', 'trava', null),
('Sistema Black', 6,  'Equipe Cadastrada', 'entrega', null),
('Sistema Black', 7,  'Conectar WhatsApp', 'trava', null),
('Sistema Black', 8,  'Verificando disponibilidade para data do OnBoarding', 'entrega', null),
('Sistema Black', 9,  'Realizar exportação dos dados da CRM Black', 'opcional', null),
('Sistema Black', 10, 'Realizar importação dos dados da CRM Black', 'opcional', null),
('Sistema Black', 11, 'Realizar Onboarding', 'entrega', null),
('Sistema Black', 12, 'Suporte', 'entrega', null),
-- SDR IA (novo)
('SDR IA', 0,  'Plano contratado (R$500 horário alternativo ou R$1.250 24h)', 'aceite', null),
('SDR IA', 1,  'Checklist de onboarding respondido pela clínica', 'trava', null),
('SDR IA', 2,  'Número dedicado informado (Ítalo conecta ao Sistema Black)', 'trava', null),
('SDR IA', 3,  'Agenda migrada ou slots exclusivos da SDR IA definidos', 'trava', null),
('SDR IA', 4,  'Preços, sinal, convênios e Pix/Asaas entregues', 'trava', null),
('SDR IA', 5,  'Ficha de fatos, configuração e prompt escritos', 'entrega', null),
('SDR IA', 6,  'Clone no número real com allowlist; replay em sandbox aprovado', 'entrega', null),
('SDR IA', 7,  'Teste do Felipe no piloto', 'entrega', null),
('SDR IA', 8,  'Script revisado e testado pela equipe da clínica', 'trava', null),
('SDR IA', 9,  'Cobrança enviada (junto do go-live)', 'entrega', null),
('SDR IA', 10, 'Auto resposta do WhatsApp Business desligada (se estava ligada)', 'opcional', null),
('SDR IA', 11, 'Gates fechados e allowlist removida: SDR IA aberta no número real', 'entrega', null),
('SDR IA', 12, 'Implantação registrada (status, quadro, contexto)', 'entrega', null),
('SDR IA', 13, 'Monitoramento diário: turno revisado e resumo recebido', 'rotina', 1),
('SDR IA', 14, 'Upgrade 24h, segunda agenda, teleconsulta, Asaas próprio, aviso de lead em grupo', 'opcional', null);

-- ── 9. aplica o catálogo ────────────────────────────────────────────────────

do $$
declare
  a record; n_exist int; tem_marca boolean; c record;
begin
  for a in select id, nome from public.artifacts where member_id is null
           and nome in (select distinct art from catalogo) loop

    select exists (select 1 from public.step_progress p
                   join public.artifact_steps s on s.id = p.step_id
                   where s.artifact_id = a.id) into tem_marca;

    if tem_marca then
      -- renome em posição: mesma linha (id), mesma ordem; nada apagado
      select count(*) into n_exist from public.artifact_steps where artifact_id = a.id;
      for c in select * from catalogo where art = a.nome order by ordem loop
        if c.ordem < n_exist then
          update public.artifact_steps s set titulo = c.titulo, tipo = c.tipo, cadencia_dias = c.cad
          where s.id = (select id from public.artifact_steps
                        where artifact_id = a.id order by ordem, criado_em, id
                        offset c.ordem limit 1)
            and (s.titulo <> c.titulo or s.tipo <> c.tipo or s.cadencia_dias is distinct from c.cad);
        elsif not exists (select 1 from public.artifact_steps where artifact_id = a.id and titulo = c.titulo) then
          insert into public.artifact_steps (artifact_id, titulo, ordem, tipo, cadencia_dias)
          values (a.id, c.titulo, c.ordem, c.tipo, c.cad);
        end if;
      end loop;
      -- compacta a ordem só deste artefato, preservando a sequência atual
      update public.artifact_steps s set ordem = n.o
      from (select id, row_number() over (order by ordem, criado_em, id) - 1 as o
            from public.artifact_steps where artifact_id = a.id) n
      where n.id = s.id and s.ordem <> n.o;
    else
      -- sem marcação: substitui o checklist inteiro (duplicatas saem junto)
      delete from public.artifact_steps where artifact_id = a.id;
      insert into public.artifact_steps (artifact_id, titulo, ordem, tipo, cadencia_dias)
      select a.id, titulo, ordem, tipo, cad from catalogo where art = a.nome;
    end if;
  end loop;
end $$;

-- ── 10. Clínica Dr. Alex como projeto (B2C separado da Olympus B2B) ─────────
-- Linha em members sem login: recebe os mesmos artefatos e rotinas dos
-- mentorados. O e-mail é só pra satisfazer o unique; nenhum usuário do auth
-- casa com ele, então o trigger link_member_to_user não liga nada.

insert into public.members (nome, email, iniciais, tier, ativo)
select 'Clínica Dr. Alex Sá', 'clinica.alexsa@oftalmoblack.local', 'CA', 'CLINICA', true
where not exists (select 1 from public.members where nome = 'Clínica Dr. Alex Sá');

notify pgrst, 'reload schema';
commit;

-- ============================================================================
-- PROVA (mesma sessão, depois do commit)
-- ============================================================================

-- 1. nenhuma marcação sumiu: 287 (ou o número do retrato) e EXCEPT vazio
select count(*) as feito_agora from public.step_progress where feito;
(select member_id, step_id from public._bkp_20260906_step_progress where feito)
except
(select member_id, step_id from public.step_progress where feito);

-- 2. catálogo por grupo: contagem por tipo
select g.ordem as g, g.nome as grupo, a.ordem as o, a.nome,
       count(s.id) filter (where s.tipo = 'aceite')   as ace,
       count(s.id) filter (where s.tipo = 'entrega')  as ent,
       count(s.id) filter (where s.tipo = 'trava')    as tra,
       count(s.id) filter (where s.tipo = 'opcional') as opc,
       count(s.id) filter (where s.tipo = 'rotina')   as rot,
       array_to_string(array(select st.apelido from public.staff st where st.id = any(a.responsaveis)), ',') as dono
from public.artifacts a
left join public.artifact_groups g on g.id = a.group_id
left join public.artifact_steps s on s.artifact_id = a.id
where a.member_id is null
group by 1, 2, 3, 4, a.responsaveis
order by 1, 3;
-- esperado (ace/ent/tra/opc/rot), conferido em dry-run 06/09 (rollback): GBP 1/7/3/4/2 · Site 1/8/3/2/1 · Meta Ads 1/6/6/2/2 ·
-- Google Ads 1/6/4/1/1 · Trackeamento 1/10/2/1/1 · Funil VSL 1/7/5/2/1 · Quiz 1/5/5/2/0 ·
-- Linha Editorial 1/4/4/1/2 · Fábrica 1/6/3/1/1 · Automação 1/6/3/0/1 · Agente 1/6/1/1/1 ·
-- Sistema Black 1/7/3/2/0 · SDR IA 1/6/5/2/1 · nenhum grupo nulo

-- 3. as etapas antigas continuam com os mesmos ids (renome em posição)
select b.id, b.titulo as antes, s.titulo as depois, s.tipo, s.ordem
from public._bkp_20260906_artifact_steps b
left join public.artifact_steps s on s.id = b.id
order by b.artifact_id, b.ordem;
-- esperado: só as linhas de Site Institucional, Automação Instagram e Linha
-- Editorial (0 marcação) aparecem com "depois" nulo; todas as outras casam.

-- ============================================================================
-- ROLLBACK (depois do commit, se precisar)
-- ============================================================================
-- update public.artifacts a set group_id = null, ordem = 0, responsaveis = null,
--   nome = b.nome, subtitulo = b.subtitulo from public._bkp_20260906_artifacts b where b.id = a.id;
-- delete from public.artifact_steps s where not exists
--   (select 1 from public._bkp_20260906_artifact_steps b where b.id = s.id);
-- insert into public.artifact_steps (id, artifact_id, titulo, ordem, criado_em)
--   select id, artifact_id, titulo, ordem, criado_em from public._bkp_20260906_artifact_steps
--   on conflict (id) do update set titulo = excluded.titulo, ordem = excluded.ordem;
-- update public.artifact_steps set tipo = 'entrega', cadencia_dias = null;
-- delete from public.artifacts where nome in ('Google Ads','Trackeamento','Funil VSL',
--   'Fábrica de Conteúdo','Agente de comentários','SDR IA') and member_id is null;
-- As marcações nunca saem de step_progress.
