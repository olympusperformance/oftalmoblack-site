-- Degraus são agrupadores; artefatos são entregas. Migração reversível, sem DELETE.
begin;
create table public.cb_method_stages (
 id text primary key,
 name text not null,
 movement text,
 position integer not null unique,
 kind text not null check(kind in ('step','transversal'))
);
insert into public.cb_method_stages(id,name,movement,position,kind) values
 ('D01','Diagnóstico Black','Preparar',1,'step'),
 ('D02','Posicionamento Black','Preparar',2,'step'),
 ('D03','Sistema Black','Preparar',3,'step'),
 ('D04','Time Premium','Preparar',4,'step'),
 ('D05','Referência Black','Criar',5,'step'),
 ('D06','Máquina de Tráfego','Criar',6,'step'),
 ('D07','Captação Ativa','Capturar',7,'step'),
 ('D08','Encontro Grau Zero','Capturar',8,'step'),
 ('D09','Chamada Consultiva','Converter',9,'step'),
 ('D10','Método In The Bag','Converter',10,'step'),
 ('D11','Protocolo de Encantamento','Perpetuar',11,'step'),
 ('D12','Recorrência Black','Perpetuar',12,'step'),
 ('TREINO','Treino de Competição',null,13,'transversal');
alter table public.cb_method_stages enable row level security;
revoke all on public.cb_method_stages from public,anon,authenticated;
grant select on public.cb_method_stages to authenticated;
create policy stage_read on public.cb_method_stages for select to authenticated using (
 (select public.is_admin()) or exists(select 1 from public.members where user_id=(select auth.uid()) and ativo)
);
alter table public.cb_checklist_catalog add constraint cb_checklist_stage_fk foreign key(method_step) references public.cb_method_stages(id);
create index cb_checklist_stage_idx on public.cb_checklist_catalog(method_step);

alter table public.artifacts add column archived_at timestamptz;
alter table public.artifacts add column archive_reason text;
alter table public.artifacts drop constraint artifacts_method_steps_valid;
alter table public.artifacts add constraint artifacts_method_steps_valid check (
 method_steps <@ array['D01','D02','D03','D04','D05','D06','D07','D08','D09','D10','D11','D12','TREINO']
);

-- Somente os oito cadastros extras gerados pela migração de 30/09.
-- A impressão digital evita arquivar a entrega individual Encontro Grau Zero
-- ou qualquer processo antigo homônimo. Registros continuam íntegros no banco.
with extras(name,description) as (values
 ('Time Premium','Quatro funções com dono e trilha Cultura Premium & Atendimento Premium.'),
 ('Captação Ativa','Rotina do Social Seller e indicação ativa.'),
 ('Encontro Grau Zero','Divulgação, vídeos para grupo e tráfego, presença no pitch.'),
 ('Chamada Consultiva','Funil de High Ticket e resgate de leads parados.'),
 ('Método In The Bag','SDR, sequência consultiva e cadência D+1 · D+5 · D+9 · D+16 · D+21.'),
 ('Protocolo de Encantamento','Rituais, provas consentidas e NPS.'),
 ('Recorrência Black','Seguro Premium e Cuidado Premium.'),
 ('Treino de Competição','Cultura Premium & Atendimento Premium e técnica das quatro funções.')
)
update public.artifacts a set archived_at=now(),archive_reason='Cadastro de agrupador criado como entrega em 30/09. Substituído pelo degrau e seu checklist; nenhum histórico removido.'
from extras x where a.nome=x.name and a.subtitulo=x.description and a.member_id is null and a.group_id is null
 and a.criado_em>='2026-09-30 19:50:28+00' and a.criado_em<'2026-09-30 19:50:29+00'
 and not exists(select 1 from public.step_progress p join public.artifact_steps s on s.id=p.step_id where s.artifact_id=a.id)
 and not exists(select 1 from public.demands d where d.artifact_id=a.id or d.step_id in(select id from public.artifact_steps where artifact_id=a.id))
 and not exists(select 1 from public.progress_notes n where n.artifact_id=a.id or n.step_id in(select id from public.artifact_steps where artifact_id=a.id))
 and not exists(select 1 from public.cb_missions m where m.artifact_step_id in(select id from public.artifact_steps where artifact_id=a.id));

-- Reutiliza o treinamento existente, sem copiar etapas nem progresso.
update public.artifacts set method_steps=array(select distinct x from unnest(method_steps||array['TREINO']) x order by x)
 where nome='Treinamento comercial' and archived_at is null and coalesce(to_jsonb(artifacts)->>'tipo','artefato')='artefato';

-- Relação de leitura entre agrupador e entrega; a mesma entrega pode atender
-- mais de um degrau. security_invoker conserva todas as políticas das fontes.
create view public.cb_stage_deliveries with(security_invoker=true) as
 select s.id as stage_id,a.id as artifact_id
 from public.cb_method_stages s join public.artifacts a on s.id=any(a.method_steps)
 where a.archived_at is null and coalesce(to_jsonb(a)->>'tipo','artefato')='artefato'
 and (not coalesce((to_jsonb(a)->>'somente_equipe')::boolean,false) or (select public.is_admin()));
revoke all on public.cb_stage_deliveries from public,anon,authenticated;
grant select on public.cb_stage_deliveries to authenticated;
comment on table public.cb_method_stages is 'Guarda-chuvas do método, separados das entregas em artifacts.';
comment on view public.cb_stage_deliveries is 'Vínculos sem duplicação de entregas: derive de artifacts.method_steps.';
comment on column public.artifacts.group_id is 'Área operacional da equipe. Não é o degrau do método.';
commit;
