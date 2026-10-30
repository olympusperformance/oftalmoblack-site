# Teste de Arquétipo: resultados no servidor (out/2026)

- Teste: `https://oftalmoblack.com.br/teste-de-arquetipo/` (página em `public/teste-de-arquetipo/`).
  Com `?teste=1` o resultado vai para o arquivo de testes e o aviso vai só para `AVISAR_TESTE`.
- Desde 30/10/2026 o resultado não depende mais de o membro mandar o PDF: ao concluir, a página
  envia respostas, placar e o próprio PDF para o servidor, que grava e manda o PDF pelo WhatsApp
  do Atendimento para quem está em `AVISAR`. A capa avisa o membro disso.

## Como funciona

A página manda um JSON para `POST /api/arquetipo/respostas` assim que o resultado aparece. O
Traefik da VPS (`/etc/easypanel/traefik/config/teste-arquetipo.yaml`, cópia de `traefik.json`)
leva `/api/arquetipo/` ao serviço Swarm `teste-arquetipo` (Node 24, `server.mjs`, sem
dependências), que grava em `/opt/teste-arquetipo/data/`:

- `respostas.jsonl`: um resultado por linha (nome, cidade, data, as 60 respostas, principal,
  apoio, placar e o caminho do PDF);
- `pdf/`: o PDF de cada resultado, igual ao que o membro baixa;
- `testes.jsonl` e `pdf-testes/`: o que veio com `teste: true`;
- `avisos.jsonl`: cada tentativa de aviso no WhatsApp, com o `key_id` da mensagem ou o erro.

Cada tentativa do teste tem um `resposta_id` que nasce no aparelho; o mesmo id não grava nem
avisa duas vezes. Se o envio falhar, a página tenta de novo quando o resultado abrir outra vez ou
quando o PDF for baixado. Teste concluído antes de 30/10 vai quando o membro abrir o resultado.

A legenda do WhatsApp traz nome, cidade, principal e apoio com os pontos, e avisa empate: o
desempate do teste é só a ordem das chaves em `dados.js`, então empate no topo é hipótese.

## Implantar ou atualizar

```bash
bash operacao/teste-arquetipo/implantar.sh
```

Na primeira vez cria as pastas, o `.env` (com o token da instância Atendimento Oftalmoblack, lido
do banco da Evolution na própria VPS) e o serviço; depois troca o `server.mjs`, relê o `.env` e
reinicia. O `.env` e os destinos dos avisos ficam só na VPS (o repo é público). Para trocar quem
recebe:

```bash
AVISAR=<jid>[,<jid>] AVISAR_TESTE=<jid> bash operacao/teste-arquetipo/implantar.sh
```

Testar localmente com `node --test tests/arquetipo-servidor.test.mjs` (dados sintéticos e uma
Evolution falsa). Não usar resultado de membro para homologar.

## Ler os resultados

```bash
ssh -i ~/.ssh/olympus-evolution root@187.127.26.142 'cat /opt/teste-arquetipo/data/respostas.jsonl'
```

Os PDFs estão em `/opt/teste-arquetipo/data/pdf/` (dono 1000, modo 600).
