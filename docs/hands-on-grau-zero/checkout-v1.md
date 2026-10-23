# Hands-on Grau Zero · versão de checkout

23/10/2026. Pedido de Felipe: preservar a versão com candidatura como v0; manter o endereço já impresso no QR para a versão sem formulário, com checkout Greenn e WhatsApp flutuante do Jean.

## Rotas e conteúdo

- Atual: `https://oftalmoblack.com.br/hands-on-grau-zero/`, marcador `hands-on-grau-zero-checkout-20261023`. Mesma abertura, jornada, formato, perfil e mentor; formulário substituído por cartão com CTA. FAQ de inscrição ajustado ao pagamento direto. Sem preço, turma/data ou promessa nova na LP.
- Preservada: `https://oftalmoblack.com.br/hands-on-grau-zero/v0/`, marcador `hands-on-grau-zero-v0-20261023`. Fonte da versão publicada em `4b3c620`, sem alteração posterior desta rota no remoto antes da cópia. Assets próprios, formulário e receptor preservados. HTML muda apenas canonical/og:url, marcador e noindex; cópia não depende dos assets mutáveis da versão atual.
- Fragmento antigo `#candidatura` continua apontando ao cartão principal, sem exigir alteração do QR ou de links compartilhados.

Três CTAs nativos levam a `https://payfast.greenn.com.br/200090/offer/Cl5O1F?cupom=HANDSONIMERSAO`. Produto, oferta e cupom conferidos no checkout público em 23/10. O checkout administra o vencimento do desconto; LP não reproduz preço ou contagem regressiva que possam ficar desatualizados. Não alterar Greenn ou Asaas nesta entrega.

WhatsApp de apoio: Jean `5511993436267`, contato comercial atual confirmado na frente do livro em 22/10. Botão fixo no canto inferior direito, acessível por teclado, com nome no aria-label. Frase natural: “Olá! Vim pela página do Hands-on Grau Zero e quero tirar uma dúvida com o Jean.” Sem query de origem, código ou disparo automático; registrado no catálogo antes da publicação.

## Medição

GA4 e dataset B2B preservados. PageView/ViewContent continuam Pixel + CAPI com IDs iguais. Servidor, fila e funções sem alteração. Checkout gera `hands_on_cta_click` por clique e `begin_checkout`/`InitiateCheckout` uma vez por visita, somente ao clicar; contato gera `hands_on_whatsapp_click`/`Contact`. Novos eventos de intenção são pelo navegador, sem nova emissão na CAPI dedicada. Não emitir Lead, generate_lead ou Purchase nesta versão por clique, acesso ou callback; confirmação financeira pertence ao provedor.

QA e localhost continuam sem analytics externo. Links funcionam sem JavaScript. JS conserva parâmetros de aquisição permitidos (utm_*, aid, src/sck, fbclid/gclid/gbraid/wbraid), sem inventar origem, sobrescrever cupom ou copiar query arbitrária/dados pessoais. WhatsApp recebe apenas a frase fixa. Não persistir query em localStorage.

## Validação e rollback

`node tests/hands-on-checkout.browser.cjs`, com writes externos e navegação interceptados: cinco larguras (320/360/390/768/1440), formulário ausente, três CTAs, cupom fixo, WhatsApp, FAQ, QA, aquisição bio/stories/pago, não emissão de Lead/Purchase, CAPI de visita preservada e funcionamento sem JS. v0 com formulário e assets próprios conferida separadamente. Prints de hero e página inteira revisados visualmente.

Rollback da experiência anterior: restaurar os arquivos originais de `4b3c620` na rota principal, sem mover a v0 ou tocar os emissores externos. Não reverter mudanças de outras frentes do repo.

## Correção urgente de destino,23/10/2026

A oferta anterior PVDlbA foi desativada na mudança do repasse de juros. A LP ainda apontava para ela, reproduzindo na interface a mensagem de erro da Greenn ao clicar no CTA. Corrigidos os três links para a oferta ativa Cl5O1F, cupom HANDSONIMERSAO preservado. Atualizados os contratos dos testes para impedir retorno ao destino antigo. Nenhum dado de comprador ou pagamento de teste inserido.
