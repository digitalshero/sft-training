#!/usr/bin/env bash
# =============================================================
# Shero Backend — EC2 Server Setup (Ubuntu 24)
# Run this ONCE on a brand-new EC2 Ubuntu instance as ubuntu user.
#
# Usage:
#   ssh -i shero-prod-key.pem ubuntu@<EC2_HOST>
#   curl -fsSL https://raw.githubusercontent.com/.../ec2-setup.sh | bash
#   -- OR copy this file and run: bash ec2-setup.sh
# =============================================================

set -euo pipefail

echo "=== Shero EC2 Server Setup ==="

# ── System updates ────────────────────────────────────────────────────────────
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y git curl wget unzip nginx certbot python3-certbot-nginx \
  build-essential libssl-dev awscli jq htop

# ── Node.js (via nvm) ─────────────────────────────────────────────────────────
echo "--- Installing Node.js 20 via nvm ---"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20
node -v && npm -v

# ── PM2 ───────────────────────────────────────────────────────────────────────
npm install -g pm2
pm2 startup systemd -u ubuntu --hp /home/ubuntu
sudo env PATH="$PATH:/home/ubuntu/.nvm/versions/node/$(node -v | tr -d 'v')/bin" \
  pm2 startup systemd -u ubuntu --hp /home/ubuntu

# ── App directory ─────────────────────────────────────────────────────────────
sudo mkdir -p /srv/shero-backend
sudo chown ubuntu:ubuntu /srv/shero-backend
mkdir -p /srv/shero-backend/uploads/{sft-decks,sft-videos,sft-practice,learning-media}

# ── Nginx config ──────────────────────────────────────────────────────────────
echo "--- Configuring Nginx ---"
sudo tee /etc/nginx/sites-available/shero-backend > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;     # Replace with your domain after DNS setup

    client_max_body_size 50M;

    location / {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check (no auth)
    location /health {
        proxy_pass http://127.0.0.1:4000/health;
        access_log off;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/shero-backend /etc/nginx/sites-enabled/shero-backend
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

# ── Firewall ──────────────────────────────────────────────────────────────────
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# ── Environment file placeholder ─────────────────────────────────────────────
if [ ! -f /srv/shero-backend/.env ]; then
  cat > /srv/shero-backend/.env <<'ENV'
# Fill in all values before starting the app
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://your-frontend-domain.com
JWT_SECRET=CHANGE_ME
DATABASE_URL=postgresql://shero_user:CHANGE_ME@your-rds-endpoint:5432/shero?schema=public&sslmode=require
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_SFT_DECKS=shero-sft-decks
AWS_S3_BUCKET_SFT_VIDEOS=shero-sft-videos
AWS_S3_BUCKET_SFT_PRACTICE=shero-sft-practice
AWS_S3_BUCKET_LEARNING_MEDIA=shero-learning-media
AWS_S3_SIGNED_URL_TTL=3600
AWS_SES_FROM_ADDRESS=noreply@notify.shero.in
AWS_SES_FROM_NAME=Shero Training
EMAIL_PROVIDER=ses
REDIS_URL=redis://your-elasticache-endpoint:6379
STORAGE_MODE=s3
PUBLIC_SITE_URL=https://your-frontend-domain.com
BCRYPT_ROUNDS=12
ENV
  echo ".env placeholder created — fill it in before deploying"
fi

echo ""
echo "=== Server setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit /srv/shero-backend/.env with all production values"
echo "  2. Run the deploy script from your local machine:"
echo "     EC2_HOST=<this-host> EC2_KEY=./shero-prod-key.pem bash infra/aws/deploy.sh"
echo "  3. (Optional) Add SSL: certbot --nginx -d api.shero.in"
