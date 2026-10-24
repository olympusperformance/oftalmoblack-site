# Instalação na tela inicial do Android

Ítalo pediu que Club e Sistema Black possam ser instalados como aplicativos no Android e informou que o caso de atalho ocorre no Chrome. Escopo: frontend, manifesto, ícones e resposta de navegação sem conexão.

## Diagnóstico

Chrome com perfil temporário persistente e emulação Pixel 7: o Club em produção retorna `no-manifest`; o Sistema retorna zero erros de instalação, com manifesto e ícones PNG 192/512 válidos. Ambos estavam sem service worker. A ausência do worker não é apresentada como causa universal: Chrome moderno já permite instalação pelo menu sem ele.

## Implementação

Manifesto com identidade estável, escopo `/` e modo `standalone`. Club abre `/entrar/`, que já encaminha o usuário autenticado ao painel correto. Sistema mantém o `start_url` `/` e identidade implícita anterior, agora explícita em `id`; o nome de instalação é Sistema Black. Domínios são instalações independentes.

Worker registrado depois do carregamento, com `updateViaCache: none`. Somente navegações GET da mesma origem usam a rede e, na falha de transporte, recebem uma tela genérica com tentativa novamente. No Club, isso fica limitado à raiz e às rotas de entrada, membros, admin e recuperação. Não há Cache Storage, interceptação de APIs ou cache de sessões/dados autenticados. HTTP 4xx/5xx do servidor permanece intacto. Manifesto e scripts sempre revalidam no nginx, sem fallback da SPA para arquivos ausentes.

## Validação

- Cinco testes Node em cada repositório: manifesto/ícones, preservação da requisição e HTTP 403, fallback sem reflexão de token, exclusão de APIs/assets/POST/origens externas, registro sem cache do worker.
- Build de produção do Sistema concluído; avisos prévios de tamanho de chunks e base Browserslist antiga.
- Chrome local com perfil persistente e emulação Pixel 7: zero erros de instalação nos dois, worker controlando a página, tela offline, botão de retorno com rede e Cache Storage vazio.
- Revisão do bloco nginx concluída. O teste com nginx:alpine não executou: o Docker local retornou erro de I/O em seu metadata store antes de iniciar o container; conferir os arquivos HTTP no deploy.
- Emulação não comprova geração de WebAPK nem integração com launcher/Google Play em um aparelho Android físico.

## Publicação e conferência

PR para main e publicação pelo fluxo existente de cada aplicação. Conferir no domínio público o manifesto, ícones, registro do worker e diagnóstico do Chrome; evidências finais ficam na PR. Nenhuma migration ou function é necessária.

No aparelho: abrir o endereço diretamente no Chrome atualizado, usar o menu de adicionar à tela inicial e selecionar a opção de instalar quando oferecida. Um atalho antigo não é prova de instalação como aplicativo. Se persistir somente atalho, verificar versão do Chrome, modelo/Android e suporte a WebAPK do aparelho; não prometer corrigir limitações do dispositivo pelo manifesto.

## Reversão

Reverter manifesto/HTML/nginx interrompe novas instalações. Para retirar imediatamente o worker já instalado, publicar no mesmo `/pwa-sw.js` um worker de desativação que chama `registration.unregister()` na ativação. Não apagar todos os caches ou armazenamento da origem: não foram criados por esta mudança e podem conter dados de outras funcionalidades.

Fontes: https://web.dev/articles/install-criteria e https://developer.chrome.com/blog/update-install-criteria.
