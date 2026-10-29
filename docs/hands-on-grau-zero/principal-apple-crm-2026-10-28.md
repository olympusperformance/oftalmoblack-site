# Principal Apple e captura direta no CRM

Felipe escolheu a v2.1 como principal em28/10/2026. O fluxo aprovado é anúncio → identificação curta → sete perguntas em tela dedicada → candidatura confirmada no Supabase do Sistema Black B2B → atendimento assistido. A principal não usa planilha como etapa ou fallback. V2 e v2.1 continuam como prévias sem envio; v0 é legado separado, sem importação para a edição nova.

## Interface e recibo

Assets próprios `application-*` conservam o estilo Apple preto/dourado aprovado. Último passo envia a candidatura, bloqueia clique duplo e só confirma depois de `ok:true` e UUID correspondente. Erro conserva respostas e UUID para repetir o mesmo corpo; edição cria nova identidade de envio. Nenhuma resposta ou contato é persistido no navegador. Link de apoio do Jean preservado.

O endpoint público permanece `hands-on-capi`. Na principal, o servidor encaminha a candidatura normalizada ao receptor interno do CRM, autenticado por segredo dedicado. O CRM devolve recibo somente depois da transação que salva contexto e cadastro. O proxy não guarda uma segunda base de respostas. Falha de CRM não chama o receptor legado nem confirma sucesso. Repetições conservam request_id e `hands-on:<request_id>:Lead`.

Resposta pública: `{ok:true,request_id,tracking_mode,event_id,capture_store:"crm",crm_status:"applied"|"review"}`. Estados de revisão significam candidatura persistida com conflito de identidade a resolver, sem fusão automática. IDs internos da conta, contato, negócio e lead ficam no servidor. `qa=1` desliga marketing, mas o formulário continua ativo e grava candidatura técnica no CRM; o evento da SDR fica excluído do consumo.

## Tracking

`v21-tracking.js`, preparado na frente de atribuição, substitui `tracking.js` somente nesta página. Configura GA4 sem page_view automático, preserva UTMs/IDs recebidos e deduplica o recibo na memória/sessão. Lead exige recibo production e estado CRM aplicado/revisão. CAPI grava `capture_confirmed`, `capture_store` e `capture_status`; não declara uma planilha que não foi usada. Os recibos históricos permanecem identificados como `sheet_legacy`. PageView/ViewContent e visita CAPI conservam IDs comuns; perguntas e respostas não entram em analytics. gbraid/wbraid e fbp/fbc recebidos seguem para o registro CRM, sem fabricar valores ausentes.

## Componentes e limites

Aplicar migration de recibos antes da nova função, configurar segredo por canal privado e `HOGZ_CRM_ENABLED=true`, publicar `hands-on-capi` e somente então a principal. O CRM tem implantação própria, fora do deploy estático deste repositório. Validar HTML/assets/MIME no domínio e enviar uma candidatura QA, relendo recibo, banco e ausência de marketing/mensagens.

O backend do CRM conserva evento durável compatível com o núcleo SDR, mas seu consumidor de produção ainda não existe. A entrega desta página não ativa SDR, template, WhatsApp ou filas de mensagens. Eventos ficam retidos até a configuração/revisão dessa frente.
