# Lista e avisos de presença da Imersão

Felipe pediu em 22/10/2026 uma lista visual para compartilhar com Glenda e uma notificação por participante para o atendimento terminado em 9750 e para ele próprio. Confirmou explicitamente incluir também todas as presenças já registradas.

## Lista da equipe

Rota `/imersaograuzero/presencas/`, identidade visual Black, nomes e horário de Brasília, seleção entre 22, 23 e 24/10, busca, total do dia, impressão e Copiar link. Atualiza a cada 30s e ao retomar a aba. Contagem do dia não muda ao buscar um nome. Falha de rede mantém a última consulta e informa que está desatualizada; revogação apaga os nomes da tela.

O HTML público não contém nomes. Dados privados exigem chave aleatória de 288 bits no fragmento `#acesso=...`, que não é enviado no pedido inicial da página. A chave só vai ao endpoint específico em header HTTPS. Não há persistência em storage nem tracking. Link é uma permissão de leitura: compartilhar somente com a equipe. Não consta neste repositório, nem em configuração pública.

Function `black-presencas-lista`, projeto Web/Admin `zpyxnkuvircukjlfexrv`, autenticação própria antes da leitura, hash da chave em secret `BLACK_PRESENCA_LISTA_HASH`. Sem JWT de login porque o handler autentica a permissão de leitura; chave inválida retorna401, origem inesperada403, falha de consulta503. DTO somente id da presença, nome informado, dia e instante do registro, filtrado ao evento `imersao-marketing-2026-10` e dias22-24. Sem e-mail, telefone, cadastro de membro ou respostas da ficha comercial. Leitura paginada para não truncar no limite do PostgREST. RLS/grants e presença original preservados; nenhuma migração de banco.

A identificação continua sendo nome autodeclarado, com associação ao cadastro somente quando inequívoca. A lista não comprova identidade nem acrescenta graduação. Sem classificação automática de ausentes.

## Avisos pela Evolution

Fonte `operacao/presencas/`. Serviço externo ao CRM na VPS que já hospeda a Evolution pessoal, `159.89.232.213`; não instala webhook nem altera instâncias. Emissor `felipe-tester`, proprietário Felipe conferido por API. Destinos fixos e conferidos: atendimento9750 (`140815603118310@lid`, número correspondente `559285909750`) e conversa do próprio Felipe (`559281381810`). Não envia a mentorados, grupos ou Glenda.

Mensagem: “Presença registrada · Imersão Black”, nome informado, dia e horário de Brasília, com nota de confirmação pelo participante. Sem contatos, respostas ou código interno. Cada registro de presença gera dois avisos. Dedupe original por pessoa/dia permanece no banco; controle de envio adicional por id da presença/destino no SQLite privado.

Consulta a mesma API restrita da lista, com a mesma permissão limitada de leitura. Não leva service_role do Supabase para a VPS. Config `/etc/olympus-presencas/config.json` e estado `/var/lib/olympus-presencas/notificacoes.sqlite`, acesso600 em diretórios700. Credencial Evolution é lida do arquivo privado já existente, sem modificar `.env`.

Reserva tentativa no SQLite antes do POST. ACK com ID é salvo e relido em `chat/findMessages`, conferindo autoria, destino e texto. Timeout ou resposta incerta nunca provoca reenvio cego: busca o recibo por ID ou texto exato/destino. Resultado ausente permanece para conferência. Lotes separados de novos envios e reconciliação, com rodízio de última consulta, impedem que um recibo pendente bloqueie os demais. Não apagar o SQLite para “reiniciar”, pois isso repetiria avisos.

Timer a cada30s apenas em22-24/10, horário de Brasília, e guarda de encerramento no worker após25/10 00h de Brasília. Serviço oneshot impede sobreposição do timer; reserva condicional também protege concorrência. Falha usa aviso operacional já existente, limitado a um por hora, sem reviver rotinas antigas do Hermes. O resumo de estados não comprova leitura humana do WhatsApp.

Operação: `systemctl status olympus-presencas.timer`, `journalctl -u olympus-presencas.service`, consulta local somente leitura ao SQLite. Para pausar: `systemctl disable --now olympus-presencas.timer`. Para invalidar o link, substituir/remover `BLACK_PRESENCA_LISTA_HASH` e atualizar a configuração privada do worker com o novo acesso antes de retomar.

## Validação

Quatro testes Node para autenticação/DTO/CORS/falhas e paginação1200; quatro testes Python sem envios reais para backfill/dedupe, timeout com entrega e sem recibo, fila presa e rodízio; navegador em360/390/768/1280 para acesso, dia, busca, XSS, erro, revogação e ausência de storage. Verificar publicação por hash, consulta autenticada real e recibos dos dois destinos antes de declarar conclusão.

## Operação comprovada em 22/10 às 11h33, horário de Brasília

Function de consulta v2 ativa, chave ausente401 e consulta autorizada200,12 presenças. HTML/JS vivos idênticos à fonte, SHA HTML `091cff0b9479533effdbdc8f156374e4d6c7d5afabc64a3f49842f16945d83b9`, JS `65964f472efe612847b4d9a2df646e6e20b5da6df7bf69b3a8ffe36ee5388de9`. Navegador público390/1280:12 nomes, busca/dia, cópia do link, impressão com dia, sem tracking/overflow/erros. Link sem chave não retorna nomes. Fonte web `aff50e0` + impressão `ae5ef33`, worker `8467a9d` + correção Python3.10 `ad49f8b`. Actions estavam enfileiradas na consulta; publicação comprovada por conteúdo/headers reais, sem atribuir sucesso ao status da fila.

Timer enabled/active,30s, guarda final25/10. Backfill terminou às11h31, horário de Brasília:24 mensagens,12 por destino,24 IDs distintos, todas relidas pela API com autoria/destino/texto conferidos. Novo ciclo manteve24 verificadas e nenhuma pendente, sem repetir mensagens. Aceitação/releitura não prova leitura humana. Worker vivo idêntico à fonte, SHA `d01a3ceca3e1c300d1c31fbb6eacc13cf99e63fd4fe7c72270cdd5b988cb4bd1`.

A ativação encontrou precisão fracionária de cinco dígitos no timestamp do PostgreSQL, incompatível com fromisoformat do Python3.10. Corrigida por parser com %f e teste de regressão. Os ciclos anteriores falharam antes de registrar/enviar mensagens; após a correção, todos os avisos foram conferidos. Revisão independente corrigiu paginação e rodízio da reconciliação antes da ativação. Sem fixtures de presença em produção. Nenhum envio à Glenda foi feito: o link foi preparado para Felipe compartilhar.
