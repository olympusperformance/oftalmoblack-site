#!/bin/sh
# Gera /config.js a partir das variáveis de ambiente, antes do nginx subir.
# A imagem nginx executa tudo que está em /docker-entrypoint.d/ no boot.
#
# Sem SUPABASE_URL definido, o config.js versionado no repositório continua
# valendo — assim um deploy sem variáveis não derruba o login.
#
# SUPABASE_ANON_KEY é a chave "publishable": ela nasceu para viver no navegador
# e o Row Level Security é quem protege os dados. A chave "secret"
# (service_role) nunca deve ser colocada aqui — ela ignora o RLS.
set -e

# CLUB_CONFIG_PATH existe para dar pra rodar este script fora do container.
TARGET=${CLUB_CONFIG_PATH:-/usr/share/nginx/html/config.js}

if [ -z "$SUPABASE_URL" ]; then
  echo "[club] SUPABASE_URL não definido — mantendo o config.js versionado."
  exit 0
fi

cat > "$TARGET" <<EOF
/* Gerado no boot do container por docker-entrypoint.d/10-config.sh.
   Não editar aqui — mexer nas variáveis de ambiente do serviço. */
window.CLUB_CONFIG = {
  supabaseUrl: "${SUPABASE_URL}",
  supabaseAnonKey: "${SUPABASE_ANON_KEY}"
};
EOF

echo "[club] config.js gerado para ${SUPABASE_URL}."
