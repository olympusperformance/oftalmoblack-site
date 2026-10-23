# Painel do livro

Admin autenticado: `/admin/#livro`. Restrito a `app_admins`, inclusive no banco.

## Fontes e definições

- GA4 B2B: eventos `page_view` e `begin_checkout` somente em `/livro/` e `/livro`, por `pageLocation` do evento. Não são pessoas únicas ou compras.
- Greenn: produtos199173 e199893. Apenas `paid` com data de pagamento, sem `refunded_at`. `amount` é o valor após desconto, sem frete e antes de taxas. `total` não é usado. Deduplicação por ID; registros conflitantes invalidam a coleta, preservando o último sucesso.
- Datas: fuso da propriedade GA4. Coleta desde19/10/2026, snapshots independentes substituídos integralmente, incluindo revisão de estornos.
- Publicações: `utm_source=ig`, `utm_content=direct-post-<media_id>`. Outros canais permanecem separados. Respostas aos stories usam `utm_medium=stories` e `utm_content=direct-story-<story_id>`, agrupadas separadamente do feed. O painel mostra o ID do story sem fabricar permalink após sua expiração. Se a Meta não fornecer ID válido, conserva a origem genérica `direct-story`. Metadados públicos do feed vêm da Graph API, com token já mantido pelo bot B2B. Falha dessa consulta não bloqueia os números.
- A API financeira não fornece UTMs. O webhook oficial de Venda Paga está configurado para todas as ofertas dos dois produtos e passa pelo workflow n8n já existente de origem de compras. O relay retém apenas IDs/UTMs e entrega ao receptor privado, que persiste `origins.sqlite3`. O coletor abre esse cache em `mode=ro`, cruza ID/produto com a API e sincroniza somente as quatro UTMs aceitas. Fixtures nativas sem venda financeira correspondente nunca entram no Admin.
- A sincronização usa `book_merge_webhook_origins`, RPC restrita ao service_role, com comparação/escrita atômica. Complementa campos vazios, preserva correção manual concorrente e retorna o estado efetivamente salvo; conflitos aparecem na interface. Origem salva não confirma pagamento: somente a API financeira decide os valores e estados.
- CSV no Admin é opcional para correção/histórico. O navegador descarta dados pessoais e envia só ID/produto/UTMs. Compras sem UTM continuam sem publicação identificada. O receptor alternativo `supabase/functions/book-origin-webhook` permanece sem deploy; não é necessário nem foi criado um segundo endpoint público.

## Operação

Python3.10+ com banco de fusos do sistema (Windows: instalar `tzdata`). Somente stdlib. Copiar `collect.py` e `model.py` para `/opt/olympus-book-dashboard`. Configuração privada por EnvironmentFile root0600: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GA4_PROPERTY_ID`, `GA4_CLIENT_ID`, `GA4_CLIENT_SECRET`, `GA4_REFRESH_TOKEN`, `GREENN_PAT_FILE`. Nunca publicar esse arquivo.

Timer15min. O coletor usa um lock local e grava saúde em `/var/lib/olympus-book-dashboard/health.json`, sem compradores, URLs completas, UTMs livres ou credenciais nos logs. Não envia mensagens nem eventos de conversão e não altera Pixel/CAPI/checkout.

Conexão com o receptor existente: drop-in de systemd com `BOOK_ORIGIN_CONNECTED=1` e `BOOK_ORIGIN_DB_FILE=/var/lib/olympus-livro-notify/origins.sqlite3`. A unit permite arquivos auxiliares de WAL/locks no diretório de estado compartilhado; a conexão SQLite do coletor é somente leitura. Não alterar o notificador, a outbox, os destinatários ou as credenciais do receptor. `webhook_active` registra configuração/última leitura confirmada, não comprova entrega de um pagamento futuro. O cache indisponível preserva as atribuições já salvas no Supabase e a coleta financeira continua, com origem pendente visível.

No celular, publicações aparecem em cartões com as quatro métricas, sem rolagem lateral. O retorno do login preserva especificamente `/admin/#livro` e mantém a verificação de função de administrador.

Falha de fonte conserva o último payload, atualiza apenas erro/horário da tentativa e aparece na interface. Dados com último sucesso há mais de45min são marcados como pendentes. GA4 pode levar24 a48h para processar eventos; horário da coleta não indica completude do dia.

## Validação

`python -m unittest discover -s scripts/livro-dashboard -p 'test_*.py'`

`node --test tests/livro-dashboard.test.cjs`

Verificar RLS como anônimo, autenticado não administrador e administrador. As tabelas de snapshots e publicações são somente leitura para o Admin. A importação só escreve origens do tipo CSV e não pode alterar o carimbo de auditoria.
