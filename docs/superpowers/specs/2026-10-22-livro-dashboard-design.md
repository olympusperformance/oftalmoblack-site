# Painel do livro no Admin Olympus

Pedido de Felipe: um painel único no Admin com acessos, cliques no checkout, vendas pagas e faturamento por publicação do livro. A descrição da visão foi proposta no chat e Felipe pediu sua implementação. Execução nesta sessão, respeitando o visual e a autenticação existentes.

## Experiência

Entrada exclusiva de administrador em Operação da equipe → Livro, rota `/admin/#livro`. Filtro de datas, totais das quatro métricas, ranking ordenável e CSV do resumo. Cada publicação conhecida exibe título, data e link Instagram. Outras origens e “Sem publicação identificada” permanecem visíveis. Não distribuir totais desconhecidos entre posts. Sem dados pessoais de compradores.

Reutilizar fonte InterOB, cores, componentes e temas do Admin. Tabela legível em desktop e rolagem horizontal contida no celular. Estados separados: carregando, período vazio, fonte indisponível, dados antigos e falha de autenticação. Botão Atualizar relê os últimos dados coletados, não promete realtime.

## Métricas e fontes

- Acessos = eventos GA4 `page_view` na página exata `/livro/` (também `/livro`), não a página de obrigado. São visualizações, não pessoas únicas.
- Cliques no checkout = `begin_checkout` na mesma página. Nenhuma compra inferida por esse evento.
- GA4 propriedade B2B548406121. Consulta por dia, pageLocation e eventName. Atribuição usa UTM da URL do evento, não source da sessão, para não trocar posts quando o visitante já tinha uma sessão. Somente os parâmetros UTM normalizados são persistidos; URL bruta/identificadores de visitante não são armazenados.
- Vendas pagas = vendas únicas da Greenn nos produtos199173 e199893, status paid, paid_at presente, sem refunded_at, moeda BRL. Recusadas/pendentes/reembolsadas/chargebacks não contam.
- Faturamento = soma de `amount` da API Greenn após descontos, excluindo frete/encargos adicionados em `total`. Não é lucro/líquido. Exemplo conferido: venda do produto199893 com amount1050 e total1074.
- Greenn API v1 fornece pagamentos mas não metas. Origens são associadas somente por sale_id, obtidas de CSV exportado da Greenn ou webhook autenticado, e validadas contra a venda consultada na API. Um registro já conferido no painel Greenn pode ser importado como evidência inicial. Sem correspondência, permanece sem publicação.
- `utm_content=direct-post-<mediaId>` identifica publicação, não prova anúncio pago, identidade do comentarista ou incrementalidade. Outros canais preservados como outras origens.
- Datas do relatório seguem o fuso da propriedade GA4, consultado na resposta; pagamentos convertidos para o mesmo fuso. Exibir esse fuso.

## Integração

Coletor Python no VPS existente, sem LLM e sem envio de mensagens, consulta GA4 e Greenn a cada15 minutos. Persiste snapshots separados por fonte no Supabase do Admin, sem alterar CRM, bot, Pixel, CAPI ou checkout. Nunca substitui uma coleta boa por lista vazia em caso de erro; conserva último sucesso com erro/data visíveis.

Tabelas novas: `book_dashboard_snapshots` (somente agregados e saúde da fonte), `book_sale_attributions` (sale_id + produto + UTMs/proveniência, sem comprador) e `book_publications` (metadados públicos do Instagram). RLS e grants: apenas app_admins podem consultar; importação manual de atribuições exige admin; escrita dos snapshots/publicações pelo service_role. Não confiar em user_metadata. Frontend só usa cliente público/sessão existente.

Importação CSV no Admin: localizar colunas de ID da venda e utm_source/medium/campaign/content, tolerar BOM, vírgula/ponto e vírgula e cabeçalhos usuais PT/EN. Pré-visualizar contagem e erros; só gravar depois do clique explícito Importar origens. Ignorar outras colunas, incluindo comprador; nunca subir o CSV inteiro. Sem criar vendas a partir do arquivo: somente atribuições, validadas posteriormente pelo coletor.

Webhook preparado em Edge Function dedicada, com segredo próprio não exposto ao front, somente produtos do livro e metadados allowlist. Persistência de atribuição não confirma pagamento: a API financeira confirma o estado. Repetições idempotentes por sale_id. Configuração do emissor Greenn é uma etapa independente; enquanto não validada, a interface informa importação de origens, sem afirmar conexão automática.

## Evidência inicial e limites

Reel público18141996646620907, https://www.instagram.com/reel/Dez9OTpBW1p/. Uma compra do produto199893 teve UTM direct-post correspondente conferida no painel em22/10. A importação inicial conterá somente sale_id, product_id e UTMs, sem nome ou valores copiados do registro privado; valor e status vêm da API atual. IDs de vendas reais ficam fora dos arquivos públicos/versionados.

Integração automática das metas por webhook depende do painel Greenn acessível para configurar o destino. A API v1 e autenticação atuais não autorizam a API interna de metas. Não contornar essa restrição nem usar cookies extraídos. Entregar o painel com pagamentos automáticos, atribuições comprovadas/importação e cobertura explícita, além do receptor pronto. Ausência de UTM histórica não será reconstruída por nome, horário ou cupom.

## Aceite

Testes de agregação, datas, desconto/frete, reembolso, duplicação, dois posts distintos, UTMs ausentes/malformadas, falha parcial e importação CSV. Testes de RLS para anônimo/membro/admin, sem contas novas. QA visual em temas claro/escuro e larguras390/1280, navegação real no Admin e erro/vazio. Publicar por GitHub, confirmar deploy e fontes reais no banco, sem compra/evento fictício. Não incluir fixtures em arquivos públicos nem expor segredos.
