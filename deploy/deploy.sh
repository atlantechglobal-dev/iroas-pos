#!/usr/bin/env bash
# Deploy the IROAS app on its server: back up the database, pull, build, restart.
# Run from anywhere on the server:  APP_DIR=/var/www/iroas-pos ./deploy/deploy.sh [branch]
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/iroas-pos}"
PM2_NAME="${PM2_NAME:-iroas-pos}"
BRANCH="${1:-main}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
PORT="${PORT:-4000}"

cd "$APP_DIR"
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree has local changes; refusing to deploy." >&2
  git status --short >&2
  exit 1
fi

PREVIOUS="$(git rev-parse --short HEAD)"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR/$STAMP"
cp -a server/data/iroas.db* "$BACKUP_DIR/$STAMP/"
echo "Database backed up to $BACKUP_DIR/$STAMP (previous commit $PREVIOUS)"

git fetch origin "$BRANCH"
git merge --ff-only "origin/$BRANCH"

npm ci
(cd server && npm ci --omit=dev)
npm run build

pm2 restart "$PM2_NAME" --update-env

for _ in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    echo "Deployed $(git rev-parse --short HEAD) (was $PREVIOUS)"
    echo "Rollback: git checkout $PREVIOUS && npm ci && npm run build && pm2 restart $PM2_NAME"
    exit 0
  fi
  sleep 2
done
echo "App did not come back up; check: pm2 logs $PM2_NAME" >&2
exit 1
