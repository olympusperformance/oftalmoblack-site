# Tracking da ficha Perfil Black

Pedido aprovado em 22/10/2026: medir interessados que ainda não são Black. A confirmação de presença dos membros fica fora da medição de marketing.

## Escopo e ativos

- Nível 0 `/perfil-clinica/` e nível 2 `/perfil-clinica/nivel-2/`: GA4 B2B `G-5NMXL3LD47`, propriedade `548406121`, stream `15380224361`; Pixel B2B `919253591198015`, BM `464414978221518`, conta `act_2202969066909090`.
- Nível 1 `/perfil-clinica/nivel-1/`: não carrega SDKs. Membro confirma somente presença; não membro segue ao nível 0, onde começa a medição.
- Fonte canônica `scripts/perfil-tracking-inline.js`, idêntica nos dois HTMLs. O teste de tracking detecta divergência.
- Sem mudanças nos receptores, tabelas, planilha, presença diária ou campanhas.

## Eventos e conversão

GA4: `page_view`, `perfil_black_form_start` uma vez na primeira interação, `perfil_black_contact_complete` após validar contatos, `perfil_black_submit_attempt`, `perfil_black_form_error` (`timeout` ou `unconfirmed`) e `generate_lead` após HTTP 2xx + ACK `ok:true` + UUID igual ao envio pendente.

Parâmetros comuns: `produto=perfil_clinica_black`, `form_id=perfil-form`, `origem=presencial|stories|direto`. Caminho e UTMs distinguem variantes/canais. Reutilizado o evento principal `generate_lead` e dimensões de evento já existentes. Medição otimizada automática do stream preservada; eventual `form_submit` automático não é cadastro confirmado.

Meta: `PageView`, `ViewContent` e `Lead`. Lead só depois do ACK validado, uma vez por recibo na página, `eventID=perfil-black:<submission_id>:Lead`. Sem CAPI nesta entrega. Conversão personalizada **Perfil Black · Cadastro recebido**, ID `2765036887248656`, criada e relida: evento `Lead` e URL contém `/perfil-clinica/`. Não há Lead na presença dos membros. Objeto disponível na API não comprova atribuição em campanha nem o primeiro cadastro autêntico.

## Privacidade e isolamento

Nenhum nome, e-mail, telefone, faturamento, volume ou resposta é colocado nos eventos. `autoConfig=false` e opt-out local de `AutomaticMatching`, `AutomaticMatchingForPartnerIntegrations`, `AutomaticMatchingRegex` e `AutomaticMatchingAI` antes do init; configuração global do dataset preservada. Opt-outs confirmados também após configuração remota do SDK real.

Antes dos SDKs, URL permite apenas origem, UTMs válidos e identificadores de clique; remove query arbitrária e hash. Referência reduzida à origem também em `document.referrer`, pois o Pixel a lê. Falha nessa proteção suprime o tracker e mantém a ficha utilizável. Sem persistência de contatos pelo tracker.

Execução somente nos dois caminhos exatos, em HTTPS no domínio público. `?qa=1` (nome da flag sem distinção de caixa), `utm_source=qa`, localhost e demais rotas não inicializam tracking. QA não deve fabricar conversões na produção.

## Verificações antes da publicação

- Teste `perfil-clinica.tracking.cjs`: SDK/receptor interceptados, ACK incorreto, HTTP500, timeout, retry do mesmo UUID, Lead único, ausência de campos nos eventos, guards QA/local e SHA do nível 1 preservado.
- `perfil-clinica.transport.cjs`: SDKs oficiais reais e configuração remota carregados com HTTP200; todos os transportes de analytics abortados. Contatos canário e referência com query não apareceram em texto nem hashes nos eventos; `userData` vazio e quatro opt-outs ativos. PageView/ViewContent/Lead e GA4 `generate_lead` produzidos pelo SDK, sem serem entregues às plataformas durante esse teste.
- `perfil-clinica.browser.cjs` nos níveis 0 e 2: quatro larguras, validação, múltiplas escolhas, volume/Outro, falhas, retry e confirmação. `black-presenca.browser.cjs`: nome/data e isolamento preservados, sem SDKs ou chamadas externas inesperadas.
- Revisão independente de código sem achados pendentes.

Execução: apontar `PLAYWRIGHT_MODULE` para Playwright instalado e `BLACK_BROWSER_CHANNEL` quando necessário. Teste de transporte precisa de rede para os SDKs e aborta eventos por definição.

## Operação

Os links de bio/stories e o QR da TV continuam os mesmos. Conferir recepção HTTP real de visita após deploy, hashes dos dois HTMLs e SHA do nível 1 `936e5fa6f3b5d2f34649a0ac1b551b9d24a897feb915ad74fb4f52e8b7215a53`. Validar primeira conversão autêntica quando ocorrer; não gerar cadastro fictício para fazê-la aparecer. O procedimento de confirmação de eventos personalizados do BM continua aplicável; aqui foram usados eventos padrão do Meta, sem novo nome personalizado.

## Publicação comprovada

Head `be216f20dde761cce81c3bc80086aa5c55180d0c`, Action `39773090085` concluída. As duas fichas vivas ficaram idênticas à fonte; nível 1 manteve o SHA anterior. Visitas reais das duas fichas tiveram GA4 HTTP204 e Pixel PageView/ViewContent HTTP200. Nível 1 visitado e formulário de nome aberto sem SDK ou evento de marketing. Nenhum Lead de QA foi entregue. Config pública do Pixel: unverifiedEventNames/restrictedEventNames vazios; isso não substitui eventual análise manual no Gerenciador. Primeira conversão autêntica e atribuição continuam dependentes do uso real.
