/* Teste DISC · dados.
   Os 24 grupos de palavras e os textos de base de cada fator vêm do teste
   original do Grupo OftalmoPremium (testediscoftalmopremium.netlify.app).
   Temperamento, “como atende” e a conduta com cada tipo de paciente seguem a
   apostila Temperamentos Black (DISC: D = Colérico, I = Sanguíneo,
   S = Fleumático, C = Melancólico). */
(function () {
  'use strict';

  var ORDEM = ['D', 'I', 'S', 'C'];

  /* uma palavra por fator em cada grupo; a ordem na tela é sorteada */
  var GRUPOS = [
    { D: 'Aventureiro', I: 'Animado', S: 'Paciente', C: 'Analítico' },
    { D: 'Determinado', I: 'Otimista', S: 'Calmo', C: 'Cuidadoso' },
    { D: 'Direto', I: 'Sociável', S: 'Estável', C: 'Preciso' },
    { D: 'Competitivo', I: 'Entusiasmado', S: 'Constante', C: 'Detalhista' },
    { D: 'Audacioso', I: 'Persuasivo', S: 'Compreensivo', C: 'Organizado' },
    { D: 'Decidido', I: 'Inspirador', S: 'Cooperativo', C: 'Disciplinado' },
    { D: 'Forte', I: 'Comunicativo', S: 'Leal', C: 'Sistemático' },
    { D: 'Ousado', I: 'Expressivo', S: 'Tolerante', C: 'Cauteloso' },
    { D: 'Pioneiro', I: 'Encantador', S: 'Solícito', C: 'Lógico' },
    { D: 'Persistente', I: 'Caloroso', S: 'Sereno', C: 'Perfeccionista' },
    { D: 'Resoluto', I: 'Convincente', S: 'Diplomático', C: 'Metódico' },
    { D: 'Assertivo', I: 'Brincalhão', S: 'Bondoso', C: 'Rigoroso' },
    { D: 'Independente', I: 'Magnético', S: 'Dedicado', C: 'Acurado' },
    { D: 'Ágil', I: 'Carismático', S: 'Acolhedor', C: 'Pensativo' },
    { D: 'Empreendedor', I: 'Espontâneo', S: 'Previsível', C: 'Crítico' },
    { D: 'Autoconfiante', I: 'Vivaz', S: 'Tranquilo', C: 'Reservado' },
    { D: 'Corajoso', I: 'Extrovertido', S: 'Gentil', C: 'Objetivo' },
    { D: 'Enérgico', I: 'Falante', S: 'Modesto', C: 'Racional' },
    { D: 'Exigente', I: 'Alegre', S: 'Equilibrado', C: 'Investigativo' },
    { D: 'Inquieto', I: 'Amigável', S: 'Confiável', C: 'Conservador' },
    { D: 'Líder', I: 'Popular', S: 'Atencioso', C: 'Diligente' },
    { D: 'Focado em resultado', I: 'Receptivo', S: 'Generoso', C: 'Estruturado' },
    { D: 'Inovador', I: 'Confiante', S: 'Harmonioso', C: 'Minucioso' },
    { D: 'Vencedor', I: 'Influente', S: 'Solidário', C: 'Padronizado' }
  ];

  /* matriz: para cada tipo de paciente, [risco, ajuste] */
  var FATORES = {
    D: {
      letra: 'D', fator: 'Dominância', eixo: 'Como reage a problemas e desafios', cor: '#b5523f',
      temperamento: 'Colérico', elemento: 'Fogo', apelido: 'o executor', move: 'controle e eficiência',
      paciente: 'Paciente colérico',
      tracos: 'Direto · Decidido · Focado em resultado',
      essencia: 'Você lê o mundo pelos problemas que precisa resolver. Foco em resultado, autonomia e velocidade. Prefere desafios concretos a discussões abstratas e age rápido mesmo com informação incompleta. Tende a querer controle do próprio destino e impacto visível no que produz.',
      comunicacao: 'Vai direto ao ponto. Valoriza objetividade e não tem paciência para rodeios. Para falar com esse perfil, use tópicos curtos e feche com uma decisão clara. Evite contextualizações longas: comece pelo resultado esperado e só depois explique o porquê.',
      ambiente: 'Ambientes com autonomia, desafios mensuráveis, ritmo rápido e pouca burocracia. Detesta microgerenciamento. Rende mais quando a meta é clara e o caminho é livre.',
      forcas: ['Tomada de decisão rápida', 'Foco em resultado e prazo', 'Coragem para enfrentar problemas', 'Iniciativa e senso de urgência', 'Não tem medo de risco calculado'],
      atencao: ['Pode parecer impaciente ou autoritário', 'Tende a ignorar detalhes operacionais', 'Atropela o ritmo de pessoas mais cautelosas', 'Decide rápido demais em temas que pediam análise', 'Pode subestimar o impacto humano de uma decisão'],
      liderar: 'Para liderar esse perfil: dê o resultado esperado e o limite, não o caminho. Para ser liderado por ele: traga o problema com uma solução proposta, um prazo realista e um ponto de decisão claro. Nunca chegue sem opinião.',
      desenvolver: ['Treinar a escuta antes de responder', 'Registrar as decisões importantes', 'Negociar prazo com quem é mais analítico', 'Investir tempo no lado humano da equipe', 'Aprender a delegar sem cobrar a cada hora'],
      equipe: {
        atende: { forca: 'Conduz com firmeza, fecha com coragem e não teme objeção.', risco: 'Atropelar, pressionar, vencer o debate e perder a venda.' },
        matriz: {
          D: ['Disputa de controle: dois fogos na sala.', 'Ofereça opções e deixe o paciente com o volante da decisão.'],
          I: ['Cortar as histórias do paciente por pressa.', 'Respire, escute até o fim e colha o detalhe.'],
          S: ['O maior risco de todos: a sua velocidade é a pressão que trava o paciente.', 'Desacelere de propósito. Nada de fechar na primeira chamada.'],
          C: ['Impaciência com o tempo de validação do paciente.', 'Entregue fontes e dê o tempo. Não cobre decisão.']
        },
        funcoes: ['Closer e negociação de tratamentos', 'Coordenação comercial e metas', 'Gestão de equipe ou de unidade', 'Parcerias, convênios e empresas', 'Projetos novos que pedem velocidade'],
        poucoRende: 'Rotina repetitiva sem meta e controle minucioso sem autonomia.'
      },
      medico: {
        conduz: { forca: 'Conduz com firmeza, faz a indicação sem rodeio e não teme objeção. O paciente percebe autoridade.', risco: 'Atropelar, pressionar e ganhar a discussão sem ganhar o paciente.' },
        matriz: {
          D: ['Disputa de controle: dois fogos na sala.', 'Apresente as opções e deixe a decisão com o paciente.'],
          I: ['Cortar as histórias do paciente por pressa.', 'Escute até o fim: é ali que aparece o que ele quer para a vida.'],
          S: ['O maior risco de todos: a sua velocidade é a pressão que trava o paciente.', 'Desacelere de propósito, explique em etapas e não peça decisão na consulta.'],
          C: ['Impaciência com as perguntas e a validação do paciente.', 'Responda com dado, ofereça material para ele conferir depois e dê tempo.']
        },
        lideranca: {
          texto: 'Você lidera pela meta e pela velocidade. A equipe sabe para onde ir e sente que a clínica anda. O risco é centralizar: decidir tudo, corrigir na hora e em público e criar uma equipe que espera a sua ordem para agir.',
          praticas: ['Defina a meta e o limite e deixe o caminho com quem executa', 'Faça uma reunião curta de indicadores toda semana, no mesmo horário', 'Corrija em particular e elogie em público', 'Antes de cobrar, pergunte o que está travando']
        },
        complemento: {
          texto: 'Você puxa o ritmo e a decisão. Em geral, falta quem cuide do detalhe e quem cuide das pessoas.',
          perfis: [['S', 'na recepção e no pós-venda, para o cuidado com o paciente'], ['C', 'no financeiro, na agenda e nos processos, para o detalhe que você pula'], ['I', 'no SDR e na closer, para o calor humano no atendimento']]
        }
      }
    },
    I: {
      letra: 'I', fator: 'Influência', eixo: 'Como influencia as pessoas', cor: '#d4a84a',
      temperamento: 'Sanguíneo', elemento: 'Ar', apelido: 'o conector', move: 'experiência e conexão',
      paciente: 'Paciente sanguíneo',
      tracos: 'Caloroso · Persuasivo · Otimista',
      essencia: 'Você lê o mundo pelas pessoas que conecta. Foco em relacionamento, narrativa e impacto emocional. Energiza o ambiente, traz as pessoas para a causa e cresce onde há diálogo. Tende a precisar de reconhecimento e de lugares onde a sua voz é ouvida.',
      comunicacao: 'Conversa antes de decidir. Valoriza o tom, o contexto humano e o “como” tanto quanto o “o quê”. Para falar com esse perfil, use história, exemplo concreto e abertura para o diálogo. Mensagem muito seca soa fria e desengaja.',
      ambiente: 'Ambientes colaborativos, com contato com gente, reconhecimento das conquistas e liberdade para criar.',
      forcas: ['Engajar e mobilizar pessoas', 'Comunicação persuasiva', 'Criatividade e geração de ideias', 'Otimismo contagiante', 'Cria vínculo rápido com o paciente'],
      atencao: ['Pode prometer mais do que entrega', 'Dificuldade com tarefas solitárias e detalhistas', 'Evita o conflito necessário', 'Subestima os dados nas decisões', 'Tende a dispersar o foco em muitas frentes'],
      liderar: 'Para liderar esse perfil: combine um objetivo claro com reconhecimento público quando ele entrega. Para ser liderado por ele: traga energia, mostre abertura e registre por escrito o que foi combinado de boca.',
      desenvolver: ['Disciplina de follow-up por escrito', 'Aprofundar a análise antes de decidir', 'Treinar conversas difíceis sem dourar a pílula', 'Foco em uma frente por vez', 'Criar o hábito de checar o dado, não só a impressão'],
      equipe: {
        atende: { forca: 'Conecta na hora, encanta e faz o paciente se sentir especial.', risco: 'Falar mais do que ouvir, perder o fio da condução e prometer além do combinado.' },
        matriz: {
          D: ['O paciente acha você prolixo e encerra.', 'Corte quase toda a conversa social e vá ao ponto.'],
          I: ['Duas horas de conversa deliciosa e nenhuma condução.', 'Aproveite a conversa e siga as 8 etapas do In The Bag mesmo assim.'],
          S: ['A sua energia alta soa como pressão disfarçada.', 'Baixe o volume e alongue as pausas.'],
          C: ['O paciente desconfia de entusiasmo sem dado.', 'Coloque uma fonte atrás de cada afirmação.']
        },
        funcoes: ['SDR e primeiro contato com o paciente', 'Closer e apresentação de orçamento', 'Recepção que encanta e fideliza', 'Relacionamento com pacientes e parceiros', 'Conteúdo, redes sociais e eventos'],
        poucoRende: 'Trabalho isolado, tarefa monótona, conferência de detalhe e cultura de silêncio.'
      },
      medico: {
        conduz: { forca: 'Cria conexão na hora e faz o paciente se sentir especial. Ele sai encantado com a consulta.', risco: 'Falar mais do que ouvir, perder o fio da consulta e prometer além do que pode. Pela CFM 2.336/2023, fale do objetivo do tratamento, nunca de garantia de resultado.' },
        matriz: {
          D: ['O paciente acha a consulta longa e se desliga.', 'Corte a conversa social e vá direto ao diagnóstico e à indicação.'],
          I: ['Uma conversa ótima que não chega à indicação.', 'Aproveite a conexão e siga o roteiro da consulta mesmo assim.'],
          S: ['A sua energia alta soa como pressão.', 'Baixe o tom, fale mais devagar e deixe pausas.'],
          C: ['O paciente desconfia de entusiasmo sem dado.', 'Apoie cada afirmação em exame, estudo ou número.']
        },
        lideranca: {
          texto: 'Você lidera pelo entusiasmo. A equipe gosta de trabalhar com você e compra as suas ideias. O risco é a falta de constância: muitas ideias começadas, combinados que ficam só na conversa e cobrança que não acontece.',
          praticas: ['Registre por escrito cada combinado, com responsável e prazo', 'Escolha uma prioridade por mês e termine antes de abrir outra', 'Deixe alguém de perfil C ou S cuidando dos processos', 'Faça a conversa difícil no dia em que o problema aparece']
        },
        complemento: {
          texto: 'Você atrai e encanta. Em geral, falta quem transforme ideia em rotina e quem cobre o resultado.',
          perfis: [['C', 'nos processos, na agenda e nos indicadores, para a organização'], ['S', 'na recepção e no pós-venda, para a constância'], ['D', 'na gestão comercial, para a meta e a cobrança']]
        }
      }
    },
    S: {
      letra: 'S', fator: 'Estabilidade', eixo: 'Como reage ao ritmo do ambiente', cor: '#5f8f72',
      temperamento: 'Fleumático', elemento: 'Água', apelido: 'o cauteloso', move: 'segurança e pertencimento',
      paciente: 'Paciente fleumático',
      tracos: 'Paciente · Leal · Constante',
      essencia: 'Você lê o mundo pelo ritmo das pessoas e pela harmonia do grupo. Foco em constância, confiança e cuidado. Prefere construir aos poucos a disputar o holofote. Tende a ser a cola da equipe: quem sustenta a operação quando os outros oscilam.',
      comunicacao: 'Ouve mais do que fala. Valoriza estabilidade, gentileza e tempo para processar. Para falar com esse perfil, use calma, não exija resposta imediata e nunca trate assunto delicado em público. Decisão súbita gera resistência silenciosa, não confronto direto.',
      ambiente: 'Ambientes previsíveis, com regras claras, relação de confiança e mudança gradual.',
      forcas: ['Constância e confiabilidade', 'Trabalho em equipe de verdade', 'Paciência com processo', 'Escuta profunda', 'Lealdade ao grupo e à liderança'],
      atencao: ['Resistência a mudança brusca', 'Dificuldade em dizer não', 'Evita o conflito mesmo quando ele é saudável', 'Pode acumular insatisfação em silêncio', 'Tende a se sobrecarregar para não desagradar'],
      liderar: 'Para liderar esse perfil: antecipe as mudanças, dê tempo para processar e converse sem plateia. Para ser liderado por ele: respeite o tempo de resposta, valorize a entrega constante e nunca cobre em público.',
      desenvolver: ['Treinar dizer não com empatia', 'Praticar decidir com 80% da informação', 'Sair da zona de conforto em projetos novos', 'Falar da discordância na hora, não depois', 'Pedir feedback sobre o próprio desempenho'],
      equipe: {
        atende: { forca: 'Transmite calma e segurança, escuta como ninguém e sustenta relacionamentos longos.', risco: 'Não pedir o fechamento, aceitar o “vou pensar” sem explorar e deixar a venda morrer de gentileza.' },
        matriz: {
          D: ['O paciente domina a conversa e você não recupera a condução.', 'Prepare uma estrutura firme antes e apoie-se no processo.'],
          I: ['O paciente esfria porque ninguém propôs o próximo passo.', 'Peça o fechamento no pico da emoção. Treine a frase antes.'],
          S: ['Dois cautelosos: decisão infinita.', 'Assuma o follow-up, com datas combinadas.'],
          C: ['Conversa excelente que nunca chega a uma decisão.', 'Feche cada chamada com um combinado explícito e um prazo.']
        },
        funcoes: ['Recepção e secretaria', 'Agendamento e confirmação de consultas', 'Pós-venda e acompanhamento do paciente operado', 'Orientação cirúrgica e preparo do paciente', 'Assistência no consultório e no centro cirúrgico'],
        poucoRende: 'Mudança constante, política interna, cobrança em público e meta agressiva sem apoio.'
      },
      medico: {
        conduz: { forca: 'Transmite calma e segurança e escuta como ninguém. O paciente se sente cuidado.', risco: 'Não fazer a indicação com firmeza, aceitar o “vou pensar” sem explorar e deixar a decisão morrer de gentileza.' },
        matriz: {
          D: ['O paciente toma conta da conversa e você perde a condução.', 'Siga a estrutura da consulta e faça a indicação com firmeza.'],
          I: ['O paciente sai encantado, mas sem próximo passo.', 'Faça a indicação clara no momento de maior interesse e passe para a closer.'],
          S: ['Dois cautelosos: decisão infinita.', 'Saia da consulta com o próximo contato marcado.'],
          C: ['Uma ótima conversa técnica que não chega a lugar nenhum.', 'Feche a consulta com o próximo passo e o prazo combinados.']
        },
        lideranca: {
          texto: 'Você lidera pelo exemplo e pelo cuidado. A equipe confia em você e o clima é bom. O risco é evitar o conflito: tolerar quem não entrega, adiar demissões e não cobrar metas para não desagradar.',
          praticas: ['Deixe metas e regras por escrito, para a cobrança não depender do seu humor', 'Marque a conversa difícil na agenda, em vez de esperar o momento certo', 'Tenha um gestor de perfil D para puxar ritmo e resultado', 'Diga o que pensa na reunião, não depois']
        },
        complemento: {
          texto: 'Você dá estabilidade e cuidado. Em geral, falta quem acelere, venda e cobre.',
          perfis: [['D', 'na gestão e na closer, para meta, ritmo e decisão'], ['I', 'no SDR e no relacionamento, para atrair e engajar pacientes'], ['C', 'no financeiro e nos processos, para os controles']]
        }
      }
    },
    C: {
      letra: 'C', fator: 'Conformidade', eixo: 'Como reage a regras e procedimentos', cor: '#6c80a8',
      temperamento: 'Melancólico', elemento: 'Terra', apelido: 'o analítico', move: 'entendimento e critério',
      paciente: 'Paciente melancólico',
      tracos: 'Preciso · Sistemático · Cauteloso',
      essencia: 'Você lê o mundo pela qualidade do dado e pela lógica do processo. Foco em precisão, padrão e excelência técnica. Prefere fazer certo a fazer rápido. Tende a desconfiar de decisão sem evidência e a defender o rigor mesmo contra a vontade do grupo.',
      comunicacao: 'Pensa antes de falar. Valoriza dado, lógica e tempo para analisar. Para falar com esse perfil, traga fato, referência e raciocínio explícito. Não pressione por resposta imediata em tema complexo: a decisão sai melhor no dia seguinte.',
      ambiente: 'Ambientes com critério claro, tempo para análise, padrão de qualidade e respeito ao processo.',
      forcas: ['Análise profunda e crítica', 'Atenção aos detalhes', 'Compromisso com a qualidade', 'Pensamento sistemático', 'Confiabilidade em assunto técnico'],
      atencao: ['Paralisia por análise', 'Perfeccionismo que atrasa a entrega', 'Crítica em excesso com quem é mais criativo', 'Resistência à decisão “boa o suficiente”', 'Pode parecer frio ou distante em momentos humanos'],
      liderar: 'Para liderar esse perfil: traga dado, critério e tempo para revisar. Para ser liderado por ele: prepare a argumentação com base, antecipe as perguntas técnicas e respeite o pedido de mais informação antes de decidir.',
      desenvolver: ['Praticar decidir com informação incompleta', 'Trabalhar o lado emocional da liderança', 'Comunicar com mais calor humano', 'Aceitar que o perfeito é inimigo do feito', 'Buscar feedback fora do próprio padrão técnico'],
      equipe: {
        atende: { forca: 'Domina o produto, responde tudo com precisão e gera credibilidade técnica.', risco: 'Explicar demais, esfriar a emoção da compra e tratar a venda como prova oral.' },
        matriz: {
          D: ['Detalhe técnico que o paciente não pediu: ele olha o relógio.', 'Responda em uma frase. Aprofunde só se ele pedir.'],
          I: ['A frieza técnica apaga a conexão que o paciente precisa.', 'Comece pela pessoa e termine no dado.'],
          S: ['Informação demais aumenta o medo do paciente.', 'Simplifique, normalize e acolha antes de explicar.'],
          C: ['O menor risco de todos: vocês falam a mesma língua. Cuidado só com a aula de duas horas.', 'Profundidade com direção: amarre cada explicação ao critério de decisão do paciente.']
        },
        funcoes: ['Financeiro e faturamento', 'Convênios, autorizações e guias', 'Agenda, CRM e indicadores', 'Compras, estoque e insumos', 'Processos, protocolos e qualidade'],
        poucoRende: 'Improviso o tempo todo, regra que muda sem aviso e pressa sem informação suficiente.'
      },
      medico: {
        conduz: { forca: 'Domina a técnica, responde tudo com precisão e passa credibilidade.', risco: 'Explicar demais, esfriar a emoção da decisão e transformar a consulta em aula.' },
        matriz: {
          D: ['Detalhe técnico que o paciente não pediu: ele olha o relógio.', 'Responda em uma frase e aprofunde só se ele pedir.'],
          I: ['A explicação técnica apaga a conexão que o paciente precisa.', 'Comece pela pessoa e termine no dado.'],
          S: ['Informação demais aumenta o medo do paciente.', 'Simplifique, acolha e só depois explique.'],
          C: ['O menor risco de todos: vocês falam a mesma língua. Cuidado com a aula de duas horas.', 'Amarre cada explicação ao que o paciente precisa para decidir.']
        },
        lideranca: {
          texto: 'Você lidera pelo padrão. A clínica tem processo, protocolo e qualidade técnica. O risco é a rigidez: corrigir demais, demorar para decidir e deixar a equipe com a sensação de que nada está bom o suficiente.',
          praticas: ['Decida com a informação que tem quando esperar custar mais caro', 'Elogie o que está certo antes de apontar o que falta', 'Delegue com um padrão claro e aceite caminhos diferentes do seu', 'Tenha alguém de perfil I cuidando do lado humano e do relacionamento']
        },
        complemento: {
          texto: 'Você garante padrão e qualidade. Em geral, falta quem faça o relacionamento e acelere as decisões.',
          perfis: [['I', 'na recepção, no SDR e na closer, para o lado humano e a conversão'], ['D', 'na gestão, para acelerar decisões e cobrar metas'], ['S', 'no pós-venda, para acolher o paciente']]
        }
      }
    }
  };

  /* fator principal + secundário: [nome, leitura] */
  var COMBOS = {
    DI: ['Persuasor', 'Autoridade que arrasta as pessoas. Resultado pela narrativa.'],
    DC: ['Estrategista', 'Dirige com método. Resultado pela precisão.'],
    DS: ['Realizador firme', 'Entrega com confiabilidade. Resultado pela constância.'],
    ID: ['Influenciador de resultado', 'Vende a ideia e fecha. Pessoas e resultado.'],
    IS: ['Conselheiro', 'Gentil e querido. Pessoas pela conexão duradoura.'],
    IC: ['Inspirador analítico', 'Persuasão com dado. Combinação rara e valiosa.'],
    SD: ['Especialista', 'Sólido e com ambição. Constrói antes de competir.'],
    SI: ['Coach', 'Apoio que motiva. Cuida da equipe inteira.'],
    SC: ['Coordenador', 'Método com cuidado humano. Operação que não falha.'],
    CD: ['Perfeccionista executor', 'Exige de si e do time. Padrão alto.'],
    CI: ['Diplomata técnico', 'Convence pelo argumento. Lógica com tom.'],
    CS: ['Avaliador', 'Qualidade com paciência. Constrói padrão duradouro.']
  };

  var GRAFICOS = 'O DISC separa duas leituras. O perfil Adaptado mostra como você se apresenta no trabalho hoje, o comportamento que o ambiente pede de você (a “máscara”). O perfil Natural mostra como você age quando a pressão aperta e não dá tempo de se ajustar (o “núcleo”). Quando os dois têm o mesmo formato, você trabalha do seu jeito. Quando são muito diferentes, o papel atual exige um esforço de adaptação.';

  var PUBLICOS = {
    medico: {
      titulo: 'Perfil comportamental do médico',
      chamada: ['Como você decide, lidera', 'e conduz a consulta.'],
      lead: 'O DISC mostra o seu jeito natural de agir: como você reage a desafios, se comunica e lida com o ritmo e com as regras. O resultado traz o seu temperamento (o mesmo da apostila Temperamentos Black), como você lidera a equipe, como conduz a consulta com cada tipo de paciente e quais perfis completam o seu na clínica. O Teste de Arquétipo cuida do seu tom no Instagram; este cuida do seu comportamento na clínica.',
      contexto: 'Pense em como você age na clínica hoje: com a equipe, com os pacientes e nas decisões.',
      dica: 'Pense em como você age na clínica hoje.',
      campos: [
        { id: 'nome', rotulo: 'Nome', placeholder: 'Como prefere ser chamado', autocomplete: 'name', obrigatorio: true },
        { id: 'cidade', rotulo: 'Cidade', placeholder: 'Cidade onde atua', autocomplete: 'address-level2' }
      ],
      proximos: 'Baixe o PDF e envie na conversa em que você recebeu este teste. Para montar ou ajustar a equipe, peça o Teste DISC da equipe: oftalmoblack.com.br/teste-disc/equipe/',
      contratar: 'Na hora de contratar, peça o Teste DISC da equipe: oftalmoblack.com.br/teste-disc/equipe/'
    },
    equipe: {
      titulo: 'Perfil comportamental da equipe',
      chamada: ['Como você trabalha,', 'se comunica e atende.'],
      lead: 'O DISC mostra o seu jeito natural de agir no trabalho: como você reage a desafios, se comunica e lida com o ritmo e com as regras. O resultado traz o seu temperamento, as funções da clínica em que você tende a render mais, como você atende cada tipo de paciente e como o seu líder pode tirar o melhor de você.',
      contexto: 'Pense em como você age no trabalho hoje, não em casa nem com os amigos.',
      dica: 'Pense em como você age no trabalho hoje.',
      campos: [
        { id: 'nome', rotulo: 'Nome completo', placeholder: 'Seu nome e sobrenome', autocomplete: 'name', obrigatorio: true },
        { id: 'cargo', rotulo: 'Cargo ou função', placeholder: 'Ex.: SDR, closer, recepção, financeiro', autocomplete: 'organization-title' },
        { id: 'clinica', rotulo: 'Clínica', placeholder: 'Clínica ou médico com quem trabalha', autocomplete: 'organization' }
      ],
      proximos: 'Baixe o PDF e envie para o seu líder ou para quem pediu o teste. O resultado é confidencial e de uso interno da clínica.',
      ressalva: 'O DISC mostra tendência de comportamento, não competência técnica nem caráter. Use junto com a entrevista, o histórico da pessoa e o período de experiência.',
      apostila: 'Pela apostila Temperamentos Black, quem atende paciente precisa saber o próprio temperamento dominante e o secundário.'
    }
  };

  window.DISC = { ORDEM: ORDEM, GRUPOS: GRUPOS, FATORES: FATORES, COMBOS: COMBOS, GRAFICOS: GRAFICOS, PUBLICOS: PUBLICOS };
})();
