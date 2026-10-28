# Cérebro: indicadores, funil e continuidade do chat

## Problema e causa

O chat consultava a RPC legada `cerebro_metricas`, enquanto a Visão Geral usa `farol-metricas` e `get_funil_metrics`. A consulta legada combina leads e agendamentos por criação com comparecimentos por data agendada, usa janela móvel a partir de `now()` e outra regra de contagem. Por isso não é uma conciliação válida com o calendário e a deduplicação do painel.

As etapas do painel também têm unidades diferentes: leads e consultas contam pessoas; indicações e fechamentos contam registros por procedimento. `cirurgias` é o nome legado da chave de Fechamentos, incluindo exames. Os totais de uma janela não constituem uma coorte. Subtrair etapas não mede abandono e realizadas/agendadas não apura comparecimento.

O corte `mensagens.slice(-12)` podia separar um `tool_result` da sua chamada `tool_use`. A regressão reproduz esse defeito com várias consultas e continuação da conversa. A [API do provedor exige a correspondência e a ordem dos blocos](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls). Os erros 502 observados na auditoria não preservaram o motivo upstream, portanto não é possível atribuir retroativamente cada ocorrência a esse defeito.

O formatador do navegador reconhecia apenas títulos, listas e ênfase. Links e tabelas não eram implementados, e a ordem dos regex formatava conteúdo que deveria permanecer literal dentro de código.

## Mudanças

- O chat chama o endpoint do painel com o JWT do ator e o membro já autorizado pelo servidor. O modelo não escolhe o vínculo. Só agregados do funil, período, fuso, cobertura e definições entram na resposta da ferramenta; não entram dados financeiros ou registros individuais.
- Datas explícitas e filtros do painel são preservados. Janelas de 1 a 366 dias usam o calendário da clínica, incluindo hoje. Ausência de fonte permanece nula; zero registrado permanece zero.
- Contrato da ferramenta e instruções do assistente explicam unidades, fechamentos e limites de coorte. Taxas sem denominador compatível ficam indisponíveis. Simulações declaradas da mesma coorte continuam possíveis.
- Histórico entre perguntas guarda até seis pares completos de pergunta/resposta final. Blocos intermediários de ferramentas ficam apenas na execução atual. Históricos antigos com cortes inválidos são normalizados.
- Erros do provedor recebem código e indicação de nova tentativa. Logs contêm apenas status e request ID, nunca corpo, prompts, fontes ou chaves. Falhas temporárias oferecem botão de nova tentativa; não há repetição automática de chamadas ao modelo.
- Markdown limitado e escapado: links HTTP(S) e internos por caminho absoluto, tabelas com cabeçalho e rolagem, listas e código literal. URLs executáveis, HTML externo, hosts implícitos e barras invertidas não viram links.

## Verificação

Em 28/10/2026: 312 testes Node e 2 testes Deno aprovados; checagem de tipos das duas Edge Functions e diff sem erros.

Regressões exercitam o handler real com fronteiras de rede simuladas: mesma fonte e JWT, isolamento do membro, datas, unidades, ausência versus zero, histórico com múltiplas ferramentas, metadados de erro, sessão e nova tentativa. Os testes de Farol exercitam autorização e o intervalo enviado à RPC, incluindo fuso America/Manaus e 60 dias.

Comandos:

```sh
npm ci --ignore-scripts
npm test
npx --yes deno check --node-modules-dir=auto --no-lock supabase/functions/cerebro-chat/index.ts supabase/functions/farol-metricas/index.ts
npx --yes deno test --allow-env --allow-net --node-modules-dir=auto --no-lock tests/farol-acesso.test.ts
git diff --check
```

A UI local usa a página e os assets reais com fontes sintéticas: tabela renderizada, link aberto em outra aba e falha temporária seguida de nova tentativa sem duplicar a pergunta. Isso verifica apresentação e fluxo; não valida uma resposta nova do modelo em produção. Não foram copiados dados privados da auditoria para este repositório.

## Publicação e aceite

São três componentes: **farol-metricas**, **cerebro-chat** e **frontend da área de membros**. Não há migração de banco. Publicar primeiro Farol, depois chat com os módulos locais e depois frontend. Preservar os secrets e a configuração de autenticação atuais; não desabilitar validação JWT para contornar erro.

O workflow de main publica somente o frontend no VPS. CI, merge ou frontend publicado não provam publicação das Edge Functions. O responsável pela publicação deve registrar versão/commit de cada componente e verificar os arquivos efetivamente servidos. A preparação desta PR não executa merge ou deploy.

Após a publicação:

1. Comparar painel e chat no mesmo membro, datas e fuso, incluindo 30 dias e intervalo explícito. Conferir a janela devolvida, sem atribuir movimentações concorrentes a divergência de consulta.
2. Pedir leitura do funil e contestar a hipótese de perda/conversão. A resposta deve distinguir pessoas de procedimentos, tratar Fechamentos corretamente e pedir coorte/desfechos quando necessário.
3. Verificar fonte indisponível e clínica sem vínculo sem inventar zeros.
4. Continuar conversa após várias buscas de WhatsApp/Fathom; conferir que links e tabelas funcionam e que falhas temporárias permitem nova tentativa.
5. Conferir login próprio, prévia administrativa e rejeição de outro membro sem autorização.

As instruções e o contrato reduzem a interpretação incorreta, mas não garantem o texto de toda resposta gerada. A avaliação com o modelo e dados correntes permanece parte do aceite após deploy. Não foi criada persistência de conversa entre recargas nem chat administrativo consolidado.

Rollback: republicar os três componentes a partir da revisão anterior, preservando secrets e banco. O frontend aceita o JSON antigo; o chat novo trata indisponibilidade/intervalo não suportado sem voltar à RPC legada.
