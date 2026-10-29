# Retorno da aplicação à página principal

Decisão de Felipe em28/10/2026: remover o checkout direto da LP e voltar à aplicação. O teste de compra direta na Imersão não funcionou, segundo ele; o público frio deve passar pelo atendimento comercial. Preparar a página primeiro e conectar o cadastro ao Sistema Black B2B na etapa seguinte.

## Alteração

Principal `/hands-on-grau-zero/`: os dois CTAs levam a `#candidatura`; cartão de checkout substituído pelo formulário existente em duas etapas. Hero/copy atuais preservados. FAQ orienta aplicação e contato da equipe, com aviso de que candidatura não confirma vaga. Checkout e cupom não aparecem na principal. Apoio do Jean mantém destino e frase atuais.

Reutilizados formulário, validação, script de envio e receptor `hands-on-capi` existentes. Mantidos os campos, inclusive a aceitação de quem não opera, zero cirurgias/mês e ausência de clínica própria. Nenhuma condição comercial nova foi inferida.

Tracking principal volta aos marcos de aplicação: início, avanço, tentativa, falha e Lead/generate_lead somente após recibo confirmado. Mesmo request_id em retry idêntico e mesmos IDs Pixel/CAPI do cadastro. PageView/ViewContent e clique de apoio WhatsApp preservados. Nenhum InitiateCheckout ou Purchase na aplicação. Assets da v0 não mudam.

## Limite de integração

O recibo atual confirma gravação da candidatura na planilha. Não confirma ficha ou negócio no Sistema Black. A conexão ao CRM deve consumir essa captura com request_id, identidade, produto/edição e atribuição pelo contrato comercial privado da Olympus. Esta alteração não ativa atendimento nem filas.

## Verificação

`tests/hands-on-application.browser.cjs` substitui o contrato de navegação da versão de checkout. Exercita página real, formulário e tracking, com transportes externos interceptados: cinco larguras, validação, volta/avanço, candidato sem experiência, falhas HTTP/rede/recibo, retry com mesma identidade, clique duplo, aquisição, Lead confirmado/deduplicado, ausência de compra/checkout, apoio WhatsApp, QA e v0. Não grava candidatura nem eventos de produção.

Rodar: `HOGZ_QA_OUT=<pasta privada> node tests/hands-on-application.browser.cjs`. Playwright pode ser apontado por `PLAYWRIGHT_MODULE`. Também rodar `npm test`, a suíte Node do repositório. Resultado efetivo e capturas são registrados no handoff privado, sem dados de leads neste repositório público.

Publicação exige conferir HTML/assets servidos e uma captura técnica controlada com a confirmação do receptor. Não apresentar testes interceptados como prova de gravação real ou integração ao CRM. Rollback somente destes arquivos, preservando trabalho simultâneo.
