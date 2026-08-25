-- ============================================================================
-- Pares tirados do Manual de Oftalmologia da equipe comercial
--
-- Rode depois do bot-exemplos.sql (e do -corrige, se você tiver rodado a
-- semente antiga).
--
-- O manual ensina o vocabulário do PACIENTE, que é o que interessa aqui: ele
-- não escreve "pterígio", escreve "carne no olho"; não escreve "grau alto",
-- escreve "óculos fundo de garrafa"; não escreve "catarata", escreve "enxergo
-- como se tivesse névoa". São 29 comentários com essas palavras.
--
-- As respostas seguem a régua do COMENTÁRIO PÚBLICO, que é mais apertada que a
-- do direct do manual: aqui ninguém agenda, ninguém diz se pode ou não pode,
-- ninguém confirma diagnóstico. Dúvida reconhece e leva ao direct; relato
-- acolhe e para. Todas passaram pelo conferidor do fluxo.
--
-- ATENÇÃO ao grupo 'urgencia': ele NÃO existe no classificador ainda. As quatro
-- linhas entram como material pronto, mas só valem quando alguém ensinar o bot
-- a reconhecer descolamento de retina, trauma e queimadura química. Enquanto
-- isso, esses comentários caem em dúvida ou relato — e hoje ficam calados.
-- Decisão do Ítalo, não minha: calar diante de "acordei vendo cortina escura"
-- é pior que responder, mas mandar ao pronto-socorro é orientação, e orientação
-- em comentário público é escolha de vocês.
insert into public.bot_exemplos (grupo, comentario, resposta, origem)
select v.grupo, v.comentario, v.resposta, 'manual'
  from (values
  ('duvida', 'Faz Lasik ou PRK?', 'Isso se vê caso a caso — te expliquei no direct 👀'),
  ('duvida', 'Uso óculos fundo de garrafa, tem jeito pra mim?', 'Te chamei no direct pra conversar sobre isso'),
  ('duvida', 'Me disseram que não posso fazer laser, e agora?', 'Vale a gente conversar. Te escrevi no direct'),
  ('duvida', 'Comecei a precisar de óculos pra ler, faz cirurgia disso?', 'Te respondi no direct 📩'),
  ('duvida', 'Uso multifocal e odeio, tem solução?', 'Odeio também 😅 te chamei no direct'),
  ('duvida', 'Preciso afastar o celular pra enxergar, é normal?', 'Te mandei mensagem no direct sobre isso'),
  ('duvida', 'Minha visão tá ficando embaçada, como se tivesse névoa', 'Melhor olhar isso com calma — te escrevi no direct'),
  ('duvida', 'Enxergo mal de longe, não vejo a placa do carro', 'Já te chamei no direct 🤍'),
  ('duvida', 'Posso colocar lente boa na cirurgia?', 'Isso se vê na avaliação. Te respondi no direct'),
  ('duvida', 'Tenho uma carne no olho, o doutor tira?', 'Te mandei mensagem no direct pra te orientar'),
  ('duvida', 'Meu filho precisa de óculos, o doutor atende criança?', 'Te escrevi no direct pra te explicar direitinho'),
  ('duvida', 'Tenho olho seco e ardência o dia todo', 'Te chamei no direct pra conversar'),
  ('duvida', 'Faz cirurgia de estrabismo?', 'Te respondi no direct sobre isso 📩'),
  ('duvida', 'Doutor, faz blefaroplastia?', 'Te mandei mensagem no direct pra te orientar'),
  ('duvida', 'Meu olho tá vermelho e lacrimejando faz dias', 'Te chamei no direct 👀'),
  ('relato', 'Uso óculos fundo de garrafa desde criança', 'Uma vida inteira com eles no rosto, né 🤍'),
  ('relato', 'Comecei a afastar o celular pra ler, chegou a hora né', 'Chegou pra todo mundo, uma hora 😅'),
  ('relato', 'Meu marido tem uma carne no olho e sente muito incômodo', 'Deve incomodar mesmo. Um abraço pra ele 💙'),
  ('relato', 'Tenho moscas volantes o dia todo, é chato demais', 'É chato mesmo, conviver com isso cansa'),
  ('relato', 'Sou diabética e minha vista piorou muito nos últimos anos', 'Sinto que você esteja passando por isso 🤍'),
  ('relato', 'Meu filho tem olho preguiçoso desde pequeno', 'Deve ter sido um caminho longo com ele'),
  ('relato', 'Minha mãe tem glaucoma e tem medo de perder a visão', 'Esse medo aperta, imagino. Força pra ela 💙'),
  ('relato', 'Uso colírio de pressão todo dia há 10 anos', 'Dez anos de rotina firme. Isso não é pouco'),
  ('relato', 'Enxergava tão bem e agora não leio mais nada de perto', 'Dói ver a vista mudar assim, é verdade'),
  ('relato', 'Fiz crosslinking há uns anos por causa do ceratocone', 'Quanta coisa você já enfrentou nesses olhos 🤍'),
  ('urgencia', 'Acordei vendo uma cortina escura e flashes de luz', 'Isso merece atendimento hoje. Procure um pronto-socorro oftalmológico 🙏'),
  ('urgencia', 'Levei uma pancada forte no olho ontem e tá doendo muito', 'Não deixe pra depois: procure um pronto-socorro oftalmológico'),
  ('urgencia', 'Caiu produto químico no meu olho, tô com medo', 'Lave com água corrente e vá a um pronto-socorro agora 🙏'),
  ('urgencia', 'Perdi a visão de um olho de repente hoje', 'Procure um pronto-socorro oftalmológico o quanto antes')
  ) as v(grupo, comentario, resposta)
 where not exists (
   select 1 from public.bot_exemplos e
    where e.grupo = v.grupo and e.comentario = v.comentario
 );

select grupo,
       count(*) filter (where resposta is null or btrim(resposta) = '') as esperando_o_dr,
       count(*) filter (where resposta is not null and btrim(resposta) <> '') as com_resposta,
       count(*) as total
  from public.bot_exemplos
 group by grupo
 order by grupo;
