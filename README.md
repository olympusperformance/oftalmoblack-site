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
  mentorados/          # centrais artesanais antigas (ainda no ar)
  config.js            # regerado no boot a partir das variáveis de ambiente
  assets/              # css, js, fontes e imagens
  robots.txt
  sitemap.xml
docker-entrypoint.d/   # scripts que a imagem nginx roda no boot
supabase/              # SQL do banco: tabelas, RLS, acervo, demandas
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

Três telas, todas no mesmo visual (`assets/club.css`, extraído do protótipo):

| Rota | O quê |
|---|---|
| `/entrar/` | Login por e-mail e senha (Supabase Auth) |
| `/admin/` | Demandas, membros, tarefas, agenda, materiais e artefatos |
| `/membros/` | O que o mentorado enxerga; o admin pode espiar com `?membro=<id>` |

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

### Montar o banco (uma vez)

1. No **SQL Editor** do Supabase, rodar `supabase/schema.sql` inteiro, depois
   `supabase/materiais.sql` e `supabase/demandas.sql`
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
