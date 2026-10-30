-- Desafio Black: meta de Reels combinada num encontro de quinta e o progresso
-- apurado pela equipe (Reels no Instagram pessoal + vídeos enviados no grupo
-- individual). Não é ranking: o membro lê só a própria linha; a equipe grava.
create table public.cb_desafios (
 id text primary key check(id ~ '^[a-z0-9-]+$'),
 titulo text not null check(length(trim(titulo))>0),
 inicio timestamptz not null, fim timestamptz not null,
 regra text not null check(length(trim(regra))>0),
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
 check(fim>inicio)
);
create table public.cb_desafio_metas (
 desafio_id text not null references public.cb_desafios(id),
 member_id uuid not null references public.members(id),
 meta integer not null check(meta between 1 and 60),
 reels_ig integer not null default 0 check(reels_ig>=0),
 videos_grupo integer not null default 0 check(videos_grupo>=0),
 -- O vídeo mandado no grupo costuma virar o Reel depois: vale o maior, nunca a soma.
 feitos integer generated always as (greatest(reels_ig,videos_grupo)) stored,
 reels jsonb not null default '[]' check(jsonb_typeof(reels)='array'),
 conferido_em timestamptz,
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
 primary key(desafio_id,member_id)
);
create index cb_desafio_metas_member on public.cb_desafio_metas(member_id);

alter table public.cb_desafios enable row level security;
alter table public.cb_desafio_metas enable row level security;
revoke all on public.cb_desafios,public.cb_desafio_metas from public,anon,authenticated;
grant select,insert,update on public.cb_desafios,public.cb_desafio_metas to authenticated;
create policy read_all on public.cb_desafios for select to authenticated using (true);
create policy admin_insert on public.cb_desafios for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.cb_desafios for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy own_read on public.cb_desafio_metas for select to authenticated using
 ((select public.is_admin()) or member_id in (select id from public.members where user_id=(select auth.uid()) and ativo));
create policy admin_insert on public.cb_desafio_metas for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.cb_desafio_metas for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger stamp before insert or update on public.cb_desafios for each row execute function cerebro_private.stamp();
create trigger stamp before insert or update on public.cb_desafio_metas for each row execute function cerebro_private.stamp();
create trigger audit after insert or update on public.cb_desafio_metas for each row execute function cerebro_private.audit();
