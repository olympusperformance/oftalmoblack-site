-- ============================================================================
-- Corrige a semente da voz do bot
--
-- Rode UMA VEZ, no SQL Editor, se você já rodou o bot-exemplos.sql da versão
-- anterior — aquela em que cada comentário vinha com uma resposta pronta.
--
-- Aquelas 32 respostas eram MINHAS, não do Dr. Alex. Voz não se inventa: o
-- comentário é da pessoa que comentou, e a resposta tem de ser de quem atende.
-- Este arquivo remove só o que eu semeei — casando comentário E resposta,
-- exatamente — e deixa intacto qualquer exemplo que você já tenha escrito.
--
-- No lugar entram 30 comentários reais do perfil, como as pessoas
-- escreveram, SEM resposta, esperando o Dr. preencher na tela.
-- ============================================================================

-- 1. resposta deixa de ser obrigatória (se ainda não for)
alter table public.bot_exemplos alter column resposta drop not null;

-- 2. a busca passa a ignorar quem está sem resposta
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

-- 3. fora as respostas que eram minhas
delete from public.bot_exemplos e
 using (values
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
 ) as meu(grupo, comentario, resposta)
 where e.grupo = meu.grupo
   and e.comentario = meu.comentario
   and e.resposta = meu.resposta;

-- 4. entram os comentários reais, sem resposta, sem duplicar o que já existe
insert into public.bot_exemplos (grupo, comentario)
select v.grupo, v.comentario
  from (values
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
  ) as v(grupo, comentario)
 where not exists (
   select 1 from public.bot_exemplos e
    where e.grupo = v.grupo and e.comentario = v.comentario
 );

-- 5. confira o resultado
select grupo,
       count(*) filter (where resposta is null or btrim(resposta) = '') as esperando_o_dr,
       count(*) filter (where resposta is not null and btrim(resposta) <> '') as ja_respondidos,
       count(*) as total
  from public.bot_exemplos
 group by grupo
 order by grupo;
