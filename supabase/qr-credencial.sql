-- ============================================================================
-- Club OftalmoBlack — QR da credencial da Imersão Grau Zero
--
-- Rode no SQL Editor depois do schema.sql. Idempotente: rodar de novo não
-- apaga nada.
--
-- O QR impresso no verso da credencial aponta para um endereço fixo,
-- oftalmoblack.com.br/imersaograuzero/credencial. O que esse endereço abre é
-- decidido aqui, e não no HTML — assim a equipe troca o destino pelo painel
-- (/admin/ → QR da credencial) sem mexer no site e sem deploy.
--
-- Duas leituras da mesma tabela:
--   • se alguma linha ativa e dentro da janela tiver `redirecionar`, a página
--     manda o visitante direto para a URL dela (o pitch de um produto, por
--     exemplo);
--   • senão, a página vira um menu com as linhas ativas e vigentes (mapa do
--     almoço, fotos, WhatsApp da equipe…).
--
-- A janela (`inicio`/`fim`) deixa programar a virada com antecedência: o
-- Maps do almoço só aparece na hora do almoço, o redirect pro pitch só vale
-- enquanto o pitch está no palco. Nulo = sem limite.
-- ============================================================================

-- ── destinos ───────────────────────────────────────────────────────────────

create table if not exists public.qr_links (
  id           uuid primary key default gen_random_uuid(),
  -- Um QR por slug. Hoje só existe 'credencial'; a coluna está aqui para o
  -- próximo QR (um banner, um brinde) reaproveitar a página e o painel.
  slug         text not null default 'credencial',
  titulo       text not null,
  descricao    text,
  url          text not null check (url ~* '^https?://'),
  -- Chave do ícone desenhado no botão do menu. A lista fica na página.
  icone        text not null default 'link',
  ordem        integer not null default 100,
  ativo        boolean not null default true,
  -- true = a página redireciona direto para esta URL em vez de mostrar o menu.
  -- Havendo mais de uma vigente, vale a de menor `ordem`.
  redirecionar boolean not null default false,
  inicio       timestamptz,
  fim          timestamptz,
  criado_em    timestamptz not null default now(),
  check (fim is null or inicio is null or fim > inicio)
);

create index if not exists qr_links_slug_idx on public.qr_links (slug, ordem);

alter table public.qr_links enable row level security;

-- Quem escaneia não tem login: precisa ler as linhas ativas sem sessão. As
-- inativas só o admin enxerga (para editar). is_admin() não é executável por
-- anon, então a regra do visitante fica numa política própria, sem chamá-la.
drop policy if exists "visitante le os destinos ativos" on public.qr_links;
drop policy if exists "logado le os destinos"           on public.qr_links;
drop policy if exists "admin manda nos destinos"        on public.qr_links;

create policy "visitante le os destinos ativos" on public.qr_links
  for select to anon
  using (ativo);

create policy "logado le os destinos" on public.qr_links
  for select to authenticated
  using (ativo or public.is_admin());

create policy "admin manda nos destinos" on public.qr_links
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── scans ──────────────────────────────────────────────────────────────────
-- Cada leitura do QR vira uma linha: quantos escanearam, quando, e para onde
-- foram. É o que diz se o pitch converteu em cliques. O visitante só insere;
-- ler é coisa de admin. A chave é uuid, e não identity, porque anon não teria
-- USAGE na sequência e o insert falharia.

create table if not exists public.qr_scans (
  id       uuid primary key default gen_random_uuid(),
  slug     text not null,
  link_id  uuid references public.qr_links (id) on delete set null,
  -- 'redirect' (mandou direto), 'menu' (mostrou a lista) ou 'clique' (botão).
  modo     text not null check (modo in ('redirect', 'menu', 'clique')),
  destino  text check (destino is null or length(destino) <= 2000),
  ua       text check (ua is null or length(ua) <= 400),
  lido_em  timestamptz not null default now()
);

create index if not exists qr_scans_slug_idx on public.qr_scans (slug, lido_em desc);

alter table public.qr_scans enable row level security;

drop policy if exists "qualquer um registra um scan" on public.qr_scans;
drop policy if exists "admin le os scans"            on public.qr_scans;

create policy "qualquer um registra um scan" on public.qr_scans
  for insert to anon, authenticated
  with check (true);

create policy "admin le os scans" on public.qr_scans
  for select to authenticated
  using (public.is_admin());

-- ── permissões ─────────────────────────────────────────────────────────────
-- O schema.sql revogou tudo de anon em bloco; aqui é a exceção deliberada,
-- coluna a coluna do que a página pública precisa.

grant select on public.qr_links to anon;
grant select, insert, update, delete on public.qr_links to authenticated;

grant insert on public.qr_scans to anon, authenticated;
grant select on public.qr_scans to authenticated;
revoke update, delete on public.qr_scans from anon, authenticated;

-- ── primeiros destinos ─────────────────────────────────────────────────────
-- Só entram se o slug ainda não tem linha nenhuma: rodar o arquivo de novo
-- depois que a equipe editou a lista não recria o que foi apagado.
-- O WhatsApp é o mesmo número que a página da Imersão usa no ar.

insert into public.qr_links (slug, titulo, descricao, url, icone, ordem, ativo, redirecionar)
select v.*
  from (values
    ('credencial', 'Falar com a equipe',
     'Dúvida, programação ou qualquer coisa durante o evento.',
     'https://wa.me/5592914418889', 'whatsapp', 10, true, false),
    ('credencial', 'Imersão Grau Zero',
     'A página oficial do evento.',
     'https://oftalmoblack.com.br/imersaograuzero/', 'link', 20, true, false),
    ('credencial', 'Fotos do evento',
     'Ative quando o álbum estiver pronto e troque a URL pelo link dele.',
     'https://www.instagram.com/oftalmoblack/', 'image', 30, false, false),
    ('credencial', 'Mentoria Grau Zero',
     'Ligue "redirecionar" na hora do pitch e o QR passa a abrir direto aqui.',
     'https://oftalmoblack.com.br/mentoria-grau-zero/', 'award', 40, false, false),
    ('credencial', 'Mentoria Olympus em Cirurgia de Catarata',
     'Mesma ideia: ative e marque "redirecionar" durante o pitch.',
     'https://oftalmoblack.com.br/mentoria-olympus-catarata/', 'star', 50, false, false)
  ) as v (slug, titulo, descricao, url, icone, ordem, ativo, redirecionar)
 where not exists (select 1 from public.qr_links where slug = 'credencial');
