# Cérebro: links, horário, confiança e trimestres

## Problemas e comportamento esperado

- URLs HTTP(S) escritas sem Markdown passam a ser links. A pontuação da frase fica fora do destino; código continua literal, HTML é escapado e protocolos executáveis continuam bloqueados.
- A hora da consulta já chega formatada ao modelo no fuso da clínica, com data e deslocamento UTC. O modelo deve copiar esse texto, sem fazer outra conversão. Timestamp ou fuso inválido produz horário indisponível.
- O agente deve distinguir registro, hipótese e causa comprovada, inclusive em recomendações e respostas a pressão por certeza. Zero não identifica causa; emoji de clipe não comprova anexo, entrega ou leitura; testes isolados não demonstram a causa de uma lacuna histórica.
- O provedor pode combinar blocos internos e texto na resposta final. A filtragem anterior descartava a mensagem inteira, devolvendo histórico vazio. Agora o chat persiste explicitamente o par pergunta/texto final, sem blocos internos ou resultados de ferramentas, e mantém as seis últimas interações completas.
- Os módulos enviavam o trimestre como intervalo personalizado até o último dia, ainda futuro, recebendo HTTP 400. Agora enviam `preset: quarter` e a identidade `AAAA-Tn`. O servidor resolve o calendário no fuso da clínica: trimestre corrente até hoje, anterior completo e futuro como `not_started`, sem consultar contagens nem inventar zeros. A validação de intervalos personalizados permanece estrita.
- Ao restabelecer essa consulta, os módulos não podem calcular comparecimento pela divisão de etapas independentes nem usar fechamentos mistos como cirurgias. Esses dois indicadores preservam a apuração manual; quando ausente, exibem “Não medido”. Leads continuam automáticos.

## Verificação

Regressões cobrem links e escape, horário e virada de dia/fuso, contrato trimestral, preservação de métricas manuais e autorização do Farol antes de acesso privilegiado. Rodar:

```sh
npm test
npx --yes deno test --no-lock --allow-env --allow-net tests/farol-acesso.test.ts supabase/functions/farol-metricas/periodo_test.ts
npx --yes deno check --no-lock supabase/functions/farol-metricas/index.ts supabase/functions/cerebro-chat/index.ts
git diff --check
```

A homologação local usa a interface e os handlers reais, com autenticação/fontes fictícias e respostas do modelo real. Exercita indicadores, hora, URLs em tabela e abertura do destino, zero, ausência de vínculo, evidência de anexos, pressão por certeza e os três tipos de trimestre. É uma amostra comportamental; não comprova todas as respostas futuras nem publicação em produção. Nenhum dado real de mentorado integra os testes deste repositório.

## Publicação e reversão

São necessários frontend e duas Edge Functions, sem migração SQL:

1. Publicar `farol-metricas`, incluindo `periodo.ts`, antes do frontend que usa o novo contrato trimestral.
2. Publicar o frontend, conferindo `club-black.js`, `club-chat-markdown.js` e as novas versões de cache em membros/admin.
3. Publicar `cerebro-chat`, incluindo `metricas.mjs` e demais dependências existentes.

Conferir os três componentes publicados pelo commit e conteúdo, sem presumir que merge ou CI verde comprovam deploy. Repetir em produção a leitura de indicadores/horário e a troca de trimestre; avaliar as respostas do modelo com as fontes autorizadas. Não criar registros reais para simular falha.

Para reverter, restaurar o frontend anterior antes de retirar do Farol o suporte a `quarter`; restaurar o chat com seu conjunto completo de dependências. Reverter o frontend reintroduz o problema dos trimestres em andamento. A revisão desta PR não publica componentes automaticamente.
