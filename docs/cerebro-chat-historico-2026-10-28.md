# Cérebro: retomada da conversa com retenção limitada

## Comportamento

Recarregar a página, fechar a aba ou sair e entrar novamente na mesma conta agora restaura a conversa neste navegador. A próxima pergunta envia o histórico restaurado para `cerebro-chat`; não é apenas a reapresentação das bolhas.

O armazenamento é separado pela combinação de usuário autenticado e mentorado. Um administrador que abre outro mentorado recebe outro contexto. A identidade só é resolvida após autenticação e carregamento do mentorado. Trocar de conta invalida respostas em andamento e o cliente recusa enviar o histórico com a sessão de outro usuário. A autorização do servidor permanece vigente.

| Limite | Regra |
|---|---|
| Histórico da conversa | Até 6 pares completos, pergunta + resposta final |
| Texto do histórico | Até 32.000 caracteres JavaScript, removendo os pares mais antigos por inteiro |
| Inatividade | Expira após 24 horas sem pergunta ou resposta concluída |
| Idade absoluta | Expira em 7 dias desde o início, mesmo com uso contínuo |
| Pergunta pendente | Uma, até 600 caracteres; nunca reenviada automaticamente |
| Cache do navegador | Até 3 combinações conta/mentorado e 120.000 caracteres serializados, aproximadamente 240 KB em UTF-16 |
| Reset manual | Botão **Nova conversa**, disponível quando não há resposta em andamento |

Apenas abrir, recarregar ou focar a aba não renova a validade. O vencimento é verificado ao abrir, retomar, enviar ou receber uma resposta. Dados vencidos são removidos no próximo acesso ao cache; não existe processo de limpeza enquanto o navegador está fechado. Limpar os dados do site, trocar de navegador/dispositivo ou exceder o limite global pode descartar a retomada antes do prazo.

Os 32 mil caracteres limitam o histórico retido e reenviado, não o prompt completo do modelo nem os resultados das ferramentas. Não há resumo automático de mensagens antigas. A aplicação já limitava o backend aos últimos seis pares; a nova regra adiciona o teto de caracteres no cliente.

## Erros, cache e abas

- Uma pergunta interrompida continua visível após recarga, com **Tentar novamente**. O histórico anterior continua intacto; a mensagem de erro e os blocos internos de ferramenta não entram na memória.
- O reenvio substitui a tentativa pendente ao concluir, sem duplicar a pergunta. Uma nova pergunta pode substituir a pendência.
- Identificador de conversa, revisão e geração da tela descartam resultados atrasados após reset, mudança de conta ou atualização observada em outra aba. Alterações de outro mentorado não interrompem a resposta atual.
- O controle entre abas é otimista, não um sistema transacional de edição simultânea. Duas gravações exatamente concorrentes ainda podem escolher a última; não prometer mesclagem de conversas.
- JSON inválido é descartado. Se o navegador bloquear o armazenamento ou faltar espaço, o chat continua em memória e avisa que não poderá retomar após sair. Uma falha de gravação tenta remover o snapshot antigo para evitar restaurá-lo depois.
- `localStorage` não é armazenamento criptografado nem sincronizado no servidor. A separação por identidade impede mistura pela interface, mas não protege contra alguém com acesso ao perfil do navegador/DevTools. Não são armazenadas credenciais, tokens ou erros brutos por este módulo.

## Implementação e publicação

Frontend somente: `club-chat-session.js`, `membros.js`, `club-data.js`, `club.css`, `membros/index.html` e versão de `club-data.js` em `admin/index.html`. O chat da equipe abre a mesma área de membro com alvo explícito. Cache versionado como `20261028-chat-history`.

Não há migração SQL nem alteração/deploy de `cerebro-chat` ou `farol-metricas`. A base é o merge da PR 45, `3f99f5143ef400eae4137b217b0b58ff859a5dae`. Esta entrega prepara revisão; não autoriza merge/publicação. O workflow existente publica o frontend quando houver push em `main`.

Após publicação autorizada, conferir conteúdo e versão dos seis arquivos em `oftalmoblack.com.br`, não apenas merge/CI verde. Repetir o roteiro abaixo no navegador com dados fictícios. Rollback: reverter o commit de frontend e publicar novamente; o código anterior ignora a chave `club:cerebro:sessions:v1`.

## Validação

`npm test`: **363 aprovados, zero falhas**. Testes automatizados cobrem restauração, separação de contas/mentorados, limite de pares/caracteres/cache global, 24h de inatividade, 7 dias absolutos, reset, cache corrompido/quota, rejeição de blocos internos, resultado atrasado, conflito entre abas, preservação da pergunta pendente e impedimento de envio sob outra identidade. `git diff --check` sem erros.

Homologação pela UI do Chrome com os arquivos reais da branch, handler real de chat e modelo real. Autenticação, banco e métricas substituídos por dados fictícios locais, sem mensagens a terceiros ou registros de produção:

1. Conversa fictícia Projeto Horizonte, com 90 leads, 18 agendamentos, 3 fechamentos e horário 10:25 America/Manaus.
2. Recarregar e perguntar pelos fatos anteriores sem repeti-los: contexto recuperado.
3. Fechar e reabrir a aba: perguntas e respostas restauradas.
4. Sair/entrar na mesma conta: histórico restaurado; entrar na segunda conta: chat vazio; voltar à primeira: histórico presente.
5. Falha de conexão, recarga e clique em Tentar novamente: pergunta pendente preservada; modelo recuperou nome, números e horário sem duplicação.
6. Nova conversa e recarga: chat vazio; próxima requisição sem histórico anterior.
7. Avançar o relógio somente da homologação em 25h: chat vazio com aviso de expiração.

Os testes de autenticação acima verificam o comportamento do cliente com identidades fictícias, não substituem um reteste do login Supabase em produção. Os limites de 6 pares, 32 mil caracteres, 3 caches e 7 dias são verificados por testes automatizados; a UI exercita o vencimento por inatividade.
