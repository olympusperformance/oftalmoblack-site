-- Checklist único por módulo: equipe e mentorado acompanham a mesma lista de marcos.
-- Substitui, na Subida e na Progressão, a soma de cb_checklist_progress (conferência do
-- método) com step_progress (etapas dos processos). As duas tabelas antigas ficam
-- intactas e só para consulta; o progresso passa a viver em cb_delivery_progress.
begin;

-- Módulos à parte (Fábrica, Íris, Agente de comentários) ganham um agrupador próprio.
alter table public.cb_method_stages drop constraint cb_method_stages_kind_check;
alter table public.cb_method_stages add constraint cb_method_stages_kind_check
  check (kind in ('step','transversal','modulos'));
insert into public.cb_method_stages(id,name,movement,position,kind)
  values ('MODULOS','Módulos à parte',null,14,'modulos');

-- O card continua sendo a entrega. Fundida = absorvida por outro módulo e escondida;
-- referência = mostra o checklist de outro módulo, sem segunda marcação.
alter table public.cb_deliveries
  add column checklist_title text,
  add column treatment text not null default 'implantar'
    check (treatment in ('implantar','hibrida','unificar','monitorar','recorrente','elegibilidade','referencia','fundida')),
  add column cycle text not null default 'unica' check (cycle in ('unica','mensal','edicao')),
  add column accept text,
  add column request_hint text,
  add column metrics_hint text,
  add column shared_with text references public.cb_deliveries(id),
  add column merged_into text references public.cb_deliveries(id),
  add constraint cb_deliveries_um_destino check (shared_with is null or merged_into is null);

create table public.cb_delivery_steps (
  id          uuid primary key default gen_random_uuid(),
  delivery_id text not null references public.cb_deliveries(id),
  position    integer not null check (position > 0),
  title       text not null check (length(trim(title)) > 0),
  owner       text not null check (owner in ('equipe','mentorado')),
  unique (delivery_id, position)
);

-- Sem linha = pendente. Edição: '' (única), 'AAAA-MM' (mensal) ou a data do encontro (D08).
create table public.cb_delivery_progress (
  member_id    uuid not null references public.members(id) on delete cascade,
  step_id      uuid not null references public.cb_delivery_steps(id) on delete cascade,
  edition      text not null default '',
  status       text not null check (status in ('pendente','aguardando','em_validacao','ajuste','concluida','nao_aplica')),
  note         text check (length(note) <= 2000),
  due_on       date,
  requested_at timestamptz,
  responded_at timestamptz,
  done_at      timestamptz,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  actor_name   text,
  primary key (member_id, step_id, edition)
);
create index cb_delivery_progress_status_idx on public.cb_delivery_progress(status) where status in ('aguardando','em_validacao','ajuste');

-- Histórico: cada mudança de situação, com quem fez e por quê.
create table public.cb_delivery_events (
  id         bigint generated always as identity primary key,
  member_id  uuid not null references public.members(id) on delete cascade,
  step_id    uuid not null references public.cb_delivery_steps(id) on delete cascade,
  edition    text not null default '',
  status     text not null,
  note       text,
  actor      uuid,
  actor_name text,
  at         timestamptz not null default now()
);
create index cb_delivery_events_alvo_idx on public.cb_delivery_events(member_id, step_id, edition, at);

alter table public.cb_delivery_steps    enable row level security;
alter table public.cb_delivery_progress enable row level security;
alter table public.cb_delivery_events   enable row level security;
revoke all on public.cb_delivery_steps, public.cb_delivery_progress, public.cb_delivery_events from public, anon, authenticated;
grant select on public.cb_delivery_steps, public.cb_delivery_progress, public.cb_delivery_events to authenticated;
create policy delivery_step_read on public.cb_delivery_steps for select to authenticated using (
  (select public.is_admin()) or exists(select 1 from public.members where user_id=(select auth.uid()) and ativo));
create policy delivery_progress_read on public.cb_delivery_progress for select to authenticated using (
  (select public.is_admin()) or member_id = (select public.current_member_id()));
create policy delivery_event_read on public.cb_delivery_events for select to authenticated using (
  (select public.is_admin()) or member_id = (select public.current_member_id()));

-- Única porta de escrita. A equipe move qualquer marco; o mentorado só entrega
-- (envia para validação) um marco que é dele e ainda não foi concluído.
create or replace function public.cb_registrar_marco(
  p_member uuid, p_step uuid, p_edition text, p_status text, p_note text default null, p_due date default null)
returns public.cb_delivery_progress
language plpgsql security definer set search_path to '' as $$
declare
  s public.cb_delivery_steps; d public.cb_deliveries; atual public.cb_delivery_progress;
  equipe boolean := public.is_admin(); r public.cb_delivery_progress; nome text;
  nota text := nullif(trim(coalesce(p_note,'')),'');
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Entre novamente.'; end if;
  select * into s from public.cb_delivery_steps where id = p_step;
  if not found then raise exception 'Marco inexistente.'; end if;
  select * into d from public.cb_deliveries where id = s.delivery_id;
  if not exists(select 1 from public.members where id = p_member and ativo) then raise exception 'Mentorado inativo ou inexistente.'; end if;
  if p_status not in ('pendente','aguardando','em_validacao','ajuste','concluida','nao_aplica') then raise exception 'Situação inválida.'; end if;
  p_edition := coalesce(p_edition,'');
  if d.cycle = 'unica' and p_edition <> '' then raise exception 'Este módulo não usa ciclo.'; end if;
  if d.cycle = 'mensal' and p_edition !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'Selecione o mês do ciclo.'; end if;
  if d.cycle = 'edicao' and not exists(select 1 from public.cb_encontros e where e.member_id = p_member and e.edition::text = p_edition) then
    raise exception 'Edição não cadastrada para este mentorado.'; end if;
  select * into atual from public.cb_delivery_progress where member_id = p_member and step_id = p_step and edition = p_edition;
  if not equipe then
    if p_member is distinct from public.current_member_id() then raise exception 'Sem permissão.'; end if;
    if s.owner <> 'mentorado' or p_status <> 'em_validacao' or coalesce(atual.status,'pendente') not in ('pendente','aguardando','ajuste') then
      raise exception 'Este marco é conferido pela equipe.'; end if;
  end if;
  if p_status in ('ajuste','nao_aplica') and nota is null then raise exception 'Informe o motivo.'; end if;
  if equipe and p_status = 'pendente' and atual.status in ('concluida','nao_aplica') and nota is null then raise exception 'Informe o motivo da reabertura.'; end if;
  if equipe then select st.nome into nome from public.staff st where st.user_id = auth.uid() and st.ativo order by st.id limit 1; nome := coalesce(nome,'Equipe Black');
  else select m.nome into nome from public.members m where m.id = p_member; end if;
  insert into public.cb_delivery_progress as p (member_id,step_id,edition,status,note,due_on,requested_at,responded_at,done_at,updated_at,updated_by,actor_name)
  values (p_member,p_step,p_edition,p_status,nota,
          case when p_status = 'aguardando' then p_due end,
          case when p_status = 'aguardando' then now() end,
          case when p_status = 'em_validacao' then now() end,
          case when p_status = 'concluida' then now() end,
          now(), auth.uid(), nome)
  on conflict (member_id,step_id,edition) do update set
    status = excluded.status,
    note = coalesce(excluded.note, case when excluded.status = 'concluida' then p.note end),
    due_on = case when excluded.status = 'aguardando' then excluded.due_on when excluded.status in ('em_validacao','ajuste') then p.due_on end,
    requested_at = case when excluded.status = 'aguardando' then coalesce(p.requested_at, now()) when excluded.status in ('em_validacao','ajuste') then p.requested_at end,
    responded_at = case when excluded.status = 'em_validacao' then now() when excluded.status in ('concluida','ajuste') then p.responded_at end,
    done_at = case when excluded.status = 'concluida' then coalesce(p.done_at, now()) end,
    updated_at = now(), updated_by = auth.uid(), actor_name = excluded.actor_name
  returning * into r;
  insert into public.cb_delivery_events(member_id,step_id,edition,status,note,actor,actor_name)
  values (p_member,p_step,p_edition,p_status,nota,auth.uid(),nome);
  return r;
end$$;
revoke all on function public.cb_registrar_marco(uuid,uuid,text,text,text,date) from public, anon;
grant execute on function public.cb_registrar_marco(uuid,uuid,text,text,text,date) to authenticated;

comment on table public.cb_delivery_steps is 'Checklist único do módulo: poucos marcos, cada um com dono (equipe ou mentorado).';
comment on table public.cb_delivery_progress is 'Situação de cada marco por mentorado e ciclo. Escrita só por cb_registrar_marco.';
comment on table public.cb_delivery_events is 'Histórico das mudanças de situação dos marcos.';

-- ── Catálogo: módulos, tratamento e marcos (proposta validada em 29/10/2026) ──
insert into public.cb_deliveries(id,stage_id,name,position) values ('D05/quiz','D05','Quiz',45);
insert into public.cb_deliveries(id,stage_id,name,position) values ('D05/automacao','D05','Automação Instagram',46);
insert into public.cb_deliveries(id,stage_id,name,position) values ('MODULOS/fabrica','MODULOS','Fábrica de Conteúdo',47);
insert into public.cb_deliveries(id,stage_id,name,position) values ('MODULOS/iris','MODULOS','Íris Black',48);
insert into public.cb_deliveries(id,stage_id,name,position) values ('MODULOS/comentarios','MODULOS','Agente de comentários',49);
update public.cb_deliveries set name='Diagnóstico e prioridades do Dia Zero',checklist_title='Onboarding, diagnóstico e plano inicial',treatment='unificar',cycle='unica',accept='Diagnóstico de funil, atração e entrega com fontes e data; plano com três prioridades, responsáveis e próxima ação. Entrada contratual confirmada e acessos testados fazem parte do critério operacional.',request_hint='Pedir os dados ausentes em um formulário; depois solicitar aprovação das prioridades propostas.',metrics_hint='Sem indicador permanente de implantação. Revisar o plano quando abrir um novo ciclo.',shared_with=null where id='D01/diagnostico';
update public.cb_deliveries set name='Identidade e posicionamento',checklist_title='Posicionamento aprovado',treatment='implantar',cycle='unica',accept='Documento reúne mecanismo, arquétipo e identidade; canais previstos revisados.',request_hint='Solicitar aprovação do posicionamento em um único pedido.',metrics_hint='Revisão apenas quando houver mudança de posicionamento.',shared_with=null where id='D02/identidade';
update public.cb_deliveries set name='Linha editorial e scripts',checklist_title='Linha editorial e roteiros',treatment='hibrida',cycle='unica',accept='Documento final e primeira semana pronta; roteiro da VSL vinculado ao Funil VSL, sem segunda entrega do mesmo roteiro.',request_hint='Solicitar referências ausentes e depois a aprovação do material.',metrics_hint='Entrega do pacote mensal e execução semanal; publicações medidas em D05.',shared_with=null where id='D02/conteudo';
update public.cb_deliveries set name='CRM, prontuário e agenda',checklist_title='Sistema Black',treatment='hibrida',cycle='unica',accept='CRM, prontuário e agenda aplicáveis configurados; acessos e WhatsApp testados; equipe executou um fluxo real orientado. A mesma evidência de treinamento vale no Treino.',request_hint='Um pedido de dados da clínica/equipe; depois conexão assistida do WhatsApp.',metrics_hint='Mensagens enviadas pelo sistema em 7/30 dias; dias operacionais com uso; conexão; atendimentos sem resposta; SLA; desfechos elegíveis registrados. Separar envio humano e automático.',shared_with=null where id='D03/sistema';
update public.cb_deliveries set name='Integração de rastreamento',checklist_title='Tracker Black',treatment='unificar',cycle='unica',accept='Teste com evidência de origem no CRM e conversão no destino previsto.',request_hint='Pedir os acessos que realmente faltam; registrar confirmação, nunca senha no pedido.',metrics_hint='Último evento válido, falhas e cobertura de origem; fonte e janela explícitas.',shared_with=null where id='D03/rastreio';
update public.cb_deliveries set name='Responsáveis pelas quatro funções',checklist_title='Time com responsáveis definidos',treatment='implantar',cycle='unica',accept='Cada função necessária tem pessoa ou solução responsável; uma pessoa pode acumular funções.',request_hint='Pedir um formulário com Social Seller, SDR, Closer e equipe clínica.',metrics_hint='Revalidar quando mudar a equipe.',shared_with=null where id='D04/funcoes';
update public.cb_deliveries set name='Formação da equipe premium',checklist_title='Formação da equipe premium',treatment='referencia',cycle='unica',accept=null,request_hint=null,metrics_hint=null,shared_with='TREINO/vendas' where id='D04/formacao';
update public.cb_deliveries set name='Padrões de atendimento',checklist_title='Padrão de atendimento aplicado',treatment='hibrida',cycle='unica',accept='Amostra real aprovada segundo o padrão, com dados pessoais protegidos.',request_hint='Pedir uma evidência de aplicação após orientar a equipe.',metrics_hint='Auditoria periódica de aderência e necessidade de reforço.',shared_with=null where id='D04/atendimento';
update public.cb_deliveries set name='Canais de conteúdo',checklist_title='Instagram, YouTube e TikTok',treatment='monitorar',cycle='unica',accept='Canais escolhidos no plano; YouTube e TikTok só são exigidos quando fizerem parte do escopo.',request_hint='Pedir a ação concreta do canal prioritário, por exemplo enviar o lote de vídeos combinado. Não criar pendência por canais fora do escopo.',metrics_hint='Instagram: vídeos por semana e crescimento no trimestre. YouTube e TikTok: última publicação e frequência dos canais previstos no plano. Mostrar fonte e cobertura de cada canal.',shared_with=null where id='D05/canais';
update public.cb_deliveries set name='Site institucional e AEO',checklist_title='Site Institucional e AEO',treatment='hibrida',cycle='unica',accept='Site e melhorias de AEO do escopo publicados, contatos corretos, conteúdo aprovado e testes técnicos concluídos. Site e processo AEO compartilham esta entrega; critérios que extrapolem o site entram no mesmo escopo, sem segunda conferência.',request_hint='Pedir apenas materiais ausentes e autorização de acesso; depois aprovação da prévia.',metrics_hint='Disponibilidade, atualização de conteúdo e presença nas buscas por conjunto de consultas e período; resultados de busca não concluem a implantação.',shared_with=null where id='D05/site';
update public.cb_deliveries set name='Presença no Google',checklist_title='GBP / Google Meu Negócio',treatment='hibrida',cycle='unica',accept='Ficha correta, publicada e verificável; link de avaliações entregue.',request_hint='Pedir acesso, fotos e confirmação de serviços/horários sem repetir dados já recebidos.',metrics_hint='Publicações, avaliações pendentes e interações por período; indicadores automáticos só após integração validada.',shared_with=null where id='D05/google';
update public.cb_deliveries set name='Rotina de artigos',checklist_title='Publicação de artigos',treatment='recorrente',cycle='mensal',accept='URL do artigo e data de publicação no ciclo correspondente.',request_hint='Pedir revisão apenas do artigo pronto, com link e prazo.',metrics_hint='Artigos publicados por mês e tempo desde a última publicação.',shared_with=null where id='D05/blog';
update public.cb_deliveries set name='Funil Expresso e VSL',checklist_title='Funil VSL',treatment='hibrida',cycle='unica',accept='Vídeo hospedado, página e WhatsApp corretos, qualificação e medição testadas.',request_hint='Pedir gravação com roteiro já disponível e depois revisão/link da bio.',metrics_hint='Visitas, reprodução/conclusão do vídeo e leads qualificados por período.',shared_with=null where id='D06/vsl';
update public.cb_deliveries set name='Funil Olympus',checklist_title='Funil Olympus e chamadas',treatment='hibrida',cycle='unica',accept='Caminho da entrada até a chamada validado e vinculado ao resgate em D09.',request_hint='Pedir somente oferta, agenda ou aprovação pendente.',metrics_hint='Entradas, chamadas e avanço por período.',shared_with=null where id='D06/olympus';
update public.cb_deliveries set name='Campanhas Meta Ads',checklist_title='Meta Ads',treatment='hibrida',cycle='unica',accept='No escopo de gestão: campanha autorizada, ativa, com rastreamento validado e primeira leitura entregue. A estrutura técnica da campanha fica no procedimento da equipe.',request_hint='Um pedido reúne permissões, verba e materiais; reutilizar o acesso já concedido a outras entregas.',metrics_hint='Status de veiculação, gasto, leads e custo por resultado; orçamento pausado tem motivo registrado.',shared_with=null where id='D06/meta';
update public.cb_deliveries set name='Campanhas Google Ads',checklist_title='Google Ads',treatment='hibrida',cycle='unica',accept='Campanha no ar para os procedimentos contratados e teste de atribuição concluído.',request_hint='Pedir vínculo da conta e verba; depois aprovação do material pronto.',metrics_hint='Gasto, leads, termos de busca e custo por resultado por período.',shared_with=null where id='D06/google';
update public.cb_deliveries set name='Rastreamento anúncio → cirurgia',checklist_title='Tracker Black',treatment='referencia',cycle='unica',accept=null,request_hint=null,metrics_hint=null,shared_with='D03/rastreio' where id='D06/rastreio';
update public.cb_deliveries set name='Gestão mensal do tráfego',checklist_title='Gestão do tráfego por ciclo',treatment='recorrente',cycle='mensal',accept='Registro do orçamento e da análise mensal com próximos responsáveis.',request_hint='Pedir verba somente no ciclo contratado; pedir decisão do médico quando houver ajuste de oferta ou orçamento.',metrics_hint='CPV-Cirurgia, gasto e resultados com denominador e janela de atribuição.',shared_with=null where id='D06/gestao';
update public.cb_deliveries set name='Prospecção pelo Social Seller',checklist_title='Social Seller em atividade',treatment='hibrida',cycle='unica',accept='Responsável, abordagem e registro de origem definidos.',request_hint='Pedir responsável e uma primeira amostra de execução.',metrics_hint='Contatos válidos e agendamentos por semana; metas ajustadas à operação.',shared_with=null where id='D07/prospeccao';
update public.cb_deliveries set name='Indicação ativa',checklist_title='Indicação ativa nas altas',treatment='hibrida',cycle='unica',accept='Momento, responsável e forma de registro definidos.',request_hint='Pedir validação da primeira aplicação.',metrics_hint='Altas elegíveis com pedido de indicação / altas elegíveis; indicações geradas.',shared_with=null where id='D07/indicacao';
update public.cb_deliveries set name='Leads Bônus',checklist_title='Leads Bônus',treatment='elegibilidade',cycle='unica',accept='Requisitos de elegibilidade explícitos, com fonte e data. A equivalência com a regra vigente de D03, D05 e D06 auditados precisa ser validada antes da implantação; a nova barra não libera o benefício sozinha.',request_hint='Se inelegível, mostrar qual condição precisa de ação e o dono; solicitar só a ação cabível ao mentorado.',metrics_hint='Elegibilidade; leads recebidos; percentual com desfecho no período.',shared_with=null where id='D07/bonus';
update public.cb_deliveries set name='Divulgação, participação e leads da edição',checklist_title='Encontro Grau Zero',treatment='recorrente',cycle='edicao',accept='Divulgação e vídeos de grupo/tráfego conferidos; presença efetiva comprovada; distribuição registrada e carteira tratada quando houver leads. Sem distribuição, atendimento é não aplicável. Intenção de participar não comprova presença.',request_hint='Pedir divulgação e vídeos com briefing e prazo. Depois da distribuição, solicitar atendimento com link para a carteira. Cada pedido referencia uma etapa deste mesmo checklist.',metrics_hint='Prazo e situação da edição; presença; leads recebidos, sem resposta e com desfecho. Histórico separado por edição.',shared_with=null where id='D08/divulgacao';
update public.cb_deliveries set name='Preparação da Closer e agenda',checklist_title='Chamada consultiva preparada',treatment='implantar',cycle='unica',accept='Responsável e horários ativos; competência de chamada validada no registro compartilhado de treinamento comercial, sem segunda marcação de presença.',request_hint='Pedir responsável e horários; agendar formação apenas se ainda faltar.',metrics_hint='Chamadas por semana; consultas geradas / chamadas elegíveis, com amostra e período. Meta atual de conversão: 60%. Sem chamadas, mostrar ausência de amostra.',shared_with=null where id='D09/preparo';
update public.cb_deliveries set name='Funil de chamadas e resgate',checklist_title='Resgate de leads em operação',treatment='hibrida',cycle='unica',accept='Teste de oferta de chamada e primeiro ciclo registrado.',request_hint='Pedir execução quando fluxo, carteira e orientação estiverem disponíveis.',metrics_hint='Carteira elegível contatada e agendamentos por ciclo mensal.',shared_with=null where id='D09/resgate';
update public.cb_deliveries set name='Qualificação pelo SDR',checklist_title='Qualificação pelo SDR',treatment='hibrida',cycle='unica',accept='SDR apta e critério de passagem aplicado em caso real.',request_hint='Pedir escolha entre SDR humana e Íris, dados que faltam e validação.',metrics_hint='Tempo de primeira resposta e qualidade da qualificação.',shared_with=null where id='D10/qualificacao';
update public.cb_deliveries set name='Preparação da venda consultiva',checklist_title='Venda consultiva preparada',treatment='implantar',cycle='unica',accept='Critérios de agenda registrados e aplicação do In The Bag validada em amostra. Sessão e formação ficam no Treinamento comercial; este marco comprova a aplicação específica.',request_hint='Solicitar participação e uma evidência de aplicação.',metrics_hint='Aderência à qualificação e conversão por etapa.',shared_with=null where id='D10/consulta';
update public.cb_deliveries set name='Fechamento pós-consulta',checklist_title='Acompanhamento pós-consulta',treatment='hibrida',cycle='unica',accept='Fluxo testado, responsável e motivo de objeção registrados.',request_hint='Pedir aplicação após disponibilizar a carteira e a orientação.',metrics_hint='Cobertura de follow-up, atrasos e objeções por período.',shared_with=null where id='D10/fechamento';
update public.cb_deliveries set name='Rituais de encantamento',checklist_title='Três rituais de encantamento aplicados',treatment='implantar',cycle='unica',accept='Nome, momento, responsável e evidência dos três rituais; 4º a 7º permanecem opcionais.',request_hint='Um pedido reúne os três rituais e suas evidências.',metrics_hint='Revisão de aderência em amostra periódica.',shared_with=null where id='D11/rituais';
update public.cb_deliveries set name='Medição da experiência e indicações',checklist_title='Experiência do paciente acompanhada',treatment='hibrida',cycle='unica',accept='Canal, momento e responsável da coleta definidos; primeira resposta válida.',request_hint='Pedir aplicação quando o instrumento estiver disponível.',metrics_hint='NPS com amostra e período; indicações espontâneas identificadas.',shared_with=null where id='D11/experiencia';
update public.cb_deliveries set name='Depoimentos e provas',checklist_title='Depoimentos e provas do ciclo',treatment='recorrente',cycle='mensal',accept='Material utilizável e autorização registrada; dados sensíveis fora do relatório de progresso.',request_hint='Pedir o lote combinado, com orientação sobre autorização de uso.',metrics_hint='Depoimentos válidos por mês conforme meta combinada.',shared_with=null where id='D11/provas';
update public.cb_deliveries set name='Seguro Premium',checklist_title='Seguro Premium estruturado',treatment='hibrida',cycle='unica',accept='Material e fluxo aprovados pelos responsáveis competentes; o plano não redefine cobertura ou condições.',request_hint='Pedir aprovação das condições e confirmar responsável pela oferta.',metrics_hint='Percentual de altas elegíveis com oferta e adesões por período.',shared_with=null where id='D12/seguro';
update public.cb_deliveries set name='Pacotes Cuidado Premium',checklist_title='Pacotes Cuidado Premium',treatment='hibrida',cycle='unica',accept='Oferta, regras e fluxo de agendamento registrados.',request_hint='Pedir validação dos pacotes e responsáveis.',metrics_hint='Ofertas, adesões e execução por período.',shared_with=null where id='D12/cuidado';
update public.cb_deliveries set name='Retorno de seis meses',checklist_title='Retorno de seis meses',treatment='hibrida',cycle='unica',accept='Teste de elegibilidade, envio e agendamento concluído.',request_hint='Pedir regras/agenda que faltam, sem pedir à clínica para implementar automação.',metrics_hint='Pacientes elegíveis, convites enviados e retornos agendados; janela de seis meses.',shared_with=null where id='D12/retorno';
update public.cb_deliveries set name='Formação compartilhada de vendas e atendimento',checklist_title='Treinamento comercial',treatment='unificar',cycle='unica',accept='Uma sessão/evidência com competências discriminadas: cultura e atendimento premium, chamada consultiva e venda consultiva. Cada competência é conferida; a mesma presença não é cobrada novamente em D04, D09 e D10.',request_hint='Convite com participantes e objetivos; solicitar reposição só a quem faltou.',metrics_hint='Reforços definidos por desempenho e mudanças no time.',shared_with=null where id='TREINO/vendas';
update public.cb_deliveries set name='Treinamento do Sistema Black',checklist_title='Formação no Sistema Black',treatment='referencia',cycle='unica',accept=null,request_hint=null,metrics_hint=null,shared_with='D03/sistema' where id='TREINO/sistema';
update public.cb_deliveries set name='Treinamento de Growth',checklist_title='Alinhamento de Growth',treatment='implantar',cycle='unica',accept='Registro da sessão, decisões e próximos passos.',request_hint='Pedir participação e decisões necessárias na sessão.',metrics_hint='Novas sessões por ciclo, quando contratadas.',shared_with=null where id='TREINO/growth';
update public.cb_deliveries set name='Treinamento de conteúdo',checklist_title='Formação em conteúdo',treatment='implantar',cycle='unica',accept='Primeiro conteúdo ou exercício revisado.',request_hint='Pedir presença e primeira aplicação orientada.',metrics_hint='Produção observada em D05; reciclagem quando necessário.',shared_with=null where id='TREINO/conteudo';
update public.cb_deliveries set name='Rotina de formação da equipe',checklist_title='Rotina de formação',treatment='recorrente',cycle='mensal',accept='Uma ocorrência por atividade combinada: encontro, roleplay ou aulão. Cada ocorrência tem data, participantes e fonte de presença. Não exigir segunda confirmação do mesmo comparecimento.',request_hint='Lembretes de encontros, roleplay e aulão combinados para o ciclo.',metrics_hint='Presença, roleplay do mês e aulão da equipe; histórico por ciclo.',shared_with=null where id='TREINO/rotina';
update public.cb_deliveries set name='Quiz',checklist_title='Quiz',treatment='hibrida',cycle='unica',accept='Página acessível, informações corretas, WhatsApp alinhado ao CRM e rastreamento testado. Domínio próprio, teleconsulta e campanha entram somente quando previstos no escopo.',request_hint='Pedir dados ausentes de praça, procedimentos, valor da consulta, endereço e WhatsApp. Depois, aprovação da prévia e atualização do link da bio.',metrics_hint='Disponibilidade, visitas, preenchimentos, cliques e leads atribuídos por período; fonte e cobertura identificadas.',shared_with=null where id='D05/quiz';
update public.cb_deliveries set name='Automação Instagram',checklist_title='Automação Instagram',treatment='hibrida',cycle='unica',accept='Teste real ponta a ponta aprovado, destino correto e automação ativa. Token e webhook conferidos pela equipe.',request_hint='Solicitar conexão, dados ausentes e aprovação do fluxo pronto. Configuração técnica pertence à equipe.',metrics_hint='Saúde da conexão, execuções, falhas e conversas iniciadas.',shared_with=null where id='D05/automacao';
update public.cb_deliveries set name='Fábrica de Conteúdo',checklist_title='Fábrica de Conteúdo',treatment='hibrida',cycle='unica',accept='Contratação confirmada, acesso testado, onboarding realizado e primeiro lote publicado.',request_hint='Pedir assinatura/pagamento e materiais no momento correspondente, com instrução e prazo.',metrics_hint='Produção e publicação por ciclo. Suporte e renovação são operação, sem reabrir implantação.',shared_with=null where id='MODULOS/fabrica';
update public.cb_deliveries set name='Íris Black',checklist_title='Íris Black',treatment='hibrida',cycle='unica',accept='Testes internos concluídos, regras e agenda confirmadas, piloto aprovado e operação ativada com monitoramento.',request_hint='Solicitar dados da clínica e regras de atendimento; depois, revisão do piloto pronto.',metrics_hint='Atendimentos, tempo de resposta, falhas e agendamentos atribuídos. D10 referencia este registro quando usar SDR IA.',shared_with=null where id='MODULOS/iris';
update public.cb_deliveries set name='Agente de comentários',checklist_title='Agente de comentários',treatment='hibrida',cycle='unica',accept='Automação Instagram necessária disponível, exemplos aprovados e primeira execução válida. Curadoria posterior é acompanhamento.',request_hint='Solicitar autorização/conexão e aprovação de exemplos em linguagem simples.',metrics_hint='Execuções bem-sucedidas, respostas, falhas e tempo de resposta. Ausência de comentários recebidos não é falha.',shared_with=null where id='MODULOS/comentarios';
update public.cb_deliveries set merged_into='D01/diagnostico',treatment='fundida' where id='D01/prioridades';
update public.cb_deliveries set merged_into='D03/sistema',treatment='fundida' where id='D03/operacao';
update public.cb_deliveries set merged_into='D08/divulgacao',treatment='fundida' where id='D08/participacao';
update public.cb_deliveries set merged_into='D08/divulgacao',treatment='fundida' where id='D08/leads';
update public.cb_deliveries set merged_into='D09/preparo',treatment='fundida' where id='D09/resultado';
update public.cb_deliveries set shared_with='MODULOS/comentarios',treatment='referencia',checklist_title='Agente de comentários' where id='D05/comentarios';
insert into public.cb_delivery_artifacts(delivery_id,stage_id,artifact_id)
 select d.delivery_id,'D05',a.id from (values ('D05/quiz','Quiz'),('D05/automacao','Automação Instagram'),('D05/site','AEO')) d(delivery_id,nome)
 join public.artifacts a on a.nome=d.nome and 'D05'=any(a.method_steps) and a.archived_at is null and a.tipo='artefato'
 on conflict do nothing;
insert into public.cb_delivery_steps(delivery_id,position,title,owner) values
 ('D01/diagnostico',1,'Informações da clínica confirmadas','mentorado'),
 ('D01/diagnostico',2,'Diagnóstico das três frentes consolidado','equipe'),
 ('D01/diagnostico',3,'Plano inicial e acessos entregues','equipe'),
 ('D01/diagnostico',4,'Prioridades do ciclo aprovadas','mentorado'),
 ('D02/identidade',1,'Proposta de posicionamento entregue','equipe'),
 ('D02/identidade',2,'Posicionamento aprovado','mentorado'),
 ('D02/identidade',3,'Identidade aplicada nos canais combinados','equipe'),
 ('D02/conteudo',1,'Referências e direcionamento confirmados','mentorado'),
 ('D02/conteudo',2,'Linha editorial e roteiros entregues','equipe'),
 ('D02/conteudo',3,'Material aprovado','mentorado'),
 ('D03/sistema',1,'Dados da clínica e equipe enviados','mentorado'),
 ('D03/sistema',2,'Clínica, equipe e módulos configurados','equipe'),
 ('D03/sistema',3,'WhatsApp conectado','mentorado'),
 ('D03/sistema',4,'Equipe treinada e operação validada','equipe'),
 ('D03/rastreio',1,'Acessos necessários liberados','mentorado'),
 ('D03/rastreio',2,'Rastreamento instalado','equipe'),
 ('D03/rastreio',3,'Origem e conversão testadas ponta a ponta','equipe'),
 ('D04/funcoes',1,'Responsáveis pelas funções informados','mentorado'),
 ('D04/funcoes',2,'Cobertura das funções validada','equipe'),
 ('D04/atendimento',1,'Padrão de atendimento entregue','equipe'),
 ('D04/atendimento',2,'Padrão aplicado pela equipe','mentorado'),
 ('D04/atendimento',3,'Atendimento amostral validado','equipe'),
 ('D05/site',1,'Materiais e acesso ao domínio enviados','mentorado'),
 ('D05/site',2,'Prévia do site entregue','equipe'),
 ('D05/site',3,'Prévia aprovada','mentorado'),
 ('D05/site',4,'Site publicado e validado','equipe'),
 ('D05/google',1,'Acesso e informações da clínica confirmados','mentorado'),
 ('D05/google',2,'Perfil revisado e materiais publicados','equipe'),
 ('D05/google',3,'Informações finais aprovadas','mentorado'),
 ('D05/blog',1,'Artigo do ciclo preparado','equipe'),
 ('D05/blog',2,'Conteúdo aprovado quando necessário','mentorado'),
 ('D05/blog',3,'Artigo publicado','equipe'),
 ('D06/vsl',1,'Roteiro e orientação entregues','equipe'),
 ('D06/vsl',2,'Vídeo e informações finais enviados','mentorado'),
 ('D06/vsl',3,'Funil pronto em link estável para revisão','equipe'),
 ('D06/vsl',4,'Funil aprovado e link da bio atualizado','mentorado'),
 ('D06/vsl',5,'Operação liberada e fluxo final validado','equipe'),
 ('D06/olympus',1,'Fluxo do funil definido','equipe'),
 ('D06/olympus',2,'Oferta e agenda confirmadas','mentorado'),
 ('D06/olympus',3,'Fluxo publicado e testado','equipe'),
 ('D06/meta',1,'Acessos, verba e criativos confirmados','mentorado'),
 ('D06/meta',2,'Campanha preparada','equipe'),
 ('D06/meta',3,'Veiculação aprovada','mentorado'),
 ('D06/meta',4,'Campanha ativada e primeira leitura entregue','equipe'),
 ('D06/google',1,'Acesso, verba e procedimentos confirmados','mentorado'),
 ('D06/google',2,'Campanha preparada','equipe'),
 ('D06/google',3,'Veiculação aprovada','mentorado'),
 ('D06/google',4,'Campanha ativada e conversão validada','equipe'),
 ('D06/gestao',1,'Verba do ciclo confirmada','mentorado'),
 ('D06/gestao',2,'Análise do funil e próximos ajustes entregues','equipe'),
 ('D07/prospeccao',1,'Responsável indicado','mentorado'),
 ('D07/prospeccao',2,'Rotina de prospecção orientada','equipe'),
 ('D07/prospeccao',3,'Primeira execução validada','mentorado'),
 ('D07/indicacao',1,'Abordagem de indicação definida','equipe'),
 ('D07/indicacao',2,'Abordagem aplicada pela equipe','mentorado'),
 ('D08/divulgacao',1,'Divulgação e vídeos da edição enviados','mentorado'),
 ('D08/divulgacao',2,'Materiais conferidos e divulgação preparada','equipe'),
 ('D08/divulgacao',3,'Presença efetiva na edição registrada','equipe'),
 ('D08/divulgacao',4,'Leads da edição disponibilizados quando houver','equipe'),
 ('D08/divulgacao',5,'Carteira recebida atendida','mentorado'),
 ('D09/preparo',1,'Closer e horários definidos','mentorado'),
 ('D09/preparo',2,'Agenda e competência de chamada validadas','equipe'),
 ('D09/resgate',1,'Fluxo de resgate configurado','equipe'),
 ('D09/resgate',2,'Equipe executou o primeiro ciclo','mentorado'),
 ('D10/qualificacao',1,'Solução SDR e responsável definidos','mentorado'),
 ('D10/qualificacao',2,'Regras de qualificação orientadas','equipe'),
 ('D10/qualificacao',3,'Qualificação inicial validada','mentorado'),
 ('D10/consulta',1,'Critérios de agenda e aplicação do método definidos','equipe'),
 ('D10/consulta',2,'Closer e médico aplicaram o fluxo','mentorado'),
 ('D10/consulta',3,'Aplicação inicial validada','equipe'),
 ('D10/fechamento',1,'Cadência e registro de objeções configurados','equipe'),
 ('D10/fechamento',2,'Primeira carteira acompanhada','mentorado'),
 ('D11/rituais',1,'Três rituais escolhidos e aplicados','mentorado'),
 ('D11/rituais',2,'Aplicação dos rituais validada','equipe'),
 ('D11/experiencia',1,'Coleta de satisfação configurada','equipe'),
 ('D11/experiencia',2,'Primeira coleta aplicada','mentorado'),
 ('D11/provas',1,'Depoimentos autorizados enviados','mentorado'),
 ('D11/provas',2,'Materiais organizados e disponibilizados','equipe'),
 ('D12/seguro',1,'Estrutura da oferta preparada','equipe'),
 ('D12/seguro',2,'Condições aprovadas','mentorado'),
 ('D12/seguro',3,'Oferta e orientação disponibilizadas','equipe'),
 ('D12/cuidado',1,'Pacotes e fluxo propostos','equipe'),
 ('D12/cuidado',2,'Condições aprovadas','mentorado'),
 ('D12/cuidado',3,'Pacotes disponibilizados','equipe'),
 ('D12/retorno',1,'Régua de retorno configurada','equipe'),
 ('D12/retorno',2,'Regras e agenda confirmadas','mentorado'),
 ('D12/retorno',3,'Régua testada','equipe'),
 ('TREINO/vendas',1,'Participantes e competências definidos','equipe'),
 ('TREINO/vendas',2,'Time participou da formação','mentorado'),
 ('TREINO/vendas',3,'Competências demonstradas e próximos reforços registrados','equipe'),
 ('TREINO/growth',1,'Diagnóstico e pauta preparados','equipe'),
 ('TREINO/growth',2,'Alinhamento realizado','mentorado'),
 ('TREINO/growth',3,'Ações e responsáveis registrados','equipe'),
 ('TREINO/conteudo',1,'Orientação e exemplos disponibilizados','equipe'),
 ('TREINO/conteudo',2,'Participação e aplicação inicial realizadas','mentorado'),
 ('TREINO/rotina',1,'Participação na atividade do ciclo','mentorado'),
 ('TREINO/rotina',2,'Presença e aplicação registradas','equipe'),
 ('D05/quiz',1,'Informações e acessos confirmados','mentorado'),
 ('D05/quiz',2,'Quiz preparado em link estável para revisão','equipe'),
 ('D05/quiz',3,'Quiz aprovado e link da bio atualizado','mentorado'),
 ('D05/quiz',4,'Publicação e fluxo validados','equipe'),
 ('D05/automacao',1,'Conta e permissões conectadas','mentorado'),
 ('D05/automacao',2,'Fluxo configurado','equipe'),
 ('D05/automacao',3,'Fluxo aprovado','mentorado'),
 ('D05/automacao',4,'Teste concluído e automação ativada','equipe'),
 ('MODULOS/fabrica',1,'Contratação concluída','mentorado'),
 ('MODULOS/fabrica',2,'Acesso e onboarding entregues','equipe'),
 ('MODULOS/fabrica',3,'Primeiro material enviado','mentorado'),
 ('MODULOS/fabrica',4,'Primeiro lote publicado','equipe'),
 ('MODULOS/iris',1,'Dados, número e agenda confirmados','mentorado'),
 ('MODULOS/iris',2,'Agente configurado e testado','equipe'),
 ('MODULOS/iris',3,'Piloto aprovado','mentorado'),
 ('MODULOS/iris',4,'Operação ativada','equipe'),
 ('MODULOS/comentarios',1,'Conexão e voz autorizadas','mentorado'),
 ('MODULOS/comentarios',2,'Agente configurado e testado','equipe'),
 ('MODULOS/comentarios',3,'Exemplos de resposta aprovados','mentorado'),
 ('MODULOS/comentarios',4,'Agente ativado','equipe');

-- ── Conversão das listas antigas (cb_checklist_progress + step_progress + cb_encontros) ──
create temporary table _depara(delivery_id text,position int,alt int,ref text) on commit drop;
insert into _depara values
 ('D01/diagnostico',1,1,'Onboarding#4'),
 ('D01/diagnostico',2,1,'D01-01'),
 ('D01/diagnostico',2,1,'D01-02'),
 ('D01/diagnostico',2,1,'D01-03'),
 ('D01/diagnostico',3,1,'Onboarding#6'),
 ('D01/diagnostico',3,1,'Onboarding#9'),
 ('D01/diagnostico',4,1,'D01-04'),
 ('D02/identidade',1,1,'D02-01'),
 ('D02/identidade',1,1,'D02-03'),
 ('D02/identidade',2,1,'D02-01'),
 ('D02/identidade',2,1,'D02-03'),
 ('D02/identidade',3,1,'D02-02'),
 ('D02/conteudo',1,1,'Linha Editorial#2'),
 ('D02/conteudo',1,1,'Linha Editorial#5'),
 ('D02/conteudo',2,1,'D02-04'),
 ('D02/conteudo',2,1,'D02-05'),
 ('D02/conteudo',2,2,'Linha Editorial#6'),
 ('D02/conteudo',3,1,'D02-06'),
 ('D02/conteudo',3,2,'Linha Editorial#7'),
 ('D03/sistema',1,1,'Sistema Black#2'),
 ('D03/sistema',1,1,'Sistema Black#5'),
 ('D03/sistema',2,1,'Sistema Black#3'),
 ('D03/sistema',2,1,'Sistema Black#6'),
 ('D03/sistema',2,2,'D03-01'),
 ('D03/sistema',2,2,'D03-02'),
 ('D03/sistema',2,2,'D03-03'),
 ('D03/sistema',3,1,'Sistema Black#7'),
 ('D03/sistema',4,1,'Sistema Black#11'),
 ('D03/sistema',4,2,'TREINO-02'),
 ('D03/rastreio',1,1,'Tracker Black#1'),
 ('D03/rastreio',1,1,'Tracker Black#2'),
 ('D03/rastreio',2,1,'Tracker Black#3'),
 ('D03/rastreio',3,1,'Tracker Black#6'),
 ('D03/rastreio',3,2,'D03-04'),
 ('D03/rastreio',3,3,'D06-09'),
 ('D04/funcoes',1,1,'D04-01'),
 ('D04/funcoes',1,1,'D04-02'),
 ('D04/funcoes',1,1,'D04-03'),
 ('D04/funcoes',1,1,'D04-04'),
 ('D04/funcoes',2,1,'D04-01'),
 ('D04/funcoes',2,1,'D04-02'),
 ('D04/funcoes',2,1,'D04-03'),
 ('D04/funcoes',2,1,'D04-04'),
 ('D04/atendimento',1,1,'D04-07'),
 ('D04/atendimento',2,1,'D04-07'),
 ('D04/atendimento',3,1,'D04-07'),
 ('D05/site',1,1,'Site Institucional#2'),
 ('D05/site',1,1,'Site Institucional#3'),
 ('D05/site',2,1,'Site Institucional#5'),
 ('D05/site',3,1,'Site Institucional#6'),
 ('D05/site',4,1,'Site Institucional#8'),
 ('D05/site',4,2,'D05-05'),
 ('D05/google',1,1,'GBP#2'),
 ('D05/google',2,1,'GBP#7'),
 ('D05/google',2,1,'GBP#10'),
 ('D05/google',2,2,'D05-07'),
 ('D05/google',3,1,'GBP#6'),
 ('D05/blog',1,1,'D05-08'),
 ('D05/blog',2,1,'D05-08'),
 ('D05/blog',3,1,'D05-08'),
 ('D06/vsl',1,1,'Funil VSL#4'),
 ('D06/vsl',2,1,'Funil VSL#5'),
 ('D06/vsl',2,1,'Funil VSL#6'),
 ('D06/vsl',2,2,'D06-02'),
 ('D06/vsl',3,1,'Funil VSL#9'),
 ('D06/vsl',3,2,'D06-01'),
 ('D06/vsl',4,1,'D06-06'),
 ('D06/vsl',4,2,'Funil VSL#11'),
 ('D06/vsl',5,1,'Funil VSL#12'),
 ('D06/vsl',5,2,'D06-03'),
 ('D06/vsl',5,2,'D06-04'),
 ('D06/olympus',1,1,'D06-05'),
 ('D06/olympus',2,1,'D06-05'),
 ('D06/olympus',3,1,'D06-05'),
 ('D06/meta',1,1,'Meta Ads#1'),
 ('D06/meta',1,1,'Meta Ads#5'),
 ('D06/meta',2,1,'Meta Ads#7'),
 ('D06/meta',3,1,'Meta Ads#9'),
 ('D06/meta',4,1,'Meta Ads#10'),
 ('D06/meta',4,1,'Meta Ads#11'),
 ('D06/meta',4,2,'D06-07'),
 ('D06/google',1,1,'Google Ads#2'),
 ('D06/google',1,1,'Google Ads#3'),
 ('D06/google',2,1,'Google Ads#4'),
 ('D06/google',2,1,'Google Ads#5'),
 ('D06/google',2,1,'Google Ads#6'),
 ('D06/google',3,1,'Google Ads#7'),
 ('D06/google',4,1,'Google Ads#8'),
 ('D06/google',4,1,'Google Ads#9'),
 ('D06/google',4,2,'D06-08'),
 ('D06/gestao',1,1,'D06-10'),
 ('D06/gestao',2,1,'D06-11'),
 ('D07/prospeccao',1,1,'D04-01'),
 ('D07/prospeccao',2,1,'D07-01'),
 ('D07/prospeccao',3,1,'D07-01'),
 ('D07/prospeccao',3,2,'D07-02'),
 ('D07/indicacao',1,1,'D07-03'),
 ('D07/indicacao',2,1,'D07-03'),
 ('D08/divulgacao',1,1,'D08-01'),
 ('D08/divulgacao',1,1,'D08-02'),
 ('D08/divulgacao',1,1,'D08-03'),
 ('D08/divulgacao',1,2,'enc:publicized'),
 ('D08/divulgacao',1,2,'enc:video_group'),
 ('D08/divulgacao',1,2,'enc:video_ads'),
 ('D08/divulgacao',2,1,'D08-01'),
 ('D08/divulgacao',2,1,'D08-02'),
 ('D08/divulgacao',2,1,'D08-03'),
 ('D08/divulgacao',2,2,'enc:publicized'),
 ('D08/divulgacao',2,2,'enc:video_group'),
 ('D08/divulgacao',2,2,'enc:video_ads'),
 ('D08/divulgacao',3,1,'D08-04'),
 ('D08/divulgacao',3,2,'enc:attended'),
 ('D08/divulgacao',4,1,'D08-05'),
 ('D08/divulgacao',5,1,'D08-06'),
 ('D09/preparo',1,1,'D09-02'),
 ('D09/preparo',2,1,'D09-01'),
 ('D09/preparo',2,1,'D09-02'),
 ('D09/resgate',1,1,'D09-03'),
 ('D09/resgate',2,1,'D09-04'),
 ('D10/qualificacao',1,1,'D10-01'),
 ('D10/qualificacao',2,1,'D10-01'),
 ('D10/qualificacao',3,1,'D10-02'),
 ('D10/consulta',1,1,'D10-04'),
 ('D10/consulta',2,1,'D10-03'),
 ('D10/consulta',2,1,'D10-04'),
 ('D10/consulta',3,1,'D10-03'),
 ('D10/consulta',3,1,'D10-04'),
 ('D10/fechamento',1,1,'D10-05'),
 ('D10/fechamento',1,1,'D10-06'),
 ('D10/fechamento',2,1,'D10-05'),
 ('D11/rituais',1,1,'D11-01'),
 ('D11/rituais',1,1,'D11-02'),
 ('D11/rituais',1,1,'D11-03'),
 ('D11/rituais',2,1,'D11-01'),
 ('D11/rituais',2,1,'D11-02'),
 ('D11/rituais',2,1,'D11-03'),
 ('D11/experiencia',1,1,'D11-08'),
 ('D11/experiencia',2,1,'D11-08'),
 ('D11/provas',1,1,'D11-09'),
 ('D11/provas',2,1,'D11-09'),
 ('D12/seguro',1,1,'D12-01'),
 ('D12/seguro',2,1,'D12-01'),
 ('D12/seguro',3,1,'D12-01'),
 ('D12/cuidado',1,1,'D12-03'),
 ('D12/cuidado',2,1,'D12-03'),
 ('D12/cuidado',3,1,'D12-03'),
 ('D12/retorno',1,1,'D12-04'),
 ('D12/retorno',2,1,'D12-04'),
 ('D12/retorno',3,1,'D12-04'),
 ('TREINO/vendas',1,1,'Treinamento comercial#1'),
 ('TREINO/vendas',1,2,'TREINO-01'),
 ('TREINO/vendas',2,1,'TREINO-01'),
 ('TREINO/vendas',2,2,'Treinamento comercial#4'),
 ('TREINO/vendas',3,1,'Treinamento comercial#5'),
 ('TREINO/vendas',3,2,'D04-05'),
 ('TREINO/vendas',3,2,'D04-06'),
 ('TREINO/growth',1,1,'TREINO-03'),
 ('TREINO/growth',2,1,'TREINO-03'),
 ('TREINO/growth',3,1,'TREINO-03'),
 ('TREINO/conteudo',1,1,'TREINO-04'),
 ('TREINO/conteudo',2,1,'TREINO-04'),
 ('TREINO/rotina',1,1,'TREINO-06'),
 ('TREINO/rotina',1,2,'TREINO-07'),
 ('TREINO/rotina',2,1,'TREINO-06'),
 ('TREINO/rotina',2,2,'TREINO-07'),
 ('D05/quiz',1,1,'Quiz#1'),
 ('D05/quiz',2,1,'Quiz#2'),
 ('D05/quiz',3,1,'Quiz#3'),
 ('D05/quiz',3,1,'Quiz#8'),
 ('D05/quiz',4,1,'Quiz#7'),
 ('D05/automacao',1,1,'Automação Instagram#1'),
 ('D05/automacao',1,1,'Automação Instagram#2'),
 ('D05/automacao',2,1,'Automação Instagram#3'),
 ('D05/automacao',2,1,'Automação Instagram#6'),
 ('D05/automacao',3,1,'Automação Instagram#7'),
 ('D05/automacao',4,1,'Automação Instagram#7'),
 ('MODULOS/fabrica',1,1,'Fábrica de Conteúdo#3'),
 ('MODULOS/fabrica',1,1,'Fábrica de Conteúdo#5'),
 ('MODULOS/fabrica',2,1,'Fábrica de Conteúdo#6'),
 ('MODULOS/fabrica',2,1,'Fábrica de Conteúdo#7'),
 ('MODULOS/fabrica',3,1,'Fábrica de Conteúdo#8'),
 ('MODULOS/fabrica',4,1,'Fábrica de Conteúdo#9'),
 ('MODULOS/iris',1,1,'Íris Black#1'),
 ('MODULOS/iris',1,1,'Íris Black#2'),
 ('MODULOS/iris',1,1,'Íris Black#3'),
 ('MODULOS/iris',2,1,'Íris Black#5'),
 ('MODULOS/iris',2,1,'Íris Black#6'),
 ('MODULOS/iris',3,1,'Íris Black#8'),
 ('MODULOS/iris',4,1,'Íris Black#11'),
 ('MODULOS/comentarios',1,1,'Agente de comentários#0'),
 ('MODULOS/comentarios',1,2,'Agente de comentários#1'),
 ('MODULOS/comentarios',2,1,'Agente de comentários#3'),
 ('MODULOS/comentarios',2,1,'Agente de comentários#4'),
 ('MODULOS/comentarios',2,1,'Agente de comentários#5'),
 ('MODULOS/comentarios',3,1,'Agente de comentários#6'),
 ('MODULOS/comentarios',4,1,'Agente de comentários#7'),
 ('MODULOS/comentarios',4,2,'D05-09');
-- Uma alternativa conta quando todas as suas referências estão feitas; vale a primeira data em que isso ocorreu.
with feitos as (
  select member_id, item_id as ref, edition, updated_at as at from public.cb_checklist_progress where done
  union all
  select sp.member_id, a.nome||'#'||s.ordem, '', coalesce(sp.feito_em, sp.atualizado_em)
    from public.step_progress sp join public.artifact_steps s on s.id = sp.step_id
    join public.artifacts a on a.id = s.artifact_id and a.archived_at is null
   where sp.feito
  union all
  select e.member_id, 'enc:'||f.campo, e.edition::text, e.updated_at
    from public.cb_encontros e cross join lateral (values
      ('publicized', e.publicized), ('video_group', e.video_group), ('video_ads', e.video_ads), ('attended', e.attended)) f(campo, ok)
   where f.ok
), tamanho as (
  select delivery_id, position, alt, count(*) n from _depara group by 1,2,3
), acertos as (
  select m.delivery_id, m.position, m.alt, f.member_id, f.edition, count(distinct m.ref) n, max(f.at) at
    from _depara m join feitos f on f.ref = m.ref group by 1,2,3,4,5
), concluidos as (
  select distinct on (a.member_id, st.id, ed) a.member_id, st.id step_id, ed, a.at
    from acertos a join tamanho t using (delivery_id, position, alt)
    join public.cb_deliveries d on d.id = a.delivery_id
    join public.cb_delivery_steps st on st.delivery_id = a.delivery_id and st.position = a.position
    cross join lateral (select case d.cycle when 'mensal' then '2026-10' else a.edition end ed) e
   where a.n = t.n and (d.cycle = 'edicao') = (a.edition <> '')
   order by a.member_id, st.id, ed, a.at
)
insert into public.cb_delivery_progress(member_id,step_id,edition,status,note,done_at,updated_at,actor_name)
select member_id, step_id, ed, 'concluida', 'Convertido das listas antigas em 29/10/2026.', at, now(), 'Conversão das listas antigas'
  from concluidos where exists(select 1 from public.members m where m.id = concluidos.member_id);

-- Pedidos de conferência ainda abertos viram marcos em validação.
insert into public.cb_delivery_progress(member_id,step_id,edition,status,note,responded_at,updated_at,actor_name)
select distinct on (r.member_id, st.id) r.member_id, st.id, case d.cycle when 'mensal' then '2026-10' else r.edition end,
       'em_validacao', coalesce(r.note,'Pedido de conferência aberto antes da mudança.'), r.requested_at, now(), 'Conversão das listas antigas'
  from public.cb_checklist_requests r
  join _depara m on m.ref = r.item_id
  join public.cb_deliveries d on d.id = m.delivery_id
  join public.cb_delivery_steps st on st.delivery_id = m.delivery_id and st.position = m.position
 where r.resolved_at is null
on conflict do nothing;

insert into public.cb_delivery_events(member_id,step_id,edition,status,note,actor_name,at)
select member_id, step_id, edition, status, note, actor_name, coalesce(done_at, responded_at, updated_at) from public.cb_delivery_progress;

commit;
