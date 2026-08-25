-- ============================================================================
-- Bot do Instagram — comentário modelo → resposta
--
-- Rode no SQL Editor depois do schema.sql.
--
-- Cada linha é um par: um comentário que já apareceu (ou poderia aparecer) e a
-- resposta certa para ele. Quando um comentário novo chega, o bot procura aqui
-- os mais parecidos e usa como exemplo para escrever a resposta dele.
--
-- Não é um roteiro de respostas prontas: é o material que ensina a VOZ. Por
-- isso o mesmo comentário pode ter mais de uma resposta boa, e ter várias é
-- melhor que ter uma — evita que o perfil repita a mesma frase o dia inteiro.
--
-- A busca é textual, em português, com o grupo como filtro. Sem embedding por
-- enquanto: 'catarata' encontra 'catarata' sem custar chamada de modelo. A
-- coluna de vetor fica preparada para o dia em que a busca por sentido fizer
-- falta — quando 'não enxergo de longe' precisar achar 'miopia'.
-- ============================================================================

create table if not exists public.bot_exemplos (
  id          uuid primary key default gen_random_uuid(),
  -- relato | duvida | objecao | chave | sonho | preco | local | convenio |
  -- colirio | fe | elogio | emoji | riso | saudacao | outro
  grupo       text not null,
  comentario  text not null,
  -- Nulo = esperando a resposta do Dr. Alex. O comentário entra primeiro, a voz
  -- vem depois — e exemplo sem resposta não ensina nada, então fica de fora da
  -- busca até ser preenchido.
  resposta    text,
  -- Sai do ar sem perder o histórico: resposta ruim vira exemplo do que não fazer.
  ativo       boolean not null default true,
  -- 'italo' | 'dr alex' | 'bot aprovado' — de quem é a voz desta resposta
  origem      text not null default 'italo',
  -- Quantas vezes o bot já usou este par como exemplo. Serve para ver o que
  -- está puxando o trabalho e o que nunca é escolhido.
  usos        integer not null default 0,
  criado_em   timestamptz not null default now(),
  atualizado  timestamptz not null default now()
);

-- Busca em português: 'cirurgias' encontra 'cirurgia', 'óculos' encontra 'oculos'.
create index if not exists bot_exemplos_busca_idx on public.bot_exemplos
  using gin (to_tsvector('portuguese', comentario));
create index if not exists bot_exemplos_grupo_idx on public.bot_exemplos (grupo, ativo);

create or replace function public.bot_exemplos_tocar()
returns trigger language plpgsql as $$
begin
  new.atualizado = now();
  return new;
end $$;

drop trigger if exists bot_exemplos_tocar on public.bot_exemplos;
create trigger bot_exemplos_tocar before update on public.bot_exemplos
  for each row execute function public.bot_exemplos_tocar();

-- ── a busca que o n8n chama ────────────────────────────────────────────────
-- Devolve os exemplos mais parecidos do grupo pedido. Quando nada casa por
-- texto — comentário curto, cheio de emoji, escrito torto — cai para os mais
-- recentes do grupo, porque exemplo genérico ensina mais que exemplo nenhum.
create or replace function public.bot_exemplos_parecidos(
  p_texto text,
  p_grupo text default null,
  p_quantos integer default 4
)
returns table (comentario text, resposta text, forca real)
language sql stable as $$
  with consulta as (
    select plainto_tsquery('portuguese', coalesce(p_texto, '')) as q
  )
  select e.comentario, e.resposta,
         ts_rank(to_tsvector('portuguese', e.comentario), c.q) as forca
    from public.bot_exemplos e, consulta c
   where e.ativo
     and e.resposta is not null and btrim(e.resposta) <> ''
     and (p_grupo is null or e.grupo = p_grupo)
   order by forca desc, e.criado_em desc
   limit greatest(p_quantos, 1);
$$;

alter table public.bot_exemplos enable row level security;

drop policy if exists "admin cuida dos exemplos" on public.bot_exemplos;
drop policy if exists "membro nao ve exemplos"   on public.bot_exemplos;

-- Só admin. Isto não é conteúdo de mentorado: é a voz do perfil do médico.
create policy "admin cuida dos exemplos" on public.bot_exemplos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.bot_exemplos to authenticated;
revoke all on public.bot_exemplos from anon;

-- O n8n entra pelo Postgres com a credencial que já usa no Cérebro, fora do
-- RLS. A função é stable e só lê — não há caminho de escrita por ali.

-- ============================================================================
-- O que o bot respondeu, esperando o seu aval
--
-- Toda resposta que a IA escreve cai aqui. Na tela do painel elas aparecem com
-- dois botões: virar exemplo, ou descartar. O que você aprovar entra em
-- bot_exemplos e passa a ensinar as próximas.
--
-- A base cresce pelo seu gosto, não pelo gosto do modelo. Se as respostas
-- entrassem sozinhas, o modelo passaria a aprender com ele mesmo e o tom
-- derivaria sem ninguém perceber.
-- ============================================================================

create table if not exists public.bot_respostas (
  id          uuid primary key default gen_random_uuid(),
  comentario  text not null,
  usuario     text,
  grupo       text,
  resposta    text not null,
  -- para abrir o comentário no Instagram direto da tela
  comment_id  text,
  permalink   text,
  -- null = esperando você. 'exemplo' = virou exemplo. 'descartada' = não presta.
  decisao     text,
  exemplo_id  uuid references public.bot_exemplos (id) on delete set null,
  respondido  timestamptz not null default now(),
  decidido    timestamptz
);

create index if not exists bot_respostas_fila_idx on public.bot_respostas (decisao, respondido desc);

alter table public.bot_respostas enable row level security;

drop policy if exists "admin cuida das respostas" on public.bot_respostas;
create policy "admin cuida das respostas" on public.bot_respostas
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.bot_respostas to authenticated;
revoke all on public.bot_respostas from anon;

-- Aprovar é um passo só: copia o par para os exemplos e marca a fila.
create or replace function public.bot_virar_exemplo(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r public.bot_respostas%rowtype;
  novo_id uuid;
begin
  if not public.is_admin() then
    raise exception 'só admin';
  end if;
  select * into r from public.bot_respostas where id = p_id;
  if not found then
    raise exception 'resposta não encontrada';
  end if;
  if r.decisao is not null then
    return r.exemplo_id;   -- já decidida, não duplica
  end if;
  insert into public.bot_exemplos (grupo, comentario, resposta, origem)
  values (coalesce(r.grupo, 'outro'), r.comentario, r.resposta, 'bot aprovado')
  returning id into novo_id;
  update public.bot_respostas
     set decisao = 'exemplo', exemplo_id = novo_id, decidido = now()
   where id = p_id;
  return novo_id;
end $$;

grant execute on function public.bot_virar_exemplo(uuid) to authenticated;

-- ── semente ────────────────────────────────────────────────────────────────
-- Trinta comentários REAIS do perfil, exatamente como as pessoas escreveram —
-- com os erros de digitação, os acentos faltando e o texto inteiro. Dez de cada
-- grupo que hoje fica calado.
--
-- Entram SEM RESPOSTA de propósito. A resposta é a voz do Dr. Alex, e voz não
-- se inventa: quem preenche é ele, na tela do painel. Enquanto o campo estiver
-- vazio, o exemplo não é usado pelo bot.
--
-- Só entra se a tabela estiver vazia — rodar o arquivo duas vezes não duplica.
insert into public.bot_exemplos (grupo, comentario)
select * from (values
  ('duvida', 'dói?'),
  ('duvida', 'funciona mesmo?'),
  ('duvida', 'Atendende 11 anos?'),
  ('duvida', 'E glaucoma tem jeito?'),
  ('duvida', 'é definitivo ou volta?'),
  ('duvida', 'posso fazer com 70 anos?'),
  ('duvida', 'e quem já operou catarata pode?'),
  ('duvida', 'Corrige miopia e presbiopia ao mesmo tempo? É possível?'),
  ('duvida', 'Fiz cirurgia de catarata, pelo sus, mas não vejo bem o posso fazer?'),
  ('duvida', 'Porque no SUS eles não operam quando a paciente tem menos que 40 anos ? Fiquei indignada ontem fui uma consulta com a oftalmologista e ela disse que a carne que estava crescendo não era de tal importância para realizar uma cirurgia. Só me passou apenas um colírio para eu não sentir irritação, vermelhidão e ardência no meu olho.. 🥺'),
  ('relato', 'Idade chega'),
  ('relato', 'Eu tem 18 de miopia 27'),
  ('relato', 'Desse vídeo eu só não tenho catarata 😭'),
  ('relato', '48 e enxergo de perto perfeitamente, agora de longe é tudo embaraçado.'),
  ('relato', 'Há mais ou menos um ano não consigo mais ler de perto, como isso é ruim viu.'),
  ('relato', 'Eu vir estava lá, faço aplicação de injeção no olho. Ela entrou primeiro que eu, não estava enchergando nada e saiu lendo tudo'),
  ('relato', 'Eu teu tenho 76 cirurgia do dois mais depois de faser essas cirurgias vou ter que usar óculos pra lê nunca usei mais fazer o que'),
  ('relato', 'Estou com catarata ,assim, diz o médico. Esperando ser chamada pelo SUS a 9 meses e nada. Cada vez sem enxergar. Pra quem pode fazer esse tratamento aconselho fazer .'),
  ('relato', 'Vendo seu vídeo doutor em 2012 eu descobri que eu tinha catarata congênita daí eu fui em hospital das clínicas de santa casa aí os médicos falou que eu poderia ficar bom poderia ficar do jeito que tá que eu tinha nascido com esse problema aí eu fiquei com medo é de mexer no olho e ficar cega aí daí agora eu resolvi fazer exames descobri que eu tava com grau de miopia muito alto e catarata aí resolvi fiz a cirurgia de um olho Graças a Deus muito feliz porque eu nunca enxerguei totalmente nunca caía nas ruas veio sem poder enxergar os degrau agora tô enxergando com o olho de longe de perto eu sei que eu vou usar óculos mas só em poder tá enxergando para mim é tudo vou fazer no próximo mês a cirurgia do outro olho tô muito feliz e realizada'),
  ('relato', 'Quem já fez se manifeste aqui p saber se é verdade'),
  ('objecao', 'só pra rico'),
  ('objecao', 'aí fica caro né'),
  ('objecao', 'pra quem tem dinheiro'),
  ('objecao', 'parece propaganda enganosa'),
  ('objecao', 'Mas não tenho dinheiro 😞😞'),
  ('objecao', 'meu sonho mas não tenho condições'),
  ('objecao', 'Eu bem que quero, porém o valor hein'),
  ('objecao', 'Grande verdade eu queria ter condições pra isso .'),
  ('objecao', 'Um dia vou ter DINHEIRO 💰 para fazer essa CIRURGIA.'),
  ('objecao', 'A se eu tiverce esta oportunidade, pq tenho catarata e preciso operare é muito caro e a condição é pouca')
) as s(grupo, comentario)
where not exists (select 1 from public.bot_exemplos);
