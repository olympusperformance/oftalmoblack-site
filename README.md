# Club OftalmoBlack — site

Landing page do Club OftalmoBlack. HTML estático, sem build step e sem backend.

## Estrutura

```
public/           # tudo que vai pro ar
  index.html
  assets/         # css, js, fontes e imagens
  robots.txt
  sitemap.xml
Dockerfile        # nginx alpine servindo public/
nginx.conf        # gzip, cache de assets, headers de segurança
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
