# Participantes e responsabilidade na extração Fathom

## Política vigente — 08/10/2026

O usuário autorizou aprovação automática das pendências internas com responsável
identificado. A etapa inicial de extração descrita abaixo continua registrando
propostas; a decisão final é feita por `final-review.mjs`, lendo a transcrição
inteira, agrupando a mesma obrigação e comparando com as demandas existentes.
`review-workflow.mjs` fornece o consumidor da fila, separado do fluxo de atas.

- Pendência interna identificada: cria demanda **A fazer**, com aprovação automática.
- Equivalente comprovada: vincula à existente, preservando seu status e histórico.
- Clínica, orientação ou ação resolvida na chamada: contexto, sem demanda.
- Responsável incerto: fila **A definir**, em `/admin/fathom/`.
- Existência da pendência incerta: mesma fila, exigindo confirmação de que continua
  pendente antes de atribuir e aprovar.

`public.fathom_actions` é a fonte atual das decisões e atribuições. A extração
guarda referências para essas ações; a classificação nela é um retrato da revisão,
não substitui alterações humanas posteriores na fila. O histórico de atribuição é
registrado por trigger. A fonte anterior completa permanece em
`memoria_operacional.demand_reviews.original_document`, incluindo o primeiro backfill.

A migração `20261008081408_fathom_automatic_demands.sql` habilita RLS, restringe a
fila à administração e usa funções SECURITY INVOKER. Usuários não administradores
não conseguem ler evidências nem aprovar; o processador privado não recebe acesso
pelo Data API. A tabela privada de execuções deliberadamente não tem políticas de
leitura para usuários (aviso informativo esperado do advisor).

Cada extração é aplicada atomicamente, com conferência de hashes, evidências e
cobertura integral; o identificador da extração/grupo e a trava transacional
impedem duplicação em retries. O consumidor reserva uma reunião por vez, consulta
o quadro atualizado, limita a três tentativas e registra falhas sem criar parte das
demandas. O processamento de atas não muda. Não reabre tarefas concluídas.

Validação: 25 testes de código; integração SQL com rollback para criação,
equivalência, aprovação administrativa e isolamento de acesso; revisão real das
cinco reuniões com evidência literal; UI em desktop/mobile com API simulada,
atribuição, filtros e redirecionamento para login. Nenhuma mensagem externa é
enviada por este fluxo.

Resultado da revisão integral dos 183 registros: 174 ações consolidadas (9
repetições agrupadas), 112 contextos, 45 responsáveis a definir e 17 pendências a
confirmar. As sete sugestões do primeiro backfill não passaram pela verificação
integral: execução na chamada ou atribuição/pendência incerta. Não foram criadas
demandas históricas automaticamente com base nelas.

O workflow de extração consulta os cadastros ativos antes de planejar a reunião.
`identities.mjs` resolve participantes e valida a associação proposta pelo modelo;
`extraction-core.mjs` mantém a extração por blocos e a quarentena de evidências
inválidas. A base foi extraída do workflow ativo em 07/10/2026.

## Regras

- Participantes preservam nome, e-mail, presença na lista de convidados e ocorrência
  como falante. Convite não comprova presença. A identidade continua informada pela fonte.
- E-mail exato tem precedência sobre nome/alias cadastrado. Conflito entre nome e
  e-mail, homônimos, contas compartilhadas e pessoas sem correspondência não recebem
  um integrante arbitrário. Não há aproximação por primeiro nome.
- O mentorado é resolvido pelo cadastro dos participantes ou por nome/alias no título.
  Vários mentorados deixam a associação pendente; beneficiário explícito precisa de
  evidência e correspondência única. Não há cadastro automático de membros ou equipe.
- A IA descreve separadamente executor, evidência da atribuição e estágio da ação.
  O código resolve IDs; IDs arbitrários fornecidos pelo modelo não são aceitos.
- Apenas ações `agreed` ou `requested`, classificadas como demanda e atribuídas a
  um integrante ativo, permanecem `kind=demand`. Ações externas, propostas e ações
  relatadas como realizadas permanecem como contexto. Casos de identidade indefinida
  recebem `routing.status=needs_identity` e não ficam elegíveis como demanda.
- `routing.member_id` e `routing.responsaveis` são propostas pendentes de curadoria.
  `eligible_for_demand` significa elegível para revisão, não aprovado. Esta etapa não
  insere em `public.demands` nem envia mensagens.

## Compatibilidade e publicação

O contrato SQL `structured-session/1` e a taxonomia `operational/3` permanecem.
A política adicional e a saída são versionadas como `participants-and-ownership/1`
em `processing.identity_version`, `processing.instruction_versions` e `routing`.
O prompt base conserva sua versão; a política adicional especializa sua definição
ampla de demanda.

### Nomes alternativos confirmados

O catálogo consulta `memoria_operacional.mentorado_aliases` para mentorados e
`memoria_operacional.staff_aliases` para integrantes da equipe. A segunda tabela
é criada pela migração `20261015173740_fathom_staff_aliases.sql`; seus registros
exigem uma referência de quem confirmou a identidade. Não há acesso para `anon`
ou `authenticated`. O processador privado usa a conexão Postgres existente.

Cadastrar somente nomes confirmados por um operador, mantendo os nomes principais
e IDs existentes. Os valores reais e a evidência da confirmação ficam no ambiente
privado, fora deste repositório. Sem alias explícito, nomes curtos não recebem
correspondência aproximada. Conflitos, cadastros inativos e suspeitas de troca de
falantes continuam bloqueando atribuição automática.

Ordem de aplicação: criar a tabela, registrar os aliases confirmados e atualizar
as consultas dos dois workflows existentes: `CATALOG_SQL` no nó **Identificar
cadastros** da extração e `RESERVE_REVIEW_SQL` no nó **Reservar revisão** da revisão
final. Essas constantes são exportadas em `patch-workflow.mjs` e
`review-workflow.mjs`. Alterar apenas as consultas, preservando credenciais, nós,
conexões e agendamentos. Publicar somente após revisar o diff contra a versão
ativa e guardar backup privado. Reverter as consultas anteriores permite rollback
sem apagar os aliases. PR ou merge não atualiza automaticamente o n8n.

A mudança afeta novas extrações/revisões. Reuniões já processadas exigem revisão
separada: não reiniciar a fila nem aprovar ações históricas por causa de um alias.
Uma obrigação cumprida após a reunião deve continuar concluída, com a evidência
registrada; uma dúvida sobre quem assumiu a ação não é resolvida pelo alias.

Teste isolado do catálogo SQL e das permissões, com PostgreSQL em memória:

```sh
# Instalar @electric-sql/pglite@0.5.10 em um diretório temporário de ferramentas.
PGLITE_MODULE=/caminho/temporario/node_modules/@electric-sql/pglite/dist/index.js \
  node --test tests/fathom-alias-catalog.integration.mjs
node --test tests/fathom-*.test.mjs
```

`patchWorkflow(original, postgresCredentials)` gera uma cópia pronta para revisão,
mantendo credenciais, nós de panoramas, atas, gravação e tratamento de falhas.
Insere apenas a leitura `Identificar cadastros`, adapta a configuração e substitui
os dois nós de código da extração. A leitura usa a credencial Postgres já existente;
não inserir senhas ou exports integrais de workflow no Git. Falha na leitura segue
para o registro de falha, sem continuar com catálogo vazio.

Antes de publicar: comparar a versão atual com o snapshot, testar em workflow
isolado sem nós de gravação, aplicar via API e conferir a versão ativa. Guardar
backup privado para restaurar os nós e conexões anteriores em caso de falha.
Não reprocessar a fila histórica nem sobrescrever extrações anteriores implicitamente.

## Validação

```sh
node --test tests/fathom-identities.test.mjs
```

Os testes cobrem conta compartilhada, nome/e-mail conflitantes, homônimos,
executor diferente do assunto, ação externa, ação já realizada, beneficiários
ambíguos, evidência inventada e execução do bundle no formato dos Code nodes.

Limitação: associação cadastral não corrige diarização incorreta do Fathom.
A revisão continua necessária, especialmente quando a mesma conta representa
várias pessoas ou a transcrição alterna indevidamente os nomes dos falantes.
O campo obrigatório `ownership.identity_uncertain` bloqueia a atribuição quando
o modelo identifica esse conflito, mesmo que o nome corresponda ao cadastro.

## Publicação de 07/10/2026

Ativo às 17h50 de Manaus no workflow `gCt1A9vYWDd3vLjZ`, versão
`18885bd5-b41b-40bb-a9d3-4e8b38286f2c`. Nós, conexões e versão ativa conferidos
por releitura da API. Os ramos de panoramas e os nós de gravação foram preservados.

Validação: 14 testes locais e duas reuniões completas em workflows temporários
sem gravação no banco; nenhuma evidência rejeitada nas duas execuções finais.
Casos com identidade incerta foram retidos. Os workflows temporários foram removidos.
As 44 extrações históricas e as 460 demandas do quadro permaneceram intactas.
A confirmação de gravação de uma nova extração fica para o próximo evento real;
esta publicação não reabre eventos concluídos. A interface de curadoria e a ponte
de criação em `public.demands` ainda são etapas separadas.

## Backfill autorizado de 07/10/2026

O pedido seguinte autorizou revisar as cinco reuniões de 02 a 07/10 que continham
183 registros `demand`. `backfill.mjs` revisa esses registros individualmente,
preservando texto, evidência original, ordem e os contextos já existentes. Usa
trechos adjacentes e o contexto da sessão; não comprova a execução atual de uma
ação nem substitui curadoria humana. A evidência adicional da classificação fica
em `classification_review`, separada da original.

Aplicação atômica nas cinco extrações, lote
`4add78af-5746-4d7b-a089-4d931f210619`: 7 sugestões internas, 76 itens de contexto
e 100 com identidade a confirmar, estes últimos fora de `kind=demand`.
Os contextos incluem propostas/orientações e relatos de ações já realizadas;
não se deve interpretar todos os itens removidos da categoria como tarefas
comprovadamente pertencentes à clínica.

`backfill-update.sql` recebe, por parâmetros: JSON das cinco revisões, booleano
de aplicação (false para simulação), array de UUIDs autorizados e ID do lote.
Confere hashes da extração e da fonte, estado pendente, equipe ativa e ausência
de ata em processamento. Falha de qualquer item impede a escrita de todos.
Arquiva o documento anterior em `previous_extraction.document` na própria linha;
`backfill` registra versão, data, lote e hashes. A revisão não se repete implicitamente.

Verificação após escrita: cinco históricos conferidos por hash, zero contextos
anteriores alterados, 44 extrações e 460 demandas do quadro mantidas. As quatro
atas prontas foram preservadas. Nenhuma demanda nova foi criada no quadro.
Os workflows temporários foram removidos. Validação local: 18 testes, incluindo
preservação de conteúdo, cobertura integral, evidência inventada, ação externa e
reprocessamento repetido.
