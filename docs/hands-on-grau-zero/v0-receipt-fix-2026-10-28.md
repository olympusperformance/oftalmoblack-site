# Recibo da candidatura preservada em v0

28/10/2026. A versão `/hands-on-grau-zero/v0/` envia a própria URL no campo `page`. A CAPI publicada aceitava somente a principal e devolvia `400 invalid_page` antes da gravação. A consulta ao código da função ativa, versão10 da plataforma, confirmou igualdade com `origin/main` anterior a esta correção. O número6 no registro de22/10 era uma versão histórica da implantação.

A validação agora aceita explicitamente principal e v0, com ou sem `index.html`, nos dois hosts HTTPS existentes. Não aceita subcaminhos, query no campo `page`, HTTP ou host semelhante. Não muda a LP, os assets congelados, a planilha, a fila, os IDs, o payload da Meta nem a jornada de checkout.

## Verificação executada

- Antes da correção: teste de recibo v0 falhou com `400 invalid_page`; os demais13 passaram.
- Depois:14/14 testes de backend, incluindo recibo único, replay, QA e rejeição de rotas indevidas.
- `node tests/hands-on-v0-receipt.browser.cjs`: formulário real da v0 → handler real → recibo confirmado. Planilha e fila em memória; zero gravações externas e zero requests de analytics. Candidato sem cirurgia e sem clínica própria aceito, conforme o contrato existente.
- `node tests/hands-on-checkout.browser.cjs`:11 cenários aprovados, com navegação e transportes externos interceptados; cinco larguras, QA, UTMs, ausência de Lead/Purchase por clique e preservação da v0.
- `npm test`:322 testes aprovados. Warning experimental preexistente do Node em `stripTypeScriptTypes`; nenhuma falha.

## Publicação e aceite

Código preparado para revisão. Merge ou deploy do site não publica esta Edge Function. Após aprovação, publicar **somente** `hands-on-capi` no projeto `zpyxnkuvircukjlfexrv`, mantendo segredos e `verify_jwt=false`. Não há migração ou alteração de frontend.

Confirmar nova versão e comparar `core.mjs` publicado com a fonte aprovada. Reexecutar localmente os testes acima contra o código publicado. Não submeter formulário fictício à planilha de produção nem enviar Lead real como teste. A homologação com Meta TEST e armazenamento externo exige seu procedimento próprio; não é necessária para provar esta mudança de allowlist.

Rollback: republicar a versão anterior exclusivamente da função. O rollback restabelece a falha da v0; não reverter arquivos de outras frentes.

Esta correção não implementa integração com o CRM, SDR, pagamento ou Purchase. Esses marcos têm contrato separado na auditoria da campanha de novembro.
