# Pesquisa de satisfação (Imersão Grau Zero e Club OftalmoBlack, out/2026)

- Pesquisa: `https://oftalmoblack.com.br/imersaograuzero/pesquisa/` (página em `public/imersaograuzero/pesquisa/`).
  Com `?teste=1` a resposta vai para o arquivo de testes e não entra no resultado.
- Painel: `https://oftalmoblack.com.br/imersaograuzero/pesquisa/resultados/#k=<chave>`.
  Com `?testes=1` (antes do `#`) mostra as respostas de teste.
- A chave do painel mora só na VPS, em `/opt/pesquisa-satisfacao/.env` (`CHAVE_PAINEL`), nunca no git.

## Como funciona

A página manda um JSON para `POST /api/pesquisa/respostas`. O Traefik da VPS
(`/etc/easypanel/traefik/config/pesquisa-satisfacao.yaml`, cópia de `traefik.json`) leva
`/api/pesquisa/` ao serviço Swarm `pesquisa-satisfacao` (Node 24, `server.mjs`, sem dependências),
que grava uma linha por resposta em `/opt/pesquisa-satisfacao/data/`:

- `respostas.jsonl`: as respostas de verdade;
- `testes.jsonl`: o que veio com `teste: true`;
- `descartadas.jsonl`: o que caiu no campo-isca (robô).

O painel lê `GET /api/pesquisa/resultados` com `Authorization: Bearer <chave>` e considera só a
última versão de cada `resposta_id` (quem corrige a resposta não conta duas vezes).

## Implantar ou atualizar

```bash
bash operacao/pesquisa-satisfacao/implantar.sh
```

Na primeira vez cria as pastas, a chave e o serviço; depois só troca o `server.mjs` e reinicia.
O arquivo do Traefik é próprio, então o EasyPanel não o regenera.

## Ler as respostas sem o painel

```bash
ssh -i ~/.ssh/olympus-evolution root@187.127.26.142 'cat /opt/pesquisa-satisfacao/data/respostas.jsonl'
```
