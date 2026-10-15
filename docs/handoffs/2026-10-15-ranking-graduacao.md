# Ranking Black: prioridade da graduação

O ranking usava apenas os pontos trimestrais. Agora ordena pela graduação
cumulativa decrescente (faixa e graus) e depois pelos pontos do trimestre.
Empates nos dois critérios compartilham posição; o nome/pseudônimo apenas
estabiliza a apresentação. Admin e membro usam a mesma RPC.

A fonte do grau continua sendo o maior grau conferido em `cb_grades`, com
fallback para a graduação histórica. A escala existente já representa as
faixas: 0–6 preta, 7–8 coral, 9 vermelha e 10 dourada. Pontos, elegibilidade,
graus conferidos e participantes elegíveis não são alterados.

## Banco e publicação

Aplicar somente `20261015212703_ranking_prioridade_graduacao.sql` no projeto
Site/Admin antes do front-end. A view privada `ranking_standings` fornece a
mesma posição para leitura e referência semanal. Não concede leitura direta
a usuários; as RPCs mantêm as verificações de acesso e pseudônimos.

As referências anteriores ficam com regra `points_v1`. As novas usam
`graduation_v2`; a chave inclui a regra para preservar ambas na mesma semana.
A variação só compara a semana anterior com a mesma regra. Sem referência
compatível, a interface mostra —. Registrar novamente na mesma semana não
sobrescreve a primeira referência daquela regra.

O front-end explica a ordem e atualiza a versão do asset em Admin/Membros.
Publicação pela workflow existente de deploy ao integrar na main.

## Validação

- Postgres 17 descartável: `tests/black-ranking.sql` e `tests/black-access.sql`.
- Casos: faixas/graus acima de pontos, desempate, empate completo, ordem estável,
  histórico versus placar v2.2 inclusive zero, privacidade e permissões,
  preservação de referências antigas e idempotência das novas referências.
- 21 testes de método/graduação aprovados.
- Interface: `tests/black-browser.cjs`, com serviços simulados.

## Reversão

Reverter o texto/versão do front-end não desfaz a ordem calculada no banco.
Para restaurar a ordem anterior, substituir as duas funções usando a lógica
anterior, adaptando os conflitos e a leitura para `ranking_rule='points_v1'`.
Conservar a coluna/chave e o histórico; não apagar referências novas.

## Verificação hospedada

Migração aplicada em 15/10/2026 antes do deploy. Consulta autenticada da RPC
confirmou a ordem por graduação/pontos, sem inversões. Referências anteriores
não geraram comparação com a regra nova. Advisors de segurança sem novos
apontamentos em relação à leitura anterior à migração.
