# Painel do livro

Admin autenticado: `/admin/#livro`. Restrito a `app_admins`, inclusive no banco.

## Fontes e definições

- GA4 B2B: eventos `page_view` e `begin_checkout` somente em `/livro/` e `/livro`, por `pageLocation` do evento. Não são pessoas únicas ou compras.
- Greenn: produtos199173 e199893. Apenas `paid` com data de pagamento, sem `refunded_at`. `amount` é o valor após desconto, sem frete e antes de taxas. `total` não é usado. Deduplicação por ID; registros conflitantes invalidam a coleta, preservando o último sucesso.
- Datas: fuso da propriedade GA4. Coleta desde19/10/2026, snapshots independentes substituídos integralmente, incluindo revisão de estornos.
- Publicações: `utm_source=ig`, `utm_content=direct-post-<media_id>`. Outros canais permanecem separados. Metadados públicos vêm da Graph API, com token já mantido pelo bot B2B. Falha dessa consulta não bloqueia os números.
- A API financeira não fornece UTMs. Importar CSV da Greenn em Admin > Livro. O navegador descarta colunas pessoais e envia só ID/produto/UTMs; a coleta seguinte cruza esses IDs com pagamentos reais. Importar origem não cria venda. Registro conferido na Greenn também pode ser incluído por operador autorizado, fora do frontend.
- Webhook de origens não está ativo. O receptor `supabase/functions/book-origin-webhook` está preparado, sem deploy, com segredo dedicado de pelo menos32 caracteres (`BOOK_ORIGIN_WEBHOOK_SECRET`), via Bearer ou query `key` no destino privado da Greenn. Não compartilhar a URL com segredo. O esquema aceita `greenn_webhook` apenas pelo backend. Ativação exige configurar e testar o emissor e a autenticação do receptor; não presumir cobertura automática das vendas futuras. O receptor aceita apenas produtos do livro, limita o corpo a64 KiB e ignora dados pessoais e valores financeiros. A coleta confirma pagamento na API separadamente.

## Operação

Python3.10+ com banco de fusos do sistema (Windows: instalar `tzdata`). Somente stdlib. Copiar `collect.py` e `model.py` para `/opt/olympus-book-dashboard`. Configuração privada por EnvironmentFile root0600: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GA4_PROPERTY_ID`, `GA4_CLIENT_ID`, `GA4_CLIENT_SECRET`, `GA4_REFRESH_TOKEN`, `GREENN_PAT_FILE`. Nunca publicar esse arquivo.

Timer15min. O coletor usa um lock local e grava saúde em `/var/lib/olympus-book-dashboard/health.json`, sem compradores, URLs completas, UTMs livres ou credenciais nos logs. Não envia mensagens nem eventos de conversão e não altera Pixel/CAPI/checkout.

Falha de fonte conserva o último payload, atualiza apenas erro/horário da tentativa e aparece na interface. Dados com último sucesso há mais de45min são marcados como pendentes. GA4 pode levar24 a48h para processar eventos; horário da coleta não indica completude do dia.

## Validação

`python -m unittest discover -s scripts/livro-dashboard -p 'test_*.py'`

`node --test tests/livro-dashboard.test.cjs`

Verificar RLS como anônimo, autenticado não administrador e administrador. As tabelas de snapshots e publicações são somente leitura para o Admin. A importação só escreve origens do tipo CSV e não pode alterar o carimbo de auditoria.
