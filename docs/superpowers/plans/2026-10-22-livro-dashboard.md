# Painel do livro: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** entregar a visão do livro no Admin, com GA4 e pagamentos reais por publicação e cobertura da atribuição explícita.

**Architecture:** snapshots separados de tráfego e vendas, coletor Python no VPS e tabelas Supabase protegidas por app_admins. UI estática integrada ao menu existente. Importação local de CSV fornece somente metadados de origem ausentes na API financeira.

**Tech Stack:** JavaScript sem build, CSS do Admin, Python urllib/Decimal/zoneinfo, Supabase PostgreSQL/RLS.

**Spec:** ../specs/2026-10-22-livro-dashboard-design.md

## Global Constraints

- Admin Web zpyxnkuvircukjlfexrv, nunca CRM. Produtos199173 e199893, GA4548406121.
- Só pagamentos paid sem estorno, receita amount sem frete. Zero dado pessoal no snapshot.
- Autenticação/RLS is_admin existente. Segredos só no VPS. Não alterar Pixel/CAPI/bot/checkout.
- Falha de fonte conserva último sucesso e mostra desatualização. Sem imputação de publicação.

## Review Focus

- Reembolso posterior remove contagem/receita na coleta seguinte.
- Eventos sem UTM e CSV sem colunas obrigatórias não viram atribuição falsa.
- Data de pagamento perto da meia-noite usa fuso GA4, não fuso da máquina.
- Importação parcial/duplicada é revisável e só envia campos permitidos.
- Erro de uma fonte não converte os números da outra em zero nem expõe dados ao membro/anônimo.

## Tarefas

1. **Contrato de dados e coleta.** Criar testes Python para agregação GA4, pagamentos, produtos, idempotência, frete/desconto, estornos, datas e erros; ver falhar e implementar `scripts/livro-dashboard/model.py` e `collect.py`. API financeira é fonte dos valores; atribuições apenas enriquecem origem.
2. **Persistência protegida.** Criar migração com CLI para snapshots, publicações e atribuições; grants/RLS is_admin. Adicionar testes SQL e receptor webhook validado por segredo e allowlist. Aplicar só após revisão, testar negação anon/membro e leitura admin, sem contas reais novas.
3. **Ranking e importação.** Testar funções puras de agregação/período/CSV/escape/exportação antes de criar `public/assets/club-livro-model.js`, `club-livro.js` e CSS. Integrar uma view/menu em admin.js/index, sem refatorar outros módulos. Ler snapshots e publicações com cliente autenticado, paginando atribuições de importação quando necessário.
4. **Verificação e publicação.** Rodar suíte existente (baseline162 aprovados), testes novos, QA navegador local isolado com fixtures, fonte real coletada no banco e RLS. Implantar coletor15min sem mensagens, configurar segredos só no VPS, importar uma atribuição já verificada sem comprador. Revisão independente final, corrigir achados relevantes, publicar pelo fluxo GitHub e comparar arquivos servidos, relatórios e rota. Informar separadamente que o emissor webhook Greenn ainda não foi configurado.

## Registro

- Baseline:162 testes Node aprovados. GA4 validado com API: fuso America/Manaus, eventos de page_view/begin_checkout da página do livro.
- Ruling: usar pageLocation do evento para atribuição, evitando conteúdo antigo de sessão. Persistir somente UTMs allowlist normalizadas.
- Ruling: interface de importação é necessária porque a API v1 não expõe metas e a API interna nega a credencial; não contornar acesso.
- Revisão independente de desenho: nada importante pendente.
- Tarefa1 concluída:10 testes Python, incluindo falha parcial, conservação do snapshot e paginação. Coleta real GA4/Greenn ativa no timer15min, sem dados pessoais ou mensagens.
- Tarefa2 concluída: tabelas e grants aplicados no Admin. Teste SQL em transação comprovou negação anon/membro, consulta/upsert admin e proteção de auditoria/métricas. Receptor webhook preparado e testado; sem deploy/emissor configurado, conforme limite informado na interface.
- Tarefa3 concluída: UI integrada, filtros/ranking/export/CSV. QA headless isolado passou na navegação real do Admin, temas claro/escuro, celular390px, escape de título, privacidade do CSV e indisponibilidade de fonte.
- Revisão independente final: dois achados corrigidos. UPDATE(sale_id) exigido pelo upsert: testeSQL falhou antes, passou apósgrant específico. IDs42/042 escapavam da deduplicação: testeNode falhou antes, passou apóscanonicização.
- Decisão operacional: importação CSV/origem já conferida cobre as UTMs ausentes na API financeira; webhook não será indicado como ativo antes da configuração e teste do emissor na Greenn. Risco explícito: atribuições novas ficam pendentes até importar as origens.

## Extensão autorizada: webhook e celular

Felipe pediu conectar origens automaticamente e melhorar leitura no celular. Inspeção atual encontrou webhook já configurado por outra frente para Venda Paga em todas as ofertas dos dois produtos, apontando ao workflow exclusivo de origens. Decisão: reutilizar esse receptor/cache privado, sem duplicar endpoint ou enviar dados para outro serviço.

Coletor agora lê o SQLite existente em modo somente leitura e só sincroniza IDs/produtos reconhecidos na API financeira. RPC de mesclagem compara e grava atomicamente, complementa campos vazios e preserva correção manual concorrente. CSV fica opcional para histórico. Falha do cache conserva origens persistidas e não interrompe pagamentos.

Celular: cartões por publicação com as quatro métricas sem rolagem lateral, controles de toque44px, campos16px e retorno específico `/admin/#livro` depois do login, com negação de destinos externos e proteção de função mantida.

Validação:174 testes Node,17 Python, SQL reversível de mesclagem/permissões, QA headless320/390/430px. Testes nativos da Greenn nos dois produtos retornaram200 e recibo accepted. Revisão independente encontrou corrida entre webhook e correção CSV; reprodução falhou antes, passou com RPC atômica e estado efetivamente salvo retornado ao coletor. Nenhum outro achado relevante.
