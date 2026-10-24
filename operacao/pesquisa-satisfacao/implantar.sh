#!/usr/bin/env bash
# Implanta ou atualiza o serviço da pesquisa de satisfação na VPS (EasyPanel/Swarm).
# Uso, de dentro do repo: bash operacao/pesquisa-satisfacao/implantar.sh
#
# Cria /opt/pesquisa-satisfacao/{app,data,.env} na primeira vez (a chave do painel
# nasce lá e nunca entra no git), sobe o serviço Swarm `pesquisa-satisfacao` na
# rede `easypanel` e liga a rota /api/pesquisa/ no Traefik por arquivo próprio,
# que o EasyPanel não regenera. Rodar de novo só troca o server.mjs e reinicia.
set -euo pipefail
cd "$(dirname "$0")"

VPS=root@187.127.26.142
KEY="$HOME/.ssh/olympus-evolution"
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 "$VPS")

node --check server.mjs
python -c "import json; json.load(open('traefik.json', encoding='utf-8'))"

"${SSH[@]}" 'set -e
  mkdir -p /opt/pesquisa-satisfacao/app /opt/pesquisa-satisfacao/data
  chown 1000:1000 /opt/pesquisa-satisfacao/data && chmod 700 /opt/pesquisa-satisfacao/data
  if [ ! -f /opt/pesquisa-satisfacao/.env ]; then
    umask 077
    printf "CHAVE_PAINEL=%s\n" "$(openssl rand -hex 24)" > /opt/pesquisa-satisfacao/.env
  fi'

scp -q -i "$KEY" server.mjs "$VPS:/opt/pesquisa-satisfacao/app/server.mjs"
scp -q -i "$KEY" traefik.json "$VPS:/opt/pesquisa-satisfacao/traefik.json"

"${SSH[@]}" 'set -e
  if docker service inspect pesquisa-satisfacao >/dev/null 2>&1; then
    docker service update --quiet --force pesquisa-satisfacao
  else
    docker service create --quiet --name pesquisa-satisfacao --network easypanel \
      --mount type=bind,src=/opt/pesquisa-satisfacao/app,dst=/app,readonly \
      --mount type=bind,src=/opt/pesquisa-satisfacao/data,dst=/data \
      --env-file /opt/pesquisa-satisfacao/.env \
      --user 1000:1000 --workdir /app --limit-memory 128M \
      --restart-condition any --restart-delay 3s \
      --health-cmd "wget -qO- http://127.0.0.1:8080/api/pesquisa/saude >/dev/null || exit 1" \
      --health-interval 30s --health-timeout 5s --health-retries 3 \
      node:24-alpine node /app/server.mjs
  fi
  cp /opt/pesquisa-satisfacao/traefik.json /etc/easypanel/traefik/config/pesquisa-satisfacao.yaml
  docker service ps pesquisa-satisfacao --format "{{.Name}} {{.CurrentState}} {{.Error}}" | head -3'

sleep 4
curl -s --max-time 15 https://oftalmoblack.com.br/api/pesquisa/saude; echo
