#!/usr/bin/env bash
# Implanta ou atualiza o serviço do Teste de Arquétipo na VPS (EasyPanel/Swarm).
# Uso, de dentro do repo:
#   bash operacao/teste-arquetipo/implantar.sh
#   AVISAR=<jid>[,<jid>] AVISAR_TESTE=<jid> bash operacao/teste-arquetipo/implantar.sh   (troca os destinos)
#
# Na primeira vez cria /opt/teste-arquetipo/{app,data,.env}. O .env nasce lá com o token da
# instância Atendimento Oftalmoblack, lido do banco da Evolution sem passar por esta máquina, e
# nunca entra no git (o repo é público; os destinos dos avisos também ficam só lá). Sobe o
# serviço Swarm `teste-arquetipo` na rede `easypanel` e liga a rota /api/arquetipo/ no Traefik
# por arquivo próprio, que o EasyPanel não regenera. Rodar de novo troca o server.mjs, relê o
# .env e reinicia.
set -euo pipefail
cd "$(dirname "$0")"

VPS=root@187.127.26.142
KEY="$HOME/.ssh/olympus-evolution"
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 "$VPS")
DESTINO='^[0-9a-z@.,]*$'
if ! [[ "${AVISAR:-}" =~ $DESTINO && "${AVISAR_TESTE:-}" =~ $DESTINO ]]; then
  echo "AVISAR e AVISAR_TESTE: só JIDs separados por vírgula" >&2; exit 1
fi

node --check server.mjs
python -c "import json; json.load(open('traefik.json', encoding='utf-8'))"

scp -q -i "$KEY" server.mjs "$VPS:/tmp/teste-arquetipo-server.mjs"
scp -q -i "$KEY" traefik.json "$VPS:/tmp/teste-arquetipo-traefik.json"

"${SSH[@]}" "AVISAR='${AVISAR:-}' AVISAR_TESTE='${AVISAR_TESTE:-}' bash -s" <<'REMOTO'
set -euo pipefail
B=/opt/teste-arquetipo
mkdir -p $B/app $B/data
chown 1000:1000 $B/data && chmod 700 $B/data
install -m 644 /tmp/teste-arquetipo-server.mjs $B/app/server.mjs
install -m 644 /tmp/teste-arquetipo-traefik.json $B/traefik.json
rm -f /tmp/teste-arquetipo-server.mjs /tmp/teste-arquetipo-traefik.json

if [ ! -f $B/.env ]; then
  DB=$(docker ps -q -f name=sistema_black_evolution-api-db | head -1)
  TOKEN=$(docker exec "$DB" psql -U postgres -d sistema_black -At -c "SELECT token FROM \"Instance\" WHERE name = 'Atendimento Oftalmoblack'")
  [ -n "$TOKEN" ] || { echo "token da instância Atendimento não encontrado" >&2; exit 1; }
  ( umask 077
    printf '%s\n' "EVOLUTION_URL=http://sistema_black_evolution-api:8080" \
      "EVOLUTION_INSTANCIA=Atendimento Oftalmoblack" "EVOLUTION_TOKEN=$TOKEN" \
      "AVISAR=" "AVISAR_TESTE=" > $B/.env )
fi
if [ -n "$AVISAR" ]; then sed -i "s/^AVISAR=.*/AVISAR=$AVISAR/" $B/.env; fi
if [ -n "$AVISAR_TESTE" ]; then sed -i "s/^AVISAR_TESTE=.*/AVISAR_TESTE=$AVISAR_TESTE/" $B/.env; fi
grep -q '^AVISAR=.' $B/.env || echo "aviso: AVISAR vazio, ninguém recebe o PDF no WhatsApp" >&2

if docker service inspect teste-arquetipo >/dev/null 2>&1; then
  ARGS=()
  while IFS= read -r l; do [ -n "$l" ] && ARGS+=(--env-add "$l"); done < $B/.env
  docker service update --quiet --force "${ARGS[@]}" teste-arquetipo
else
  docker service create --quiet --name teste-arquetipo --network easypanel \
    --mount type=bind,src=$B/app,dst=/app,readonly \
    --mount type=bind,src=$B/data,dst=/data \
    --env-file $B/.env \
    --user 1000:1000 --workdir /app --limit-memory 128M \
    --restart-condition any --restart-delay 3s \
    --health-cmd "wget -qO- http://127.0.0.1:8080/api/arquetipo/saude >/dev/null || exit 1" \
    --health-interval 30s --health-timeout 5s --health-retries 3 \
    node:24-alpine node /app/server.mjs
fi
cp $B/traefik.json /etc/easypanel/traefik/config/teste-arquetipo.yaml
docker service ps teste-arquetipo --format "{{.Name}} {{.CurrentState}} {{.Error}}" | head -3
REMOTO

sleep 4
curl -s --max-time 15 https://oftalmoblack.com.br/api/arquetipo/saude; echo
