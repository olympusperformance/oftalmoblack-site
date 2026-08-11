-- ============================================================================
-- Club OftalmoBlack — acervo de materiais
--
-- Rode este arquivo no SQL Editor depois do schema.sql.
--
-- Materiais são diferentes de artefatos. Artefato é o que o mentorado destrava
-- (o CRM, a landing page, a automação): poucos, estáveis, com status. Material
-- é o acervo que só cresce — análise de tráfego, tutorial, roteiro — e tem
-- arquivo de verdade para baixar.
--
-- O arquivo mora no Storage, num bucket PRIVADO: sem URL pública, sem link
-- adivinhável. O acesso sai por URL assinada de curta duração, e só para quem
-- a linha em materials autoriza.
-- ============================================================================

create table if not exists public.materials (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  descricao     text,
  categoria     text not null default 'Análises',
  -- Nulo = turma inteira. Preenchido = só estes mentorados.
  visivel_para  uuid[],
  arquivo_path  text not null unique,
  arquivo_nome  text not null,
  arquivo_tipo  text,
  arquivo_bytes bigint,
  publicado_em  date not null default current_date,
  criado_em     timestamptz not null default now()
);

create index if not exists materials_categoria_idx on public.materials (categoria);
create index if not exists materials_visivel_idx   on public.materials using gin (visivel_para);

alter table public.materials enable row level security;

drop policy if exists "le os materiais liberados" on public.materials;
drop policy if exists "admin escreve materiais"   on public.materials;

create policy "le os materiais liberados" on public.materials
  for select to authenticated
  using (public.is_admin()
         or visivel_para is null
         or public.current_member_id() = any (visivel_para));

create policy "admin escreve materiais" on public.materials
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.materials to authenticated;
revoke all on public.materials from anon;

-- ── arquivo ────────────────────────────────────────────────────────────────
-- public = false: o bucket não serve nada por URL direta.
-- 50 MB por arquivo — o suficiente para PDF e apresentação sem virar depósito
-- de vídeo, que é o que o YouTube e o Vimeo fazem melhor.

insert into storage.buckets (id, name, public, file_size_limit)
values ('materiais', 'materiais', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "le arquivo de material liberado" on storage.objects;
drop policy if exists "admin sobe material"             on storage.objects;
drop policy if exists "admin apaga material"            on storage.objects;

-- Quem pode ler o arquivo é decidido pela linha em materials que aponta para
-- ele. Não há regra de caminho para adivinhar nem pasta "secreta".
create policy "le arquivo de material liberado" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materiais'
    and exists (
      select 1 from public.materials m
       where m.arquivo_path = storage.objects.name
         and (public.is_admin()
              or m.visivel_para is null
              or public.current_member_id() = any (m.visivel_para))
    )
  );

create policy "admin sobe material" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materiais' and public.is_admin());

create policy "admin apaga material" on storage.objects
  for delete to authenticated
  using (bucket_id = 'materiais' and public.is_admin());
