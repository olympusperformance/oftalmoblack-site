# Club OftalmoBlack — site

Landing page e área de membros do Club OftalmoBlack. HTML estático, sem build
step e sem backend — o nginx só entrega arquivos.

## Estrutura

```
public/                # tudo que vai pro ar
  index.html           # landing page
  entrar/              # login da área de membros
  admin/               # painel do administrador
  membros/             # área do mentorado
  demandas/            # o quadro de demandas numa TV do escritório
  mentorados/          # centrais artesanais antigas (ainda no ar)
  config.js            # regerado no boot a partir das variáveis de ambiente
  assets/              # css, js, fontes e imagens
  robots.txt
  sitemap.xml
docker-entrypoint.d/   # scripts que a imagem nginx roda no boot
supabase/              # SQL do banco: tabelas, RLS, acervo, demandas, progresso
  functions/           # Edge Functions (a que serve o quadro da TV)
Dockerfile             # nginx alpine servindo public/
nginx.conf             # gzip, cache de assets, headers de segurança
```

## Rodar local

```bash
cd public && python3 -m http.server 8000
```

Ou com Docker:

```bash
docker build -t oftalmoblack-site . && docker run --rm -p 8080:80 oftalmoblack-site
```

## Deploy — EasyPanel (VPS Hostinger)

1. **Create Service → App**
2. **Source:** GitHub → este repositório, branch `main`
3. **Build:** método `Dockerfile`, caminho `./Dockerfile`
4. **Domains:** adicionar `oftalmoblack.com.br` e `www.oftalmoblack.com.br`,
   porta interna **80**, com HTTPS/Let's Encrypt ligado
5. **Deploy**

O EasyPanel termina o TLS no Traefik e fala HTTP com o container — por isso o
`nginx.conf` não força HTTPS internamente (forçar causa loop de redirect).

Push na `main` dispara redeploy se o auto-deploy estiver ligado.

### Variáveis de ambiente

Configuradas no serviço do EasyPanel. `docker-entrypoint.d/10-config.sh` lê essas
variáveis no boot e escreve `/config.js`, que o navegador carrega.

| Variável | Para quê |
|---|---|
| `SUPABASE_URL` | URL do projeto. Sem ela, vale o `config.js` versionado |
| `SUPABASE_ANON_KEY` | Chave publishable (anon). Pública por definição — quem protege os dados é o RLS |

Para conferir o script sem subir container:

```bash
CLUB_CONFIG_PATH=/tmp/config.js SUPABASE_URL=https://... SUPABASE_ANON_KEY=sb_publishable_... \
  sh docker-entrypoint.d/10-config.sh
```

## Área de membros

Quatro telas, todas no mesmo visual (`assets/club.css`, extraído do protótipo):

| Rota | O quê |
|---|---|
| `/entrar/` | Login por e-mail e senha (Supabase Auth) |
| `/admin/` | Demandas, membros, tarefas, agenda, materiais e artefatos |
| `/membros/` | O que o mentorado enxerga; o admin pode espiar com `?membro=<id>` |
| `/demandas/` | O quadro de demandas na TV do escritório, sem login |

O site continua sendo HTML estático: o navegador fala direto com o Supabase, sem
servidor nosso no meio. Quem decide o que cada pessoa alcança é o Row Level
Security do Postgres — a `anon key` que vai no `config.js` é pública por
definição e, sozinha, não abre nada.

### Como o acesso é decidido

| Quem | Enxerga | Escreve |
|---|---|---|
| Sem login | nada | nada |
| Mentorado | o próprio cadastro, as próprias tarefas, e os eventos e artefatos dele mais os de `member_id` nulo (turma inteira) | só marcar a própria tarefa como concluída, pela função `toggle_task` |
| Admin | tudo | tudo |

Ser admin não é algo que o navegador afirma: vem da tabela `app_admins`, lida
pela função `is_admin()` no banco.

`members.user_id` liga o cadastro ao login. O gatilho `on_auth_user_created`
costura os dois pelo e-mail, em qualquer ordem — dá para cadastrar o mentorado
no painel antes ou depois de criar o login dele no Auth.

### Materiais e demandas

**Materiais** é o acervo que só cresce — análise de tráfego, tutorial, roteiro —
e não se confunde com artefato, que é o que o mentorado destrava (o CRM, a
landing page). Cada material carrega um arquivo de verdade, guardado num bucket
privado: sem URL pública, sem caminho adivinhável, download por link assinado de
dois minutos. A visibilidade é `visivel_para`, um array de `member_id`; nulo quer
dizer turma inteira. Um arquivo, uma linha, vários destinatários.

**Demandas** é o quadro interno da operação, no vocabulário que a equipe já usa
no ClickUp (A fazer → Planejando → Em andamento → Em risco / Aguardando retorno /
Em pausa → Concluída / Cancelada). Só o administrador alcança: as políticas de
`demands` e `staff` não têm regra de leitura para mentorado. A demanda pode
apontar para um mentorado (`member_id`) quando é sobre alguém — "campanha do
Pedro", "site da Cíntia" — e fica solta quando é interna.

### O quadro na TV do escritório

`/demandas/` é o mesmo quadro da aba Demandas desenhado para ser lido de longe:
uma coluna por situação, letra grande, nada clicável. Relê o banco a cada 30
segundos, e a coluna que tem mais demanda do que caberia na altura da tela gira
de página a cada 20 — o pé da coluna diz onde está ("6–14 de 14"), então nada
fica escondido sem avisar. Não rola: a TV não tem quem role.

Esta é a única tela do site que não fala direto com o Supabase, e o motivo é
que ela entra sem login. As tabelas `demands`, `demand_steps` e `staff` só têm
política de leitura para administrador, e abrir uma para `anon` entregaria o
quadro a quem tem a chave publishable — que é pública e vive no `/config.js`.
Então quem lê o banco é a Edge Function `demandas-tv`
(`supabase/functions/demandas-tv/`), com a chave de serviço que nunca sai de
lá. O RLS continua fechado como estava, e a função só sabe ler: não há caminho
de escrita nela.

Quem manda no portão são duas variáveis de ambiente **do projeto Supabase** (não
do EasyPanel — a senha não pode viver no `config.js`, que qualquer visitante lê):

| Variável | Para quê |
|---|---|
| `DEMANDAS_PUBLICO=1` | Quadro aberto, sem senha. É o modo de hoje |
| `DEMANDAS_SENHA=…` | Quadro trancado por esta senha |

Sem nenhuma das duas a função se recusa a responder — segredo esquecido não
vira porta aberta por acidente. Para trancar depois:

```bash
supabase secrets set DEMANDAS_SENHA=... --project-ref <ref>
supabase secrets unset DEMANDAS_PUBLICO --project-ref <ref>
supabase functions deploy demandas-tv --project-ref <ref> --no-verify-jwt
```

Não há nada a mudar no site: a tela pergunta ao servidor se precisa de senha e
desenha o portão sozinha. A senha que funcionou fica no `localStorage` daquela
TV, para a tela voltar sozinha depois de uma queda de luz.

### Graduação Black

`/membros/#graduacao` mostra a faixa, os graus, a meta de 50 pontos do trimestre,
os quatro critérios e os bônus. `/admin/#graduacao` traz o radar da turma, com
filtros por situação e busca por nome. O atalho de cada linha abre a graduação
daquele mentorado na pré-visualização.

Esta primeira versão é uma prévia fixa da planilha **SISTEMA DE GRADUAÇÃO BLACK**
de 10/09/2026. Não consulta a Meta e não altera métricas existentes. Reproduz os
29 cadastros, os valores por trimestre e os graus calculados no Painel: Cintia
tem 65,3 pontos em jul–set e dois graus; 11 mentorados estão entre 35 e 49,9.
O grau do Painel já inclui o trimestre corrente, então a interface não soma
outro grau quando a meta é atingida. O Histórico Graus ainda não tem datas de
entrega: isso aparece como pendência de registro, sem criar cerimônias fictícias.

Dados em branco permanecem sem apuração, incluindo indicações. Trimestres
futuros não exibem zeros como resultado confirmado. Os valores de renovação
seguem as células do Painel: sua fórmula atual não inclui bônus, embora eles
entrem no total de cada trimestre. A prévia preserva esse resultado e o rotula
como pontuação para renovação da planilha.

No projeto Supabase **OftalmoBlack Web** (`zpyxnkuvircukjlfexrv`), aplicar
`supabase/graduacao.sql` e depois `supabase/graduacao-preview-dados.sql`.
`member_graduations` tem RLS: mentorado lê somente o próprio registro, admin lê
a turma e a gravação é reservada ao serviço. Os dados individuais não ficam nos
arquivos públicos do site. A carga falha se houver nome sem correspondência e
não sobrescreve registros que já saíram do modo de demonstração.

Verificação: `node --test tests/graduacao.test.mjs`. A fixture reproduz os
valores da planilha e permite conferir totais, limites e situações do radar.

### Cérebro: o mentorado pergunta em português

A aba **Cérebro** é uma conversa, não um formulário: o mentorado pergunta sobre o
que já foi conversado no grupo de Operação e sobre os números da própria clínica.

Do lado do site há só a tela e a chamada — quem fala com o modelo e com o banco é
uma Edge Function (`cerebro-chat`), documentada em `docs/cerebro/chat-function.ts`
no repositório do CRM. O que garante a privacidade não é o texto do prompt: o
`member_id` é resolvido pelo servidor e injetado em toda consulta, e as funções que
o chat usa (`cerebro_buscar_do_membro` e companhia) têm `revoke execute` para
`anon` e `authenticated` — só a função, com service role, as chama. O navegador
manda a pergunta, o histórico e o token. No acesso normal, o membro vem do login.
Na pré-visualização, envia também o `member_id` selecionado; a função só aceita
esse alvo depois de confirmar o usuário autenticado em `app_admins`, e exige um
mentorado ativo. Trocar de mentorado recarrega a página e limpa a conversa.

O erro aparece como fala do Cérebro, e não como aviso que passa: quem perguntou
precisa entender por que não teve resposta.

### O grupo de Operação na área do mentorado

Cada mentorado tem um grupo de WhatsApp com a equipe — é onde a mentoria
acontece no dia a dia. O convite fica em `members.whatsapp_url`, e não em
`cerebro.grupos`, por dois motivos: o painel edita o cadastro pela API (o schema
`cerebro` não é exposto) e mentorado sem grupo mapeado no Cérebro também precisa
do link.

Do lado do mentorado, o botão aparece ao lado da saudação e some por completo
quando não há link — botão que não leva a lugar nenhum é pior que botão nenhum.
Do lado do administrador, a coluna de ações mostra o ícone em verde quando há
grupo e apagado quando falta, de modo que a lacuna se vê na lista sem abrir
cadastro nenhum; clicar no apagado abre o campo na própria linha para colar o
convite. O mesmo campo existe no formulário do membro.

A Evolution só entrega o convite dos grupos em que o número dela é
administrador (`GET /group/inviteCode`); nos outros, alguém gera no WhatsApp e
cola no painel.

### Membros: cadastro e progresso na mesma tela

A aba **Membros** é a árvore de acompanhamento. Cadastro e progresso eram a
mesma pergunta — "como está fulano?" — feita em dois lugares:

```
Mentorado
  └ Artefato          (os de member_id nulo valem para a turma inteira)
      └ Etapa         (o checklist padrão do artefato)
```

Tarefa não entra na árvore: ela vive só na aba **Tarefas**. A etapa do artefato
é entrega do Club e quem marca é a administração; a tarefa é do mentorado e é
ele quem a conclui. São ciclos diferentes, e juntá-los na mesma coluna faria a
mesma palavra significar duas coisas.

O checklist é do artefato, cadastrado uma vez no campo **Etapas padrão** da aba
Artefatos — uma etapa por linha — e vale para todo mentorado que recebe aquele
artefato (`artifact_steps`). O que já saiu é por mentorado (`step_progress`), e
quem marca é a administração: o mentorado lê o próprio progresso e não escreve
nele. Editar o texto de uma linha do checklist mantém o que já estava marcado;
apagar a linha apaga o progresso dela junto.

Não existe tabela de "artefato atribuído ao mentorado": quem já decide isso é
`artifacts.member_id`, a mesma regra que monta a área do mentorado.

#### Observações internas da Progressão

A coluna **Observação** guarda uma nota por mentorado, artefato ou etapa.
A célula mostra uma linha resumida; clicar expande o editor abaixo da linha.
Salvar confirma, Cancelar/Esc descarta o rascunho e Ctrl/Cmd+Enter salva sem
tirar a possibilidade de usar Enter para uma quebra de linha. Limite: 2.000
caracteres. Para limpar uma nota, apague o texto e salve.

Antes de publicar esta interface, aplicar `supabase/observacoes-progressao.sql`
no SQL Editor, depois de `schema.sql` e `progresso.sql`. É uma migração aditiva
e idempotente: cria `progress_notes`, sem modificar `step_progress` ou os
checklists. As notas de artefatos/etapas compartilhados continuam específicas
de cada mentorado; RLS permite leitura e escrita somente a administradores.
Sem a tabela, ou em caso de falha na leitura, o quadro continua funcionando,
mas mostra um aviso e bloqueia a edição das notas até recarregar com sucesso.
O deploy estático não executa essa migração automaticamente.

Testes de regressão sem dependências: `node --test tests/progress-notes.test.cjs`.

A demanda também abre em checklist (`demand_steps`), mas ali a marcação mora na
própria etapa: ela é de uma demanda só e não é modelo para mais ninguém. O
quadro é uma lista única com a situação em coluna, ordenada por situação (na
ordem do fluxo), prioridade e prazo.

A subtarefa carrega **as mesmas colunas da demanda** — situação, prioridade,
responsáveis, mentorado e prazo, com as mesmas listas — porque dividir uma
demanda em pedaços sem poder dizer quem toca cada pedaço e até quando só muda o
problema de lugar. Quem desenha as duas alturas é o mesmo trecho de código, para
uma coluna nova não nascer só na mãe. A única coluna vazia na subtarefa é
Checklist: ela não abre outro nível. O `feito` da subtarefa não é um segundo
lugar onde o "pronto" mora — um gatilho o deriva do status (`Concluída` ou
`Cancelada`), e a caixinha da linha é atalho para essa coluna.

No quadro de demandas a coluna é o controle: clicar na célula de situação,
prioridade, responsáveis ou mentorado abre o menu daquela coluna e grava na hora
— responsáveis aceita vários, então o menu fica de pé até o clique fora. O prazo
vira o calendário do navegador na própria célula. Título e descrição continuam no
formulário: são texto livre e texto livre pede espaço. Subtarefa nasce no `+` que
ocupa o lugar do chevron enquanto a demanda não tem checklist e, depois que tem,
na última linha da lista; Enter salva e mantém o campo aberto para a próxima, Esc
fecha.

### Montar o banco (uma vez)

1. No **SQL Editor** do Supabase, rodar `supabase/schema.sql` inteiro, depois
   `supabase/materiais.sql`, `supabase/demandas.sql` e `supabase/progresso.sql`
   (os arquivos são idempotentes: rodar de novo depois de uma atualização é
   seguro e não apaga nada)
2. Em **Authentication → Users**, criar o login do administrador
3. Em `supabase/primeiro-acesso.sql`, trocar `SEU-EMAIL-DE-ADMIN@AQUI` pelo
   e-mail do passo 2 e rodar o arquivo
4. Criar em **Authentication → Users** o login de cada mentorado, com o mesmo
   e-mail que está no cadastro dele

### Chaves

`public/config.js` carrega a URL do projeto e a `anon key` (publishable). Em
produção o `docker-entrypoint.d/10-config.sh` regera esse arquivo a partir de
`SUPABASE_URL` e `SUPABASE_ANON_KEY`.

A chave **secret** (service_role) ignora o RLS e dá controle total do banco.
Ela não entra no repositório, não entra no `config.js` e não é necessária em
lugar nenhum deste projeto.

## Integrações externas

O site não tem backend, mas depende de três serviços de fora:

| O quê | Onde | Observação |
|---|---|---|
| Formulário de aplicação | Webhook Make.com | endpoint em `assets/app.js` |
| Fallback do formulário | WhatsApp | usado quando o webhook falha |
| Tracking | Facebook Pixel | evento `PageView` |

O endpoint do Make fica visível no JS — é inerente a site estático. Se começar a
receber spam, colocar rate limit ou captcha do lado do Make.

## Origem

Migrado da hospedagem compartilhada TurboCloud (cPanel, servidor `star4070.com.br`).
O conteúdo foi espelhado via HTTP a partir de `https://oftalmoblack.com.br`.

Dois itens do servidor antigo **não** vieram no espelho e devem ser conferidos no
backup do cPanel antes de desligar a hospedagem:

- **`.htaccess`** — retorna 403, pode conter redirects ou regras de cache
- **arquivos não referenciados no `index.html`** — não aparecem num espelho HTTP

## DNS

Nameservers atuais: `ns1/ns2.mentoriaolympusdecatarata.com` (TurboCloud). TTL do
registro A: 600s.

Para migrar apontando só o site e **preservando o e-mail**, alterar apenas o
registro **A** (e o `www`) para o IP do VPS. O **MX** deve continuar apontando
para o servidor antigo enquanto houver caixas ativas no domínio — A e MX são
independentes.
