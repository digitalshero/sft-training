#!/usr/bin/env bash
# =============================================================
# Shero — Database Migration Helper
# Run locally against production RDS through an SSH tunnel,
# or directly on the EC2 instance.
# =============================================================

set -euo pipefail

COMMAND="${1:-status}"      # status | migrate | seed | studio | reset
EC2_HOST="${EC2_HOST:-}"
EC2_KEY="${EC2_KEY:-}"

# ── If EC2_HOST provided, run remotely via SSH ────────────────────────────────
if [ -n "$EC2_HOST" ] && [ -n "$EC2_KEY" ]; then
  echo "=== Running '$COMMAND' on $EC2_HOST ==="
  ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "ubuntu@$EC2_HOST" bash <<REMOTE
    export PATH="/home/ubuntu/.nvm/versions/node/\$(ls ~/.nvm/versions/node | sort -V | tail -1)/bin:\$PATH"
    cd /srv/shero-backend
    source .env 2>/dev/null || true

    case "$COMMAND" in
      status)  npx prisma migrate status  ;;
      migrate) npx prisma migrate deploy  ;;
      seed)    npx ts-node prisma/seed.ts ;;
      studio)  echo "Prisma Studio is only available locally. Use an SSH tunnel." ;;
      reset)
        echo "WARNING: This will DROP all data! Type 'yes' to continue:"
        read -r confirm
        [ "\$confirm" = "yes" ] || exit 1
        npx prisma migrate reset --force
        ;;
      *)
        echo "Unknown command: $COMMAND"
        echo "Usage: bash infra/aws/db.sh [status|migrate|seed|studio|reset]"
        exit 1
        ;;
    esac
REMOTE
  exit 0
fi

# ── Local run ─────────────────────────────────────────────────────────────────
echo "=== Running '$COMMAND' locally ==="

case "$COMMAND" in
  status)  npx prisma migrate status  ;;
  migrate) npx prisma migrate dev     ;;
  seed)    npx ts-node prisma/seed.ts ;;
  studio)  npx prisma studio          ;;
  reset)
    echo "WARNING: Drops all local data!"
    npx prisma migrate reset
    ;;
  *)
    echo "Usage: bash infra/aws/db.sh [status|migrate|seed|studio|reset]"
    exit 1
    ;;
esac
