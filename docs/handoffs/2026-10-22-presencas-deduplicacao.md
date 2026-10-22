# Presenças: inclusão manual e confirmação com nome completo

Correção autorizada por Felipe em22/10/2026: a mesma pessoa constava como inclusão manual abreviada, vinculada ao cadastro, e como confirmação com nome completo sem vínculo. A chave diária era diferente (`member:` versus `nome:`). Igualdade normalizada de nomes não reconhecia essa equivalência.

## Estado publicado

Migration `20261022174529_black_presenca_aliases_confirmados` aplicada ao projeto Web/Admin `zpyxnkuvircukjlfexrv`. Não exige deploy de Edge Function nem mudança de HTML. `black_presenca_receber_v2` conserva contrato, locks, recibos e unicidade pessoa/evento/dia; resolução do nome usa helper `black_presenca_resolver_membro(evento,nome)`.

Tabela `black_presenca_nome_aliases` guarda apenas equivalências exatas conferidas pela operação, restritas ao evento. A união entre nomes ativos do cadastro e aliases só associa quando existe um único candidato. Colisão, nome parecido, nome desconhecido e alias de outro evento não forçam associação. Não existe deduplicação por primeiro nome, substring ou similaridade. Novas variantes precisam de confirmação antes de cadastrar equivalência.

As duas tabelas novas têm RLS, sem acesso `anon`/`authenticated`; helper invoker com search_path vazio, EXECUTE só service_role. Advisor da mudança retornou somente INFO de RLS sem políticas, esperado para tabelas restritas ao serviço. Avisos preexistentes de outras frentes não foram alterados.

## Consolidação deste caso

Preservado o ID, dia, instante e origem da inclusão manual. Nome exibido atualizado ao nome completo informado pelo participante. Os dois recibos apontam à mesma presença; retry da confirmação original continua válido. Snapshot privado em `black_presenca_mesclagens` conserva as duas linhas anteriores e recibos para recuperação. Nenhum cadastro de membro foi alterado.

Reparo transacional bloqueou claims e exigiu as duas linhas já sincronizadas, com leases nulos. Não apagou lease de trabalho em voo. Linha redundante removida somente após arquivamento e redirecionamento dos recibos. A linha técnica da duplicata foi relida por ID, salva em backup privado e teve somente seus valores A:P limpos, sem deslocar linhas ou alterar formatos/fórmulas/validação de outras células.

Sincronização autenticada existente executada após a consolidação: HTTP200, synced1/pending0, organização22/matched22/review0/marked0. Aba Presenças ao vivo recomposta automaticamente, sem alterar check-ins já existentes daBASE ou dias futuros. Lista privada e planilha mostram uma única linha do participante, total22 no dia22/10. O serviço de avisos continua deduplicando pelo ID original; não foi gerado novo participante ou disparo de teste. Avisos históricos não foram apagados ou reenviados.

## Evidências e regressão

Antes da correção, teste transacional do caso real falhou: nome completo resolvia para a segunda presença. Após o reparo, mesmo teste exige o ID da inclusão original e passa; ambos com ROLLBACK, sem presença fictícia durável.

`tests/black-presenca-aliases.sql` cobre equivalência exata, múltiplos recibos, outro evento, nome diferente, colisão entre membros e novo dia. Executado junto a `black-presenca-diaria.sql` em transação ROLLBACK. Testes Node de receptor/lista/organização:17 aprovados. Revisão independente corrigiu o guard de sincronização antes da aplicação e não encontrou outros bloqueios. Consulta posterior:2 recibos preservados,1 snapshot, presença sincronizada sem erro. Conferência visual da lista e aba ao vivo realizada.

Brutos nominais, SQL de reparo e imagens ficam em `_qa/dedupe-2026-10-22/`, ignorado no hub privado; nenhum token, link reservado ou payload pessoal foi levado ao repositório publicável.
