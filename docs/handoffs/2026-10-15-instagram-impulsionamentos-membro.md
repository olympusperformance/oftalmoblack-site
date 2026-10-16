# Impulsionamentos dentro de Instagram, também para membros

Após conferir o áudio enviado, Ítalo pediu manter a tabela dentro de Instagram
e garantir a visualização pelo próprio membro e pela pré-visualização do admin.

A seção Campanha de Branding agora fica abaixo das métricas de Instagram nos
dois painéis. A aba separada foi removida. Permanecem os indicadores, filtros,
mensagem de ausência/acesso Meta e isolamento por membro implementados antes.
Não houve alteração no banco, nas permissões ou na coleta.

“Ver como membro” na aba Instagram usa o mentorado selecionado na campanha e
abre o Instagram dele. O retorno ao painel mantém mentorado e Instagram.
Links antigos #branding redirecionam para Instagram, inclusive no carregamento
inicial. Os assets dos dois HTMLs receberam nova versão de cache.

Validação: quatro testes de dados aprovados; suíte Playwright de Admin/Membro,
com tabela dentro de Instagram, ausência da aba separada, alias antigo,
pré-visualização real do segundo membro e retorno ao admin, desktop/mobile.
Publicação pelo deploy existente após PR. Reversão: reverter o commit de
interface, sem alterar dados.
