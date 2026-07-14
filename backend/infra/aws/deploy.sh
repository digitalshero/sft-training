#!/usr/bin/env bash
# =============================================================
# Shero Backend — EC2 Deploy Script
# Deploys to an EC2 instance running Ubuntu 24 + PM2 + Nginx.
# Run locally after bootstrap.sh has created the instance.
#
# Prerequisites:
#   - EC2_HOST set to the public IP/DNS of the instance
#   - EC2_KEY  set to the path of the SSH key (.pem)
#   - Repo already pushed to a Git remote the server can pull,
#     OR copy the built dist/ via rsync (handled here).
#
# Usage:
#   EC2_HOST=ec2-1-2-3-4.ap-south-1.compute.amazonaws.com \
#   EC2_KEY=./shero-prod-key.pem \
#   bash infra/aws/deploy.sh
# =============================================================

set -euo pipefail

EC2_HOST="${EC2_HOST:?Set EC2_HOST}"
EC2_KEY="${EC2_KEY:?Set EC2_KEY}"
EC2_USER="${EC2_USER:-ubuntu}"
REMOTE_DIR="/srv/shero-backend"
APP_NAME="shero-backend"

echo "=== Shero Deploy → $EC2_HOST ==="

# ── 1. Build locally ──────────────────────────────────────────────────────────
echo "--- Building TypeScript ---"
npm run build

# ── 2. Copy dist + prisma + package.json ─────────────────────────────────────
echo "--- Copying files to EC2 ---"
ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "mkdir -p $REMOTE_DIR"

rsync -az --delete \
  --exclude 'node_modules' \
  --exclude 'src' \
  --exclude '.git' \
  --exclude 'infra' \
  --exclude '*.sh' \
  -e "ssh -i $EC2_KEY -o StrictHostKeyChecking=no" \
  ./ "$EC2_USER@$EC2_HOST:$REMOTE_DIR/"

# ── 3. Remote setup ───────────────────────────────────────────────────────────
echo "--- Remote npm install + migrate ---"
ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" bash <<'REMOTE'
  set -e
  cd /srv/shero-backend
  export PATH="/home/ubuntu/.nvm/versions/node/$(ls ~/.nvm/versions/node | sort -V | tail -1)/bin:$PATH"
  npm ci --omit=dev
  npx prisma generate
  npx prisma migrate deploy
  echo "Migrations complete"
REMOTE

# ── 4. Restart PM2 ───────────────────────────────────────────────────────────
echo "--- Restarting PM2 ---"
ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" bash <<REMOTE
  export PATH="/home/ubuntu/.nvm/versions/node/\$(ls ~/.nvm/versions/node | sort -V | tail -1)/bin:\$PATH"
  cd /srv/shero-backend
  if pm2 describe ${APP_NAME} > /dev/null 2>&1; then
    pm2 reload ${APP_NAME} --update-env
  else
    pm2 start dist/index.js --name ${APP_NAME} --env production
    pm2 save
  fi
  pm2 status
REMOTE

echo "=== Deploy complete ==="
