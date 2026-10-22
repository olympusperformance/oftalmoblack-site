# Planilha de organização: presenças automáticas

Felipe autorizou em22/10/2026 manter automaticamente a planilha usada por Glenda conforme as pessoas marcam presença no nível1.

## Fluxo publicado

Projeto Web/Admin `zpyxnkuvircukjlfexrv`, function `black-presenca` v8. O cron autenticado existente `black-presenca-planilha` executa a cada5min. Após a sincronização da planilha técnica, reconcilia todas as presenças do evento `imersao-marketing-2026-10` com a [planilha de organização](https://docs.google.com/spreadsheets/d/1FvGfqwKBjt2R8dmsRyAebcl1cuR-wfJcmDM6Iv6w-W4/edit). Continua rodando mesmo quando não há pendências na planilha técnica. Falha do Google não impede o recebimento durável nem a confirmação do formulário; a reconciliação seguinte tenta novamente.

- `BASE`: nome na colunaB; presença do dia22/23/24 emS/T/U. Só preenche célula vazia comX; nunca escreve nas fórmulas de planejamento N/O/P, nem apaga marcações manuais.
- `Participantes Out26`: marca J comOK quando há correspondência única e célula realmente vazia. Preserva valores, fórmulas e pessoas ausentes dessa aba antiga.
- Nova aba `Presenças ao vivo` (`gid=221026001`): todos os registros, dia, nome informado, instante do recebimento em Brasília ou “Inclusão manual”, tipo de inclusão e conferência naBASE. ID técnico oculto. Carimbo de atualização e quantidade de nomes para conferir no topo. Filtros por dia e nome. Área de dados gerenciada pela integração: usar filtros, sem editar fisicamente seus registros.

Associação por igualdade normalizada de nomes ou nome do cadastro associado, e equivalências já conferidas em22/10. Sem similaridade ou inferência por primeiro nome. Gabriela abreviada usa exceção do recibo específico conferido, sem generalizar a futuros registros. Duplicidade, nome não localizado ou marcação diferente ficam visíveis para conferência; não é criada outra pessoa naBASE. Reordenação de linhas é lida de novo em cada ciclo. Não reorganizar fisicamente as abas durante o instante da sincronização; usar visualização de filtro.

Conta técnica Olympus existente `import-conversoes@olympus-dados-2026.iam.gserviceaccount.com` recebeu writer somente neste arquivo. A chave já permanece em `PERFIL_GOOGLE_SA` no Supabase; nenhuma credencial foi enviada àVPS ou colocada no navegador. Não houve compartilhamento público, mudança no CRM, graduação, notificações ou permissões da lista privada. Endpoint de sync mantém JWT e token privado; a chave de leitura distribuída à equipe não permite escrever.

## Operação

Fonte `supabase/functions/black-presenca/organizacao.mjs`. Conferir o carimbo na nova aba e HTTP200 com `organizacao.total/matched/review/marked` em `net._http_response`. HTTP503 indica falha; próximo cron reconcilia novamente. Limites explícitos: leitura paginada até5000 registros, grades até10000linhas; aba ao vivo inicial1000linhas. Se o evento ultrapassar996presenças, ampliar essa grade de forma controlada; a função falha em vez de truncar. Cabeçalhos/dias inesperados também bloqueiam escrita.

Não apagar check-ins daBASE como teste, criar presenças fictícias ou reenviar notificações para validar. Testes locais usam transportes simulados e snapshots privados; a primeira execução real reconciliou22registros,22associações,0para conferir,0mudanças desnecessárias nos check-ins já preenchidos. Nova aba preenchida e relida porID/nome/dia. Fórmulas, check-ins anteriores e dias futuros comparados antes/depois.

Treze testes Node de receptor e integração passaram: dias22/23/24, dedupe, rowreorder, aliases, nomes ambíguos, cabeçalhos, preservação de fórmulas/0/false/manual, horárioBrasília, inclusão manual e RAW contra fórmula injetada. Revisão independente corrigiu preservação de0/false no legado e espaços antes deDr./Dra. Sem achados restantes nesses arquivos. Conferência visual no Google Sheets emzoom100% com nomes, filtros e carimbo legíveis.
