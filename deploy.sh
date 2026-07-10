#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# ─── Couleurs ──────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

# ─── Config ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/.deploy.env"
BUILD_DIR="${SCRIPT_DIR}/.next"
STANDALONE_DIR="${BUILD_DIR}/standalone"
DEPLOY_TMP="${SCRIPT_DIR}/.deploy-tmp"

# ─── Chargement config ──────────────────────────────────
if [ -f "$CONFIG_FILE" ]; then
  echo -e "${CYAN}→ Chargement de ${CONFIG_FILE}${NC}"
  set -a; source "$CONFIG_FILE"; set +a
else
  echo -e "${YELLOW}⚠  ${CONFIG_FILE} introuvable — utilise les vars d'env existantes${NC}"
fi

: "${SSH_HOST:=}"
: "${SSH_USER:=}"
: "${SSH_PORT:=22}"
: "${SSH_TARGET_DIR:=}"
: "${DEPLOY_METHOD:=rsync}"

# ─── 1. Build ──────────────────────────────────────────
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Build Next.js (standalone)${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
bun run build

# ─── 2. Préparation du dossier standalone ──────────────
echo -e "\n${CYAN}→ Préparation du dossier standalone…${NC}"

rm -rf "$DEPLOY_TMP"
mkdir -p "$DEPLOY_TMP"

# Copie du serveur standalone (dotglob pour inclure .next/)
shopt -s dotglob
cp -r "$STANDALONE_DIR"/* "$DEPLOY_TMP/"
shopt -u dotglob

# Fichiers statiques (manquants dans standalone — ils sont dans .next/static/ à la racine)
mkdir -p "${DEPLOY_TMP}/.next/static"
cp -r "${BUILD_DIR}/static/"* "${DEPLOY_TMP}/.next/static/"

# Dossier public
cp -r "${SCRIPT_DIR}/public" "${DEPLOY_TMP}/public"

# Dossier data (si pas déjà sur le serveur)
cp -r "${SCRIPT_DIR}/data" "${DEPLOY_TMP}/data"

# Génération du .env production
cat > "${DEPLOY_TMP}/.env" <<-EOF
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
IA_API_KEY=${IA_API_KEY}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI}
AUTH_SECRET=${AUTH_SECRET}
OPENWEATHERMAP_API_KEY=${OPENWEATHERMAP_API_KEY}
BRAVE_SEARCH_API_KEY=${BRAVE_SEARCH_API_KEY}
NODE_ENV=production
EOF

echo -e "${GREEN}✓ Standalone prêt dans ${DEPLOY_TMP}${NC}"

# ─── 3. Déploiement ────────────────────────────────────
echo -e "\n${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Déploiement${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

if [ -z "$SSH_HOST" ] || [ -z "$SSH_TARGET_DIR" ]; then
  echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║  SSH non configuré — création d'une archive manuelle       ║${NC}"
  echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo -e "${CYAN}→ Création de backstage-deploy.tar.gz…${NC}"
  tar -czf "${SCRIPT_DIR}/backstage-deploy.tar.gz" -C "$DEPLOY_TMP" .
  echo -e "${GREEN}✓ Archive générée : backstage-deploy.tar.gz${NC}"
  echo -e "${YELLOW}  À faire :${NC}"
  echo -e "  1. Uploader l'archive dans ${SSH_TARGET_DIR:-/le/dossier/cible/}"
  echo -e "  2. $ tar -xzf backstage-deploy.tar.gz"
  echo -e "  3. Configurer l'App Node.js dans cPanel (→ lire README-cPanel.md)"
  rm -rf "$DEPLOY_TMP"
  exit 0
fi

# Déploiement via rsync
echo -e "${CYAN}→ Déploiement vers ${SSH_USER}@${SSH_HOST}:${SSH_TARGET_DIR}${NC}"

rsync -avz --delete \
  -e "ssh -p ${SSH_PORT}" \
  --exclude 'node_modules' \
  --exclude 'data/*.json' \
  --exclude 'data/backups' \
  --exclude '.htaccess' \
  "$DEPLOY_TMP/" \
  "${SSH_USER}@${SSH_HOST}:${SSH_TARGET_DIR}/"

# ─── 4. Restart ────────────────────────────────────────
echo -e "\n${CYAN}→ Redémarrage de l'App Node.js…${NC}"

# Tentative 1 : cPanel API (UAPI)
if command -v curl &>/dev/null && [ -n "${CPANEL_TOKEN:-}" ] && [ -n "${CPANEL_USER:-}" ]; then
  echo -e "${CYAN}  Via cPanel API…${NC}"
  curl -s -H "Authorization: cpanel ${CPANEL_USER}:${CPANEL_TOKEN}" \
    "https://${SSH_HOST}:2083/execute/NodeApps/restart_app?app_name=$(basename ${SSH_TARGET_DIR})" \
    || echo -e "${YELLOW}  API échouée — restart manuel requis${NC}"
# Tentative 2 : SSH avec restart (si cagefs/shell accessible)
elif ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" "command -v node &>/dev/null" 2>/dev/null; then
  echo -e "${CYAN}  Restart via SSH + touch…${NC}"
  ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" \
    "cd ${SSH_TARGET_DIR} && touch tmp/restart.txt 2>/dev/null; \
     echo 'Si vous utilisez cPanel Node.js Selector, redémarrez manuellement depuis l\'UI.'"
else
  echo -e "${YELLOW}  ⚠  Redémarre manuellement depuis cPanel :${NC}"
  echo -e "      cPanel → Setup Node.js App → Stop / Start"
fi

# ─── 5. Nettoyage ──────────────────────────────────────
rm -rf "$DEPLOY_TMP"
echo -e "\n${GREEN}✓ Déploiement terminé${NC}"
