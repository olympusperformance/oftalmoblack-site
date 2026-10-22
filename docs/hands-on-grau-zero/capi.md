# Hands-on Grau Zero · CAPI

22/10/2026. Backend exclusivo da página, projeto **OftalmoBlack Web** `zpyxnkuvircukjlfexrv`. Não usa o banco ou os emissores do Sistema Black.

## Caminho do cadastro

Página → `hands-on-capi` → receptor Apps Script existente → confirmação da planilha → outbox durável → Meta. O retorno ao candidato exige recibo da planilha e persistência do evento. Falha na Meta mantém a candidatura salva e agenda nova tentativa. O endpoint anterior da planilha e sua aba continuam existentes; o frontend passa pelo proxy.

Endpoint: `https://zpyxnkuvircukjlfexrv.supabase.co/functions/v1/hands-on-capi`.

Eventos: `PageView`, `ViewContent`, `Lead`, dataset B2B **919253591198015**, Graph v25.0. `Lead` público só nasce no caminho de cadastro com gravação confirmada. O endpoint de visita só permite os dois eventos de conteúdo, nunca eventos arbitrários.

## Identidade e deduplicação

Página gera um UUID por visita; candidato mantém UUID na retentativa idêntica. Pixel, CAPI e gateway existente recebem `event_id/eventID=hands-on:<UUID>:<event_name>`. O SDK real foi testado com transportes interceptados: o gateway preserva os três IDs. Não foi necessário alterar sua configuração global. O GA4 permanece pelo navegador, sem segunda emissão server-side.

Matching de CAPI usa telefone normalizado com SHA-256 somente no cadastro, IP/UA recebidos pelo servidor e `_fbp`/`_fbc` disponíveis no navegador. `_fbc` só é construído quando existe `fbclid` recebido de fato na visita. Sem IDs de clique inventados, sem nome, CRM, respostas de qualificação ou texto livre enviados à Meta. Não transforma candidatura em compra ou lead qualificado.

## Segurança e fila

Fonte em `supabase/functions/hands-on-capi/`. A função usa autorização própria: chave pública do projeto + origem permitida para formulário; segredo exclusivo para dispatcher; chave temporária separada para TEST. Por isso `verify_jwt=false` é intencional. Não colocar service role, token Meta ou chave do dispatcher no frontend.

Segredos: `HOGZ_META_TOKEN`, `HOGZ_PUBLIC_KEY`, `HOGZ_SHEET_ENDPOINT`, `HOGZ_DISPATCH_KEY`, `HOGZ_TEST_KEY`, `HOGZ_PRODUCTION_ENABLED`. `HOGZ_PUBLIC_KEY` contém somente a chave pública já usada pelo browser; é separado do alias automático da plataforma para manter a mesma chave na autorização. `HOGZ_TEST_KEY` deve ficar vazio após a homologação.

Tabelas `hogz_capi_outbox` e `hogz_capi_rate_limits`, RLS ativada e sem grants anon/authenticated. RPCs de fila restritas à service role. O cron `hogz-capi-retry` chama `hogz_capi_tick()` a cada cinco minutos; o segredo fica no Vault. A função do cron não é executável via API por anon, authenticated ou service_role. [Esquema](capi-schema.sql).

Lease de 90 segundos, claim com `SKIP LOCKED`, até dez tentativas com mesmo ID e horário, backoff limitado a seis horas; eventos com mais de 47 horas expiram em vez de reenviar fora da janela de deduplicação. Erro permanente fica bloqueado para diagnóstico. Dados de matching são removidos após aceite ou, no máximo, após 47 horas pelo cron. Metadados/recibos expiram após 90 dias. Rate limit por hash de IP/janela, sem IP bruto nessa tabela.

## Homologação e operação

TEST exige chave própria; código de teste enviado no payload externo somente para aquela linha da fila. `utm_source=qa` normal grava a candidatura mas não exporta; não equivale a autorizar TEST. Recibos técnicos persistidos separam `production`, `test` e `qa`.

Homologação de 22/10: PageView, ViewContent e Lead aceitos com `events_received=1`, HTTP 200 e zero avisos. Cadastro técnico confirmado na planilha com UTMs QA e experiência zero, seguido de remoção exclusiva da linha. Replay conserva uma linha e uma tentativa do Lead. Worker acionado pelo mesmo caminho do cron enviou dois eventos TEST pendentes, ambos aceitos. Testes locais cobrem falhas, retentativa, controle de acesso, conteúdo do payload e idempotência.

Não reenviar uma conversão com UUID novo porque houve timeout. Consultar `event_id/status/attempts/receipt`; uma tentativa incerta será reconciliada/repetida pela mesma identidade. Não usar dados de pacientes nem criar teste em produção. Atribuição comercial e qualidade de correspondência só podem ser avaliadas com candidaturas autênticas; aceite de transporte e IDs iguais não provam incremento de resultados.

Documentação: [background tasks](https://supabase.com/docs/guides/functions/background-tasks), [agendamento com Vault](https://supabase.com/docs/guides/functions/schedule-functions), [deduplicação Meta](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/).
