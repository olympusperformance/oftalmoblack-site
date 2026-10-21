# Ficha Black: perfil da clínica

Conteúdo aprovado em 21/10/2026. Página `/perfil-clinica/`, título “Vamos conhecer sua clínica”. Nome, e-mail e WhatsApp; lentes premium com volume condicional; faturamento da clínica; desafios em múltipla escolha e Outro com campo curto. Sem nomes de aplicação, promessas ou seleção. Após Felipe indicar `/workshop/v2/` como referência de melhor experiência e performance, a ficha passou a apresentar contato primeiro e uma pergunta por tela, com os componentes e DM Sans locais do workshop. Perguntas únicas avançam após seleção; desafios múltiplos exigem envio explícito. Voltar preserva respostas e cancela autoavanço; contador passa de três para quatro perguntas somente com volume habilitado.

## Componentes

- Fonte estática: `public/perfil-clinica/`. Identidade oficial Black; fonte/logo locais; sem analytics ou SDK de anúncios nesta entrega.
- Supabase Web/Admin `zpyxnkuvircukjlfexrv`, nunca o CRM: migração `20261021213439_perfil_clinica.sql` aplicada, tabela `black_perfis_clinica` com RLS e grants apenas para service_role. RPCs SECURITY INVOKER com search_path fixo e execução privada. INFO do advisor para RLS sem política é deliberado, deny-all para usuários da API.
- Edge Function `perfil-clinica` v1 ativa, JWT habilitado. Frontend usa a chave anon pública para chamar a função; ela não libera acesso direto à tabela. `Origin` aceita somente os dois hosts oficiais. Idempotência por UUID e hash canônico, validação no servidor, limite de corpo 8KB e contenção de 500 novos envios/h por hash de rede. A cota é alta para acomodar Wi-Fi compartilhado no evento.
- Planilha privada Olympus: https://docs.google.com/spreadsheets/d/1PpcJZj1tQzDwBuijdBxOGstvpIJ4pBcqJXWeUPfx1pU/edit. Pasta ChatGPT da conta Olympus. Aba Cadastros protegida; automação tem acesso por conta de serviço existente. ID técnico oculto, data numérica no horário de Brasília, cabeçalho fixo e filtros. Não ordenar/inserir/excluir linhas físicas da aba; usar visualizações de filtro. IDs diferentes em uma linha esperada geram conflito, nunca sobrescrita.
- Secrets novos da função: `PERFIL_SHEET_ID`, `PERFIL_GOOGLE_SA`, `PERFIL_SYNC_TOKEN`. Nenhum valor em código/documentação. Token de sync também no Vault, nome `perfil_sync_token`.
- Cron `black-perfil-planilha`, job 4, a cada 5 minutos. Chama a rota `?sync=1` com JWT anon e segredo específico via Vault. Cada submit também tenta o espelho em background. Erros preservam o cadastro e reagem com backoff de 5 a 60 minutos; claim expira em 2 minutos. Grade cresce automaticamente. Erros persistem no banco em `sync_error`; não há alerta comercial ou mensagem a terceiros.

## Links de uso

Stories: `/perfil-clinica/?origem=stories&utm_source=ig&utm_medium=stories&utm_campaign=perfil-black`.

Presencial: `/perfil-clinica/?origem=presencial`.

As duas origens têm o mesmo conteúdo nesta versão. A adaptação específica do presencial permanece para definição posterior. Sem parâmetro, origem direto. A origem é declaração do link, não comprovação de presença física. UTMs são limitadas e ficam no banco/planilha; contatos e respostas não vão para URLs/eventos/storage do navegador. A gravação desta ficha acontece no envio final; Continuar só abre as perguntas e não anuncia recebimento. O rascunho é mantido apenas em memória e se perde ao recarregar. O workshop e seu receptor não foram alterados por esta entrega.

## Verificações

Nove testes Node de validação/ACK/CORS/idempotência/planilha/grade passaram; teste SQL transacional com fixture revertida confirmou grants, ausência de acesso público, idempotência e preservação de múltiplas escolhas. QA de navegador em 360/390/768/1280 sem overflow ou erro JS: Sim/Não limpa volume, Outro limpa texto, ausência de endpoint, ACK incorreto, timeout, reenvio estável, edição gera novo ID, telefone internacional e bloqueio de envio duplo. Revisão independente corrigiu expansão de grade; sem outros achados acionáveis.

QA da revisão em etapas em `tests/perfil-clinica.browser.cjs`: definir `PLAYWRIGHT_MODULE` para instalação externa do Playwright, `BLACK_BROWSER_CHANNEL=msedge` em Windows e opcionalmente `PERFIL_TEST_URL`/`PERFIL_QA_DIR`. Padrão aponta ao servidor local 8773. A API é interceptada e demais serviços externos são bloqueados. Cobre três/quatro perguntas, Voltar/cancelamento do timer, múltiplas escolhas, erros/reenvio e ausência de storage/requisição parcial. Revisão independente corrigiu e-mail aceito na primeira etapa e rejeitado no final; o teste impede regressão desse ciclo silencioso.

Teste técnico real da função em 21/10: um cadastro com três desafios apareceu no Supabase e na linha 3 da planilha, `synced_at` preenchido e `sync_error` nulo. Reenvio não duplicou. Evidências privadas e remoção das fixtures são registradas no espelho local, sem dados de leads versionados.

## Operação e reversão

Consulta de saúde operacional: contagem de `black_perfis_clinica where synced_at is null`, `sync_error` e execuções do cron job 4. Se necessário, chamar sync autenticada pelo servidor. Não imprimir Vault ou credenciais em logs.

Para retirar a ficha, reverter apenas sua publicação estática e o bloco nginx. Preservar tabela, sequências, dados e planilha. Para interromper apenas o espelho: `select cron.unschedule('black-perfil-planilha');`; submits ainda tentam o sync em background até retirar a função/página. Não remover secrets ou revogar SA usada por outras integrações. Nenhuma tabela, fila, função ou cadastro do CRM foi alterado.
