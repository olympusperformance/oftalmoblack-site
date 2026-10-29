# Hands-on Grau Zero: v2 e v2.1 para comparação

Pedido de Felipe em28/10/2026 nesta conversa: reproduzir a qualidade de UI/UX de `/workshop/v2/`, incluindo caixa inicial de interesse e transição para tela dedicada de perguntas. Criar primeiro a v2; derivar v2.1 com a mesma estrutura/conteúdo/fluxo e estilo inspirado em Apple, preservando as cores Black.

## Entregas autorizadas

- `/hands-on-grau-zero/v2/`: referência visual e de jornada do workshop.
- `/hands-on-grau-zero/v2.1/`: somente outra camada visual sobre a mesma experiência.
- Ambas como prévias interativas de revisão, noindex, sem analytics, checkout, gravação de candidatura ou mensagens. Aviso discreto e inequívoco de prévia junto ao formulário e no final. Não apresentar conclusão da prévia como cadastro recebido. A principal que recebe candidaturas não faz parte desta alteração.
- Links separados para comparar; não criar navegação de versão no conteúdo destinado ao candidato.

## Fontes

- Referência pública e fonte: `public/workshop/v2/index.html`, inspecionada pelo navegador. Caixa compacta, CTA dourado arredondado, hierarquia tipográfica forte, fundos Black, tela de pesquisa sem distrações, uma pergunta por vez. Não copiar preço R$97, checkout, data de outubro, ingresso, garantia ou perguntas comerciais do Workshop.
- Conteúdo atual do Hands-on em `public/hands-on-grau-zero/index.html`. Hero aprovado: “A cirurgia premium começa antes da lente.” Subtítulo atual, perfil de participação, CRM-AM7516/RQE3514, mais de30mil cirurgias, mais de15anos e seis anos como professor da UFAM. Não inventar oferta, resultados, certificado ou depoimentos.
- Datas de19 a21/11 confirmadas na Agenda pelo briefing comum. Se incluídas, escrever “19 a21 de novembro de2026”. Local, vagas disponíveis e preço continuam não confirmados; não inventar. Preservar o conteúdo atual sobre avaliação, medidas e planejamento premium. Não destacar números de capacidade/cirurgias como escassez de novembro.
- Formulário atual define perguntas e aceita zero cirurgias, não operador e quem não tem clínica. Não importar critérios do Club.

## Estrutura e comportamento

1. Topbar com marca oficial, discreta indicação de público.
2. Hero editorial com copy atual à esquerda e caixa enxuta de interesse à direita; no celular, empilhar. Nome e WhatsApp com DDD na caixa; não acrescentar e-mail obrigatório. CTA “Continuar minha aplicação”, pill dourado, estados hover/focus/pressed.
3. Após validação, esconder a landing e abrir uma área dedicada em tela cheia, com marca, indicação de progresso, pergunta atual e navegação. Foco no título, scroll ao topo, nenhuma pergunta ou opção deve disparar envio externo.
4. Mesmas perguntas nas duas versões, em sete passos: CRM+UF; experiência de catarata; número médio de cirurgias/mês; experiência com lentes; oferta de lentes de alta tecnologia; clínica própria; objetivo opcional. Mesmas opções da aplicação atual. Perguntas com opções usam alvos largos e seleção evidente. Zero numérico válido. Não desqualificar por resposta.
5. Voltar/continuar preserva respostas; permitir alterar dados iniciais. Enter pode avançar quando apropriado e não deve concluir acidentalmente um textarea. Campos/estado somente em memória, sem PII na URL ou localStorage. Deep link sem dados deve levar ao início.
6. Conclusão com revisão do que foi informado e frase clara “Prévia concluída. Nenhum dado foi enviado.” Botão para revisar respostas e opção de recomeçar. Nenhuma mensagem “Candidatura recebida”, ranking/qualificação ou checkout. A submissão real será ligada depois da escolha de versão e revisão do contrato.
7. Landing conserva experiência do produto e mentor com foto existente e FAQ, CTAs para caixa inicial. Pesquisa só exibe o que ajuda a responder.

## Direção visual

V2: negro#0A0A0A, painel#151310, dourado#D89D4D, dourado claro#E6BD74, marfim#F5F0E6, secundário#BEB8AD. DM Sans local do workshop; ênfase editorial pontual em serif como a referência. Grid de fundo e luz dourada discretos, caixa bem composta, botões dourados arredondados. Melhorar tipografia, espaçamento e estados, sem animações decorativas contínuas.

V2.1: mesma marca, copy e DOM funcional. Camada visual inspirada em Apple: fonte de sistema, tipografia grande e limpa, respiro, superfícies negras suaves, divisores discretos e cantos contínuos; botões pill dourados. Reduzir grid/ornamento e contraste de bordas. Não trocar o dourado pelo azul nem fazer a página branca. Não copiar logo Apple, fonte proprietária ou materiais da Apple. A diferença deve ser visível em tipografia, ritmo, superfícies e microinterações.

Assets: marca/fotos existentes em `public/hands-on-grau-zero/assets/` e `public/workshop/assets/`. Sem imagens novas, placeholders ou bibliotecas/CDNs adicionais. Preferir CSS compartilhado e override Apple para garantir igualdade de conteúdo e fluxo.

## Qualidade e verificação

Responsivo320/375/390/768/1440, paisagem, sem overflow. Alvos44px, labels reais, focus visível, radios nativos ou semântica equivalente, erros por campo, `prefers-reduced-motion`, contraste legível. Testes devem cobrir validação, zero, voltar/alterar, conclusão sem envios, igualdade funcional, ausência de PII em URL/storage e ausência de regressão na principal/v0/workshop. Artefatos de QA fora depublic. Revisão visual por screenshots e revisão de código antes da publicação das prévias.

Não alterar backend, receptor, scripts de tracking da principal, CRM, filas, campanhas, condições comerciais ou arquivos das outras frentes. Código público não recebe este contexto privado nem dados de contatos.

## Compatibilidade da publicação

A conferência HTTP da PR50 encontrou os módulos `.mjs` servidos como `application/octet-stream` pelo nginx de produção, bloqueando sua execução no navegador. Controlador e modelo usam `.js` com `type="module"`, import relativo e teste ajustados. Conferir o MIME JavaScript dos dois arquivos publicados e percorrer a aplicação no domínio final antes de entregar os links. Essa correção não exige alterar o nginx ou o pacote raiz.
