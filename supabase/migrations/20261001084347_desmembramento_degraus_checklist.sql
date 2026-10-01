-- Checklist canônico aditivo. Não renomeia nem remove etapas/progressos existentes.
begin;
create table public.cb_checklist_catalog (
 id text primary key, method_step text not null, title text not null,
 source text not null check(source in ('AUTO','MANUAL')), owner text not null,
 monthly boolean not null default false, optional boolean not null default false,
 mission_weight numeric check(mission_weight in (0.5,1))
);
insert into public.cb_checklist_catalog select * from jsonb_to_recordset('[{"id":"D01-01","method_step":"D01","title":"Foto do Dia Zero — frente Funil (leads/mês, taxas)","source":"MANUAL","owner":"CLUB + MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D01-02","method_step":"D01","title":"Foto do Dia Zero — frente Atração","source":"MANUAL","owner":"CLUB + MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D01-03","method_step":"D01","title":"Foto do Dia Zero — frente Entrega","source":"MANUAL","owner":"CLUB + MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D01-04","method_step":"D01","title":"Presbiopia Mental: 3 lentes prioritárias identificadas","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D01-05","method_step":"D01","title":"Data do Dia Zero registrada","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D02-01","method_step":"D02","title":"Mecanismo Grau Zero nomeado","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D02-02","method_step":"D02","title":"Black Branding aplicado","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D02-03","method_step":"D02","title":"Arquétipo definido","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D02-04","method_step":"D02","title":"Linha editorial entregue","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D02-05","method_step":"D02","title":"Scripts de conteúdo + roteiro de VSL entregues","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D02-06","method_step":"D02","title":"Linha editorial e scripts APROVADOS no prazo","source":"MANUAL","owner":"MEMBRO (colaboração ½)","monthly":false,"optional":false,"mission_weight":0.5},{"id":"D03-01","method_step":"D03","title":"CRM Black implantado (funil 8 etapas)","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D03-02","method_step":"D03","title":"Prontuário Black implantado","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D03-03","method_step":"D03","title":"Agenda integrada","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D03-04","method_step":"D03","title":"Conexão com trackeamento (CAPI ligado)","source":"AUTO","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D03-05","method_step":"D03","title":"Equipe registrando 100% (sem lead órfão)","source":"AUTO","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D03-06","method_step":"D03","title":"SLA de 1º contato dentro da meta","source":"AUTO","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D03-07","method_step":"D03","title":"Desfechos registrados ≥ 95%","source":"AUTO","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D04-01","method_step":"D04","title":"Social Seller com dono definido","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D04-02","method_step":"D04","title":"SDR com dono definido (Íris Black ou humana)","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D04-03","method_step":"D04","title":"Closer (Orientadora Cirúrgica) com dono definido","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D04-04","method_step":"D04","title":"Equipe clínica com dono definido","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D04-05","method_step":"D04","title":"Trilha Cultura Premium concluída pela equipe","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D04-06","method_step":"D04","title":"Trilha Atendimento Premium concluída pela equipe","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D04-07","method_step":"D04","title":"Padrões de atendimento implantados no balcão","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D05-01","method_step":"D05","title":"Instagram ativo com constância (3+ vídeos/sem)","source":"AUTO","owner":"MEMBRO (Rotina 10)","monthly":false,"optional":false,"mission_weight":null},{"id":"D05-02","method_step":"D05","title":"Crescimento de seguidores no trimestre","source":"AUTO","owner":"MEMBRO (Rotina 5)","monthly":false,"optional":false,"mission_weight":null},{"id":"D05-03","method_step":"D05","title":"YouTube ativo","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D05-04","method_step":"D05","title":"TikTok ativo","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D05-05","method_step":"D05","title":"Site institucional no ar","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D05-06","method_step":"D05","title":"Site preparado para IAs de busca (AEO)","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D05-07","method_step":"D05","title":"GBP (Google Meu Negócio) gerido com artigo semanal","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D05-08","method_step":"D05","title":"Rotina de artigos em blog rodando","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D05-09","method_step":"D05","title":"Agente de comentários humanizados ativo (SLA)","source":"AUTO","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D06-01","method_step":"D06","title":"Funil de VSL (Funil Expresso): página qualificadora no ar","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D06-02","method_step":"D06","title":"Funil de VSL: VSL gravada pelo médico","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D06-03","method_step":"D06","title":"Funil de VSL: VSL hospedada + % de vídeo assistido medido","source":"AUTO","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D06-04","method_step":"D06","title":"Funil de VSL: pedágios configurados (0–5)","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D06-05","method_step":"D06","title":"Funil Olympus implantado (como consta hoje no sistema; conecta no D09)","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D06-06","method_step":"D06","title":"Link da bio trocado para a página qualificadora","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D06-07","method_step":"D06","title":"Meta Ads no ar — estrutura 2×4 (Andrômeda)","source":"AUTO","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D06-08","method_step":"D06","title":"Google Ads ativo","source":"AUTO","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D06-09","method_step":"D06","title":"Trackeamento anúncio→cirurgia (CAPI) validado","source":"AUTO","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D06-10","method_step":"D06","title":"Verba acordada mantida no mês","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D06-11","method_step":"D06","title":"Leitura mensal do funil pilotada com o Club","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D06-12","method_step":"D06","title":"CPV-Cirurgia medido (juiz: < 15% do ticket)","source":"AUTO","owner":"— (Resultado)","monthly":false,"optional":false,"mission_weight":null},{"id":"D07-01","method_step":"D07","title":"Rotina do Social Seller implantada (~30 DMs/dia)","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D07-02","method_step":"D07","title":"5+ agendamentos/semana do Social Seller","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D07-03","method_step":"D07","title":"Indicação pedida em 100% das altas","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D07-04","method_step":"D07","title":"Leads Bônus: desbloqueio (D03+D05+D06 auditados)","source":"AUTO","owner":"—","monthly":false,"optional":false,"mission_weight":null},{"id":"D07-05","method_step":"D07","title":"Leads Bônus: 100% com desfecho registrado","source":"AUTO","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D08-01","method_step":"D08","title":"Divulgou no perfil marcando @dralexsa","source":"MANUAL","owner":"MEMBRO","monthly":true,"optional":false,"mission_weight":null},{"id":"D08-02","method_step":"D08","title":"Vídeo enviado para o grupo de aquecimento","source":"MANUAL","owner":"MEMBRO","monthly":true,"optional":false,"mission_weight":null},{"id":"D08-03","method_step":"D08","title":"Vídeo enviado para o tráfego da edição","source":"MANUAL","owner":"MEMBRO","monthly":true,"optional":false,"mission_weight":null},{"id":"D08-04","method_step":"D08","title":"Presença ao vivo no pitch","source":"MANUAL","owner":"MEMBRO","monthly":true,"optional":false,"mission_weight":null},{"id":"D08-05","method_step":"D08","title":"Leads da edição recebidos por região","source":"AUTO","owner":"CLUB","monthly":true,"optional":false,"mission_weight":null},{"id":"D08-06","method_step":"D08","title":"Desfecho dos leads da edição registrado","source":"AUTO","owner":"MEMBRO","monthly":true,"optional":false,"mission_weight":null},{"id":"D09-01","method_step":"D09","title":"Closer treinada na chamada (leitura: Apostila In The Bag)","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D09-02","method_step":"D09","title":"Agenda com dupla de horários ativa","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D09-03","method_step":"D09","title":"Funil B configurado (qualificado travado → oferta de chamada)","source":"MANUAL","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"D09-04","method_step":"D09","title":"Ciclo mensal de resgate dos leads parados rodando","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D09-05","method_step":"D09","title":"Chamadas realizadas/semana medidas","source":"AUTO","owner":"—","monthly":false,"optional":false,"mission_weight":null},{"id":"D09-06","method_step":"D09","title":"Chamada→consulta ≥ 60% (juiz do Resultado)","source":"AUTO","owner":"—","monthly":false,"optional":false,"mission_weight":null},{"id":"D10-01","method_step":"D10","title":"Função SDR estruturada (Íris Black contratada OU SDR humana treinada)","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D10-02","method_step":"D10","title":"SLA do SDR em minutos, medido","source":"AUTO","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D10-03","method_step":"D10","title":"Closer treinada no Método In The Bag (8 passos + temperamentos)","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D10-04","method_step":"D10","title":"Agenda do médico protegida (só recebe quem está pronto)","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D10-05","method_step":"D10","title":"Cadência de fechamento pós-consulta ativa (D+1·D+5·D+9·D+16·D+21)","source":"AUTO","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D10-06","method_step":"D10","title":"Objeções registradas por raiz","source":"AUTO","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D11-01","method_step":"D11","title":"Ritual 1 padronizado","source":"MANUAL","owner":"MEMBRO (missão peso 1 p/ 3 rituais)","monthly":false,"optional":false,"mission_weight":1},{"id":"D11-02","method_step":"D11","title":"Ritual 2 padronizado","source":"MANUAL","owner":"MEMBRO (missão peso 1 p/ 3 rituais)","monthly":false,"optional":false,"mission_weight":1},{"id":"D11-03","method_step":"D11","title":"Ritual 3 padronizado","source":"MANUAL","owner":"MEMBRO (missão peso 1 p/ 3 rituais)","monthly":false,"optional":false,"mission_weight":1},{"id":"D11-04","method_step":"D11","title":"Ritual 4 padronizado","source":"MANUAL","owner":"MEMBRO (missão peso 1 p/ 3 rituais)","monthly":false,"optional":true,"mission_weight":1},{"id":"D11-05","method_step":"D11","title":"Ritual 5 padronizado","source":"MANUAL","owner":"MEMBRO (missão peso 1 p/ 3 rituais)","monthly":false,"optional":true,"mission_weight":1},{"id":"D11-06","method_step":"D11","title":"Ritual 6 padronizado","source":"MANUAL","owner":"MEMBRO (missão peso 1 p/ 3 rituais)","monthly":false,"optional":true,"mission_weight":1},{"id":"D11-07","method_step":"D11","title":"Ritual 7 padronizado","source":"MANUAL","owner":"MEMBRO (missão peso 1 p/ 3 rituais)","monthly":false,"optional":true,"mission_weight":1},{"id":"D11-08","method_step":"D11","title":"NPS implantado","source":"AUTO","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D11-09","method_step":"D11","title":"Provas registradas/mês (depoimentos)","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D11-10","method_step":"D11","title":"Indicações espontâneas medidas","source":"AUTO","owner":"—","monthly":false,"optional":false,"mission_weight":null},{"id":"D12-01","method_step":"D12","title":"Seguro Premium estruturado e lançado","source":"MANUAL","owner":"MEMBRO (missão peso 1)","monthly":false,"optional":false,"mission_weight":1},{"id":"D12-02","method_step":"D12","title":"% das altas com oferta feita","source":"AUTO","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D12-03","method_step":"D12","title":"Pacotes Cuidado Premium ativos","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"D12-04","method_step":"D12","title":"Régua de retorno 6 meses rodando no Sistema","source":"AUTO","owner":"CLUB","monthly":false,"optional":false,"mission_weight":null},{"id":"TREINO-01","method_step":"TREINO","title":"Treinamento de Vendas — participação do time","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"TREINO-02","method_step":"TREINO","title":"Treinamento de Sistema Black (com suporte)","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"TREINO-03","method_step":"TREINO","title":"Treinamento de Growth (alinhamento de tráfego)","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"TREINO-04","method_step":"TREINO","title":"Treinamento de Conteúdo","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"TREINO-05","method_step":"TREINO","title":"Presença nos encontros (Rotina, até 10)","source":"AUTO","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"TREINO-06","method_step":"TREINO","title":"Roleplay mensal feito","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null},{"id":"TREINO-07","method_step":"TREINO","title":"Aulão da equipe do mês (presença)","source":"MANUAL","owner":"MEMBRO","monthly":false,"optional":false,"mission_weight":null}]'::jsonb)
 as c(id text,method_step text,title text,source text,owner text,monthly boolean,optional boolean,mission_weight numeric);
alter table public.cb_checklist_catalog enable row level security;
-- Os três rituais compõem uma única missão de peso 1, não sete missões.
update public.cb_checklist_catalog set mission_weight=null where id in ('D11-02','D11-03','D11-04','D11-05','D11-06','D11-07');
revoke all on public.cb_checklist_catalog from public,anon,authenticated;
grant select on public.cb_checklist_catalog to authenticated;
create policy catalog_read on public.cb_checklist_catalog for select to authenticated using (
 (select public.is_admin()) or exists(select 1 from public.members where user_id=(select auth.uid()) and ativo)
);
create table public.cb_checklist_progress (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.members(id),
 item_id text not null references public.cb_checklist_catalog(id),
 edition text not null default '',
 done boolean not null default false,
 evidence text check(length(evidence)<=4000),
 updated_at timestamptz not null default now(), updated_by uuid not null default auth.uid(),
 actor_name text not null default '',
 unique(member_id,item_id,edition)
);
create index cb_checklist_item_idx on public.cb_checklist_progress(item_id);
alter table public.cb_checklist_progress enable row level security;
revoke all on public.cb_checklist_progress from public,anon,authenticated;
grant select,insert,update on public.cb_checklist_progress to authenticated;
create policy own_read on public.cb_checklist_progress for select to authenticated using (
 (select public.is_admin()) or member_id in(select id from public.members where user_id=(select auth.uid()) and ativo)
);
create policy admin_insert on public.cb_checklist_progress for insert to authenticated with check((select public.is_admin()));
create policy admin_update on public.cb_checklist_progress for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));

create function cerebro_private.checklist_stamp() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.cb_checklist_catalog;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Somente a equipe pode conferir itens'; end if;
 select * into strict c from public.cb_checklist_catalog where id=new.item_id;
 if c.source<>'MANUAL' then raise exception 'Item AUTO depende da integração; não pode ser marcado manualmente'; end if;
 if tg_op='UPDATE' and (new.member_id<>old.member_id or new.item_id<>old.item_id or new.edition<>old.edition) then
  raise exception 'Não é permitido transferir o registro';
 end if;
 if not exists(select 1 from public.members where id=new.member_id and ativo) then raise exception 'Membro inativo ou inexistente'; end if;
 if c.monthly then
  if new.edition !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then raise exception 'Selecione a edição'; end if;
  if not exists(select 1 from public.cb_encontros where member_id=new.member_id and edition=new.edition::date) then raise exception 'Edição não cadastrada para este membro'; end if;
 elsif new.edition<>'' then raise exception 'Este item não usa edição mensal';
 end if;
 new.updated_by=auth.uid();new.updated_at=now();
 select s.nome into new.actor_name from public.staff s where s.user_id=auth.uid() and s.ativo order by s.id limit 1;
 new.actor_name=coalesce(new.actor_name,'Equipe Black');
 return new;
end$$;
revoke all on function cerebro_private.checklist_stamp() from public,anon,authenticated;
create trigger checklist_stamp before insert or update on public.cb_checklist_progress for each row execute function cerebro_private.checklist_stamp();
create trigger audit after insert or update on public.cb_checklist_progress for each row execute function cerebro_private.audit();

-- D08 mantém a mesma fonte de rotina, nos dois sentidos, sem perder o carimbo por item.
create function cerebro_private.checklist_edition_sync() returns trigger
language plpgsql security definer set search_path='' as $$
declare field_name text;
begin
 field_name=case new.item_id when 'D08-01' then 'publicized' when 'D08-02' then 'video_group' when 'D08-03' then 'video_ads' when 'D08-04' then 'attended' end;
 if field_name is not null then
  execute format('update public.cb_encontros set %I=$1 where member_id=$2 and edition=$3::date and %I is distinct from $1',field_name,field_name)
   using new.done,new.member_id,new.edition;
 end if;
 return new;
end$$;
revoke all on function cerebro_private.checklist_edition_sync() from public,anon,authenticated;
create trigger edition_sync after insert or update on public.cb_checklist_progress for each row execute function cerebro_private.checklist_edition_sync();
create function cerebro_private.edition_checklist_sync() returns trigger
language plpgsql security definer set search_path='' as $$
declare v record;
begin
 for v in select * from (values ('D08-01',new.publicized),('D08-02',new.video_group),('D08-03',new.video_ads),('D08-04',new.attended)) as x(item_id,done) loop
  insert into public.cb_checklist_progress(member_id,item_id,edition,done,evidence)
   values(new.member_id,v.item_id,new.edition::text,v.done,new.evidence)
   on conflict(member_id,item_id,edition) do update set done=excluded.done,evidence=excluded.evidence
   where cb_checklist_progress.done is distinct from excluded.done;
 end loop;
 return new;
end$$;
revoke all on function cerebro_private.edition_checklist_sync() from public,anon,authenticated;
create trigger checklist_sync after insert or update on public.cb_encontros for each row execute function cerebro_private.edition_checklist_sync();

alter table public.cb_missions add column checklist_item_id text references public.cb_checklist_catalog(id);
create index cb_missions_checklist_idx on public.cb_missions(checklist_item_id) where checklist_item_id is not null;
create unique index cb_missions_checklist_member_period on public.cb_missions(member_id,period,checklist_item_id) where checklist_item_id is not null;
create function cerebro_private.checklist_mission_guard() returns trigger
language plpgsql set search_path='' as $$
declare c public.cb_checklist_catalog;
begin
 if new.checklist_item_id is not null then
  select * into strict c from public.cb_checklist_catalog where id=new.checklist_item_id;
  if c.method_step<>new.method_step or c.mission_weight is null or c.mission_weight<>new.weight then
   raise exception 'Degrau e peso devem seguir o item solicitado';
  end if;
 end if;
 return new;
end$$;
revoke all on function cerebro_private.checklist_mission_guard() from public,anon,authenticated;
create trigger checklist_mission_guard before insert or update on public.cb_missions for each row execute function cerebro_private.checklist_mission_guard();

-- Corrige vínculos ausentes, sem mudar IDs, nomes, etapas, URLs ou progresso.
update public.artifacts a set method_steps=array(select distinct x from unnest(a.method_steps || v.steps) x order by x)
from (values
 ('Funil VSL',array['D06']),('Funil Expresso',array['D06']),
 ('Funil Olympus',array['D06','D09']),
 ('Agente de comentários',array['D05']),
 ('Treinamento comercial',array['D04','D09','D10'])
) v(nome,steps)
where a.nome=v.nome and coalesce(to_jsonb(a)->>'tipo','artefato')='artefato';
commit;
