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
  resposta    text not null,
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
-- Os primeiros exemplos, escritos em 25/08 a partir dos comentários reais do
-- perfil. Servem para a tela não nascer vazia e para o bot ter voz desde o
-- primeiro dia. Todos passaram pelo conferidor do fluxo: nenhum promete,
-- precifica ou afirma fato clínico.
--
-- Só entra se a tabela estiver vazia — rodar o arquivo duas vezes não duplica.
insert into public.bot_exemplos (grupo, comentario, resposta)
select * from (values
  ('duvida', 'dói?', 'Te respondi no direct pra falar disso com calma 👀'),
  ('duvida', 'funciona mesmo?', 'Essa merece uma conversa de verdade — te escrevi no direct'),
  ('duvida', 'Atendende 11 anos?', 'Melhor te explicar direitinho no direct, já te chamei por lá'),
  ('duvida', 'E glaucoma tem jeito?', 'Cada história é uma história. Te mandei mensagem no direct 📩'),
  ('duvida', 'é definitivo ou volta?', 'Prefiro te explicar com calma: te escrevi no direct'),
  ('duvida', 'posso fazer com 70 anos?', 'Já te chamei no direct pra conversar 🤍'),
  ('duvida', 'e quem já operou catarata pode?', 'Isso depende de avaliação, e te respondi no direct'),
  ('duvida', 'Corrige miopia e presbiopia ao mesmo tempo? É possível?', 'Pergunta boa demais pra caber aqui — te escrevi no direct 👀'),
  ('duvida', 'Fiz cirurgia de catarata, pelo sus, mas não vejo bem o posso fazer?', 'Vamos conversar no direct? Te mandei mensagem por lá'),
  ('duvida', 'Porque no SUS eles não operam quando a paciente tem menos que 40 anos ? Fiquei indignada', 'Olha o seu direct, te respondi por lá 🤍'),
  ('relato', 'Idade chega', 'Chega mesmo, e vem trazendo história 🤍'),
  ('relato', 'Eu tem 18 de miopia 27', 'Isso é grau que pesa no dia a dia'),
  ('relato', 'Desse vídeo eu só não tenho catarata 😭', 'Rimos pra não chorar, né 😅'),
  ('relato', '48 e enxergo de perto perfeitamente, agora de longe é tudo embaraçado.', 'Muita gente passa por isso nessa fase da vida'),
  ('relato', 'Há mais ou menos um ano não consigo mais ler de perto, como isso é ruim viu.', 'É chato demais mesmo. Que venham dias melhores'),
  ('relato', 'Eu vir estava lá, faço aplicação de injeção no olho.', 'Não é fácil essa rotina. Força aí 💙'),
  ('relato', 'Eu teu tenho 76 cirurgia do dois mais depois de faser essas cirurgias vou ter que usar óculos', 'Bom demais te ler por aqui'),
  ('relato', 'Estou com catarata ,assim, diz o médico. Esperando ser chamada a 9 meses e nada.', 'Nove meses é tempo demais esperando. Torço pra que sua vez chegue'),
  ('relato', 'Vendo seu vídeo doutor em 2012 eu descobri que eu tinha catarata congênita', 'Quanta história, viu. Obrigado por voltar aqui pra contar'),
  ('relato', 'Quem já fez se manifeste aqui p saber se é verdade', 'Bora ver quem aparece 👀'),
  ('objecao', 'só pra rico', 'Entendo o seu ponto'),
  ('objecao', 'aí fica caro né', 'É um investimento alto mesmo, respeito a colocação'),
  ('objecao', 'pra quem tem dinheiro', 'Faz sentido o que você diz'),
  ('objecao', 'parece propaganda enganosa', 'Respeito a sua desconfiança, obrigado por dizer'),
  ('objecao', 'Mas não tenho dinheiro 😞😞', 'Compreendo, viu. Espero que sua hora chegue 🤍'),
  ('objecao', 'meu sonho mas não tenho condições', 'Que ele siga guardado aí, esperando a hora certa'),
  ('objecao', 'Eu bem que quero, porém o valor hein', 'Justo. Obrigado por comentar'),
  ('objecao', 'Grande verdade eu queria ter condições pra isso .', 'Tomara que apareça o caminho 🤍'),
  ('objecao', 'Um dia vou ter DINHEIRO 💰 para fazer essa CIRURGIA.', 'Um dia chega 🤍'),
  ('objecao', 'A se eu tiverce esta oportunidade, pq tenho catarata e preciso operare é muito caro', 'Torço pra que a oportunidade apareça'),
  ('outro', 'São aqui do são Paulo', 'Obrigado por acompanhar de longe 🤍'),
  ('outro', 'primeira vez que vejo isso', 'Que bom te ver por aqui 🤍')
) as s(grupo, comentario, resposta)
where not exists (select 1 from public.bot_exemplos);
