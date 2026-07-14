#!/usr/bin/env bash
# =============================================================
# Shero — RDS Snapshot Script
# Creates a manual snapshot of the production RDS instance.
# Safe to run any time; run before major deploys.
# =============================================================

set -euo pipefail

DB_INSTANCE="${DB_INSTANCE_ID:-shero-prod-db}"
REGION="${AWS_REGION:-ap-south-1}"
SNAP_ID="${DB_INSTANCE}-$(date +%Y%m%d-%H%M)"

echo "Creating RDS snapshot: $SNAP_ID"
aws rds create-db-snapshot \
  --db-instance-identifier "$DB_INSTANCE" \
  --db-snapshot-identifier  "$SNAP_ID" \
  --region "$REGION" \
  --tags "Key=Type,Value=manual" "Key=App,Value=shero"

echo "Waiting for snapshot to complete…"
aws rds wait db-snapshot-completed \
  --db-snapshot-identifier "$SNAP_ID" \
  --region "$REGION"

echo "✅ Snapshot complete: $SNAP_ID"

# ── Prune old manual snapshots (keep last 10) ─────────────────────────────────
echo "Pruning old manual snapshots…"
OLD_SNAPS=$(aws rds describe-db-snapshots \
  --db-instance-identifier "$DB_INSTANCE" \
  --snapshot-type manual \
  --region "$REGION" \
  --query 'DBSnapshots | sort_by(@, &SnapshotCreateTime) | [:-10].DBSnapshotIdentifier' \
  --output text)

for SNAP in $OLD_SNAPS; do
  echo "  Deleting: $SNAP"
  aws rds delete-db-snapshot --db-snapshot-identifier "$SNAP" --region "$REGION" > /dev/null
done

echo "Done"
