# Medição do Hands-on Grau Zero

22/10/2026. Frente educacional B2B. GA4 `548406121`, stream `G-5NMXL3LD47`, conta Google Olympus `206790279`; dataset Meta `919253591198015`, conta `act_2202969066909090`, BM `464414978221518`. Não usar os ativos da clínica B2C. Após a configuração inicial do navegador, Felipe autorizou também CAPI e homologação completa: [backend, fila e operação](capi.md).

## Funil publicado

| Marco | GA4 | Meta |
|---|---|---|
| Visita | `page_view` | `PageView` e `ViewContent` |
| Clique para candidatura | `hands_on_cta_click`, `cta_location=hero/faq` | Sem conversão |
| Primeira edição do formulário | `hands_on_form_start`, uma vez por página | Sem conversão |
| Identificação validada e avanço | `hands_on_step_complete`, `form_step=1`, uma vez | Sem conversão |
| Envio válido iniciado | `hands_on_submit_attempt`, `form_step=2` | Sem conversão |
| Falha do envio | `hands_on_form_error`, tipo `http/network/timeout/unconfirmed` | Sem conversão |
| Candidatura salva, recibo confirmado | `generate_lead`, uma vez por recibo | `Lead`, uma vez por recibo |

`generate_lead` já era evento principal, com contagem por evento. Preservado sem criar uma segunda conversão GA4 para o mesmo cadastro. Todos os eventos manuais têm `produto=hands_on_grau_zero` e `form_id=candidatura-form`. Dimensões de evento registradas: `produto`, `form_step`, `cta_location`, `error_type`. A medição automática de formulários do stream continua igual nas outras páginas; `form_submit` automático não é candidatura confirmada nem substitui `generate_lead`.

Conversão personalizada Meta `29450668684544832`, **Hands-on Grau Zero · Candidatura recebida**. Regra: evento `Lead` E URL contendo `/hands-on-grau-zero/`. Preserva o evento padrão; não cria novo evento Meta que precise de confirmação manual. Conferir disponibilidade/recepção antes de selecionar em uma campanha. Criação da regra não comprova tráfego, atribuição ou primeira candidatura.

## Dados, atribuição e duplicidade

Sem nome, telefone, CRM, respostas de qualificação ou texto livre nos eventos. O Pixel recebe eventos manuais, com `autoConfig=false` antes do init. O GA4 recebe URL de aquisição com parâmetros reconhecidos, sem query arbitrária, hash ou query do referrer.

UTMs/aid/fbclid/gclid da visita continuam no payload do receptor e na planilha, somente ao concluir. Memória limitada à página atual; reload conserva a query, visita direta nova não herda campanha antiga. Links internos não criam UTMs. Links de bio e stories existentes permanecem válidos. O receptor não foi alterado.

O `Lead` do Pixel e da CAPI usa `eventID/event_id=hands-on:<request_id>:Lead`. PageView e ViewContent compartilham o UUID de visita entre os canais. O sinal de sucesso exige `ok=true` e eco do UUID após gravação e persistência da outbox. Erros, recibo divergente e repetição não geram novo Lead; o formulário mantém a mesma identidade na retentativa idêntica. GA4 continua emitido somente pelo navegador.

## QA e recepção

Localhost, `utm_source=qa` (sem diferença de maiúsculas) e `qa=1` suprimem analytics e carregamento dos SDKs. QA de formulário intercepta transporte e gravação; nunca usar uma candidatura fictícia para inflar conversão de produção. Essa supressão não impede o envio à planilha, portanto testes automatizados devem manter o receptor interceptado.

Testes cobrem bio, stories, pago, três formas de QA, avanço/volta, falhas HTTP/rede/recibo, retentativa e recibo repetido. Sucesso do teste isolado comprova lógica e payload; conferir em separado requests reais, resposta das plataformas e dados processados. Sem campanha nova ou alteração de verba nesta entrega.

Documentação: [eventos recomendados GA4](https://developers.google.com/analytics/devguides/collection/ga4/reference/events), [dimensões personalizadas](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.customDimensions/create).
