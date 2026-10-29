# Cérebro: recuperação de falhas de transporte sem perder contexto

## Problema e diagnóstico

O cliente chama cerebro-chat em JSON. O endpoint também suporta SSE, mas esse modo não é usado pelo cliente atual. Na ocorrência investigada, o navegador mostrou “Failed to fetch” e não ofereceu nova tentativa.

A causa reproduzida no código é que somente erros HTTP com JSON e tentar_novamente recebiam retryable. Rejeições do fetch e falhas ao ler o corpo chegavam sem essa informação; a UI exibia o erro cru e não mostrava o botão. Um HTTP 200 com objeto incompleto também podia ser aceito e apagar o histórico.

A inspeção de produção confirmou o mesmo arquivo cliente e três chamadas JSON HTTP 200 no intervalo, com durações entre 12 e 26 segundos e sem erro da função registrado. O log local do Windows registra suspensão em 28/10 às 20:56:36 UTC (Kernel-Power 42 gravado às 20:56:43) e retomada às 22:31:40 UTC. Duas respostas terminaram no servidor às 20:56:42 e 20:56:47, durante a transição. A suspensão com consultas pendentes é o gatilho provável; não há captura de rede nem ID cliente daquela tentativa para afirmar causalidade exclusiva. Os 400 trimestrais do Farol não foram observados nessa janela.

Referências: [fetch distingue rejeição de transporte de status HTTP](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch); [json lê o corpo até o fim e também pode falhar](https://developer.mozilla.org/en-US/docs/Web/API/Response/json).

## Comportamento corrigido

- Falhas de transporte, corpo interrompido, JSON inválido e respostas sem texto/histórico completo produzem erro recuperável em português.
- Resposta inválida não atualiza o histórico. O botão existente refaz a pergunta com o último contexto válido, sem duplicar a bolha nem incluir erro no histórico.
- 408, 429 e 5xx sem JSON válido permitem tentativa manual. Erro estruturado respeita a indicação explícita do servidor; 400/403/404 não ganham repetição.
- O cliente limita a 135 segundos o pedido e a leitura do corpo, acima dos 120 segundos de execução da função. Sempre limpa o timer.
- Não há repetição automática do modelo por erro de transporte. A renovação automática única após 401 permanece, com verificação da mesma conta.
- Cada tentativa manual possui UUID. A renovação de sessão mantém o ID do mesmo pedido. O servidor valida o UUID, devolve-o e registra início, conclusão ou falha com duração. Log de erro do provedor distingue ID interno da tentativa e ID do provedor.
- O console do navegador registra apenas ID, fase e código; os logs da função não recebem pergunta, resposta, fontes, tokens ou erro bruto. Diagnóstico do navegador continua local, não há serviço novo de telemetria.
- As versões de cache do club-data.js são atualizadas em membros/admin.

## Verificação

Em 28/10/2026: 336 testes Node aprovados, checagem Deno de tipos e git diff --check aprovados. Na UI, nove tentativas para cinco perguntas, com quatro falhas induzidas e quatro recuperações manuais. O histórico enviado foi idêntico entre cada falha e seu reenvio, com 2, 4, 6 e 8 entradas respectivamente. Ao final havia cinco perguntas e cinco respostas, sem bolhas duplicadas nem erro remanescente. O modelo retomou o nome fictício do projeto, os números, o horário e os limites de interpretação.

Regressões executam o cliente real e o handler real com fronteiras externas controladas. O teste integrado da UI usa o cliente real, provocando rejeição de fetch e conferindo recuperação, contexto, ausência de duplicação, desbloqueio do campo e IDs diferentes por tentativa.

Homologação manual usa a página e assets reais no Chrome, fontes fictícias e modelo real. O servidor local encerra a conexão antes dos cabeçalhos e durante o corpo após HTTP 200, além de responder 503 com HTML e 200 com objeto incompleto. Não há interceptação ou falha induzida em produção.

Comandos:
```sh
npm test
npx --yes deno check --no-lock supabase/functions/cerebro-chat/index.ts
git diff --check
```

A bateria local anterior do Farol permanece sem alteração. O timeout do cliente é exercitado com relógio controlado no teste automatizado. O teste do modelo é uma amostra, não garantia universal de respostas.

## Publicação e aceite

Componentes: **frontend** (club-data.js e versões de cache em membros/admin) e **cerebro-chat** com seus módulos existentes. Farol e SQL não mudam.

Publicar a função para habilitar correlação no servidor e o frontend com as novas versões. O cliente novo funciona com a resposta da função v31 da PR 44; request_id é aditivo. A validação de histórico pressupõe os pares completos já corrigidos na PR 44.

Merge/CI não comprovam deploy da função. Conferir o conteúdo servido, versão da função, login próprio/prévia e recuperação com fontes de teste. Esta PR não publica automaticamente as funções e a preparação não autoriza merge/deploy.

Critérios:
1. Falha recuperável mostra orientação e Tentar novamente.
2. Campo volta a aceitar entrada, sem nova chamada automática.
3. Tentar novamente conserva a mesma pergunta e os pares anteriores; não duplica a pergunta.
4. Uma pergunta posterior retoma a resposta recuperada, números e ressalvas.
5. Corpo incompleto não vira sucesso nem apaga histórico.
6. 401/403 continuam respeitando autenticação e isolamento.
7. Logs correlacionam a tentativa sem conteúdo sensível.

Rollback: restaurar os assets e versões de cache anteriores; restaurar cerebro-chat v31 com dependências se necessário. Sem migração. O rollback do frontend retira a recuperação adicionada aqui.

## Limites

“completed” no log da função indica resposta preparada, não recebimento pelo navegador. O UUID de diagnóstico não é autorização nem mecanismo de idempotência de efeitos externos. As ferramentas atuais do chat são consultivas; uma futura ferramenta de escrita exigirá idempotência própria antes de permitir retries.

A conversa continua limitada à sessão da página. Persistência após recarga/dispositivo e recuperação automática de respostas concluídas no servidor não fazem parte desta mudança.
