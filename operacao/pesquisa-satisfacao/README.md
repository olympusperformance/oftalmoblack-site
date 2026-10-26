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

## Versão 2026-10-26-r1

Publicação autorizada por Felipe em 26/10/2026 após revisão da prévia:

- Botão em cada palestra abre comentário opcional, com edição e remoção; `comentarios_aulas`
  guarda um mapa de chave da palestra para texto (até 2.000 caracteres por aula).
- Pergunta de preparo usa Protocolo Grau Zero por extenso; a palestra de Renato Ambrósio Jr.
  mostra o nome no título. As chaves de notas anteriores permanecem.
- Dias não são mais perguntados. `dias: []` nos envios novos significa **não coletado**, nunca
  ausência no evento. Catálogo Black: 22/23/24; demais perfis que avaliam aulas: 23/24.
  Quem não assistiu pode deixar a nota em branco, sem botão Não assisti.
- `barreira_aplicacao` é texto opcional de até 2.000 caracteres para mestre/participante.
- `nao_usa_club` é uma lista de itens marcados como Ainda não uso, separada das notas numéricas.
- Nenhum nome, contato ou vínculo com convite é adicionado. Identificadores enviados por abas
  antigas continuam ignorados pelo servidor. Textos livres não devem citar dados pessoais.

O backend precisa ser atualizado **antes** de publicar o novo frontend, pois a lista de campos
anterior descartava comentários. O limite HTTP é 256 KiB para comportar 22 comentários Unicode.
Testar localmente com `node --test tests/pesquisa-*.test.mjs`; os testes usam diretório temporário,
dados sintéticos e servidor local. Não enviar respostas reais para homologar.

O painel exibe comentários por aula e barreira de aplicação, não uso fora das médias, e exporta
esses campos e `versao` no CSV. Sem filtro, continua escolhendo a última revisão global de cada
ID. Com filtro de versão, escolhe a última revisão **dentro da versão selecionada**, permitindo
consultar revisões antigas sem somá-las no total geral. ID representa uma resposta no aparelho,
não identidade comprovada de uma pessoa. Não comparar médias de populações/itens distintos sem
considerar a mudança de exposição das palestras após a retirada da pergunta de dias.

Rascunhos mantêm a chave de localStorage, ID e recibo existentes. Campos novos recebem defaults;
o payload já pendente de uma aba anterior mantém a versão original ao reenviar. A nova edição
com os textos e catálogo atuais recebe a versão nova. Arquivos JSONL antigos nunca são migrados
ou reescritos. Correção gera append com o mesmo ID e conserva a revisão anterior no arquivo.

## Backup e rollback desta atualização

Antes de atualizar: copiar arquivos existentes em `data/` e `app/server.mjs` para diretório privado
de backup, registrar hashes e conferir restauração em área isolada. Conservar cópia fora da VPS.
Não incluir `.env` em artefatos públicos nem emitir a chave do painel. O diretório de dados é bind
mount separado do código e deve permanecer no mesmo local.

Rollback reverte apenas código compatível. **Nunca** copiar um snapshot antigo sobre arquivos
ativos: isso perderia respostas recebidas depois. `fsync` protege a gravação local, não substitui
backup externo. Esta atualização não instala uma política recorrente de backup nova.

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
