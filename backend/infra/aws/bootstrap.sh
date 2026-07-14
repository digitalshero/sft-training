#!/usr/bin/env bash
# =============================================================
# Shero Backend — AWS Infrastructure Bootstrap Script
# Run once to provision all AWS resources.
# Prerequisites: AWS CLI v2, jq, a configured profile with
#                AdministratorAccess or equivalent.
# Usage:
#   export AWS_PROFILE=shero-prod
#   export AWS_REGION=ap-south-1
#   bash infra/aws/bootstrap.sh
# =============================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
APP_NAME="shero"
ENV="${DEPLOY_ENV:-prod}"
REGION="${AWS_REGION:-ap-south-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

DB_INSTANCE_ID="${APP_NAME}-${ENV}-db"
DB_NAME="shero"
DB_USER="shero_user"
DB_PASS="${DB_PASSWORD:?Set DB_PASSWORD env var}"   # never hardcode

EC2_KEY_PAIR="${APP_NAME}-${ENV}-key"
VPC_CIDR="10.0.0.0/16"

echo "=== Shero AWS Bootstrap ==="
echo "    App:     ${APP_NAME}-${ENV}"
echo "    Region:  ${REGION}"
echo "    Account: ${ACCOUNT_ID}"
echo ""

# ── VPC ───────────────────────────────────────────────────────────────────────
echo "--- VPC ---"
VPC_ID=$(aws ec2 create-vpc --cidr-block "$VPC_CIDR" --region "$REGION" \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${APP_NAME}-${ENV}-vpc}]" \
  --query 'Vpc.VpcId' --output text)
echo "VPC: $VPC_ID"

aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames
aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-support

# Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway --region "$REGION" \
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${APP_NAME}-${ENV}-igw}]" \
  --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID"
echo "IGW: $IGW_ID"

# Two public subnets (different AZs for RDS subnet group)
AZ1="${REGION}a"
AZ2="${REGION}b"

SUBNET_PUB1=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block "10.0.1.0/24" \
  --availability-zone "$AZ1" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-${ENV}-pub-1a}]" \
  --query 'Subnet.SubnetId' --output text)
SUBNET_PUB2=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block "10.0.2.0/24" \
  --availability-zone "$AZ2" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-${ENV}-pub-1b}]" \
  --query 'Subnet.SubnetId' --output text)

# Two private subnets for RDS
SUBNET_PRIV1=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block "10.0.11.0/24" \
  --availability-zone "$AZ1" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-${ENV}-priv-1a}]" \
  --query 'Subnet.SubnetId' --output text)
SUBNET_PRIV2=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block "10.0.12.0/24" \
  --availability-zone "$AZ2" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-${ENV}-priv-1b}]" \
  --query 'Subnet.SubnetId' --output text)

echo "Subnets: pub=$SUBNET_PUB1,$SUBNET_PUB2  priv=$SUBNET_PRIV1,$SUBNET_PRIV2"

# Route table for public subnets
RT_ID=$(aws ec2 create-route-table --vpc-id "$VPC_ID" --region "$REGION" \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${APP_NAME}-${ENV}-public-rt}]" \
  --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id "$RT_ID" --destination-cidr-block "0.0.0.0/0" \
  --gateway-id "$IGW_ID" > /dev/null
aws ec2 associate-route-table --route-table-id "$RT_ID" --subnet-id "$SUBNET_PUB1" > /dev/null
aws ec2 associate-route-table --route-table-id "$RT_ID" --subnet-id "$SUBNET_PUB2" > /dev/null

# ── Security Groups ───────────────────────────────────────────────────────────
echo "--- Security Groups ---"

# App SG: inbound 4000 (API) + 22 (SSH); outbound all
SG_APP=$(aws ec2 create-security-group --group-name "${APP_NAME}-${ENV}-app-sg" \
  --description "Shero app server" --vpc-id "$VPC_ID" \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id "$SG_APP" \
  --ip-permissions \
    "IpProtocol=tcp,FromPort=4000,ToPort=4000,IpRanges=[{CidrIp=0.0.0.0/0,Description=API}]" \
    "IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0,Description=HTTP}]" \
    "IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0,Description=HTTPS}]" \
    "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=0.0.0.0/0,Description=SSH}]" \
    > /dev/null
echo "App SG: $SG_APP"

# DB SG: inbound 5432 from app SG only
SG_DB=$(aws ec2 create-security-group --group-name "${APP_NAME}-${ENV}-db-sg" \
  --description "Shero RDS PostgreSQL" --vpc-id "$VPC_ID" \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id "$SG_DB" \
  --ip-permissions "IpProtocol=tcp,FromPort=5432,ToPort=5432,UserIdGroupPairs=[{GroupId=${SG_APP},Description=AppToRDS}]" \
  > /dev/null
echo "DB SG: $SG_DB"

# ── RDS PostgreSQL ────────────────────────────────────────────────────────────
echo "--- RDS ---"

aws rds create-db-subnet-group \
  --db-subnet-group-name "${APP_NAME}-${ENV}-subnet-group" \
  --db-subnet-group-description "Shero RDS subnet group" \
  --subnet-ids "$SUBNET_PRIV1" "$SUBNET_PRIV2" > /dev/null

aws rds create-db-parameter-group \
  --db-parameter-group-name "${APP_NAME}-${ENV}-pg16" \
  --db-parameter-group-family "postgres16" \
  --description "Shero Postgres 16 params" > /dev/null

aws rds modify-db-parameter-group \
  --db-parameter-group-name "${APP_NAME}-${ENV}-pg16" \
  --parameters \
    "ParameterName=log_min_duration_statement,ParameterValue=1000,ApplyMethod=immediate" \
    "ParameterName=log_connections,ParameterValue=1,ApplyMethod=immediate" \
    "ParameterName=log_disconnections,ParameterValue=1,ApplyMethod=immediate" \
    "ParameterName=shared_preload_libraries,ParameterValue=pg_stat_statements,ApplyMethod=pending-reboot" \
    > /dev/null

aws rds create-db-instance \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --db-instance-class "db.t3.micro" \
  --engine "postgres" \
  --engine-version "16.3" \
  --master-username "$DB_USER" \
  --master-user-password "$DB_PASS" \
  --db-name "$DB_NAME" \
  --allocated-storage 20 \
  --max-allocated-storage 100 \
  --storage-type "gp3" \
  --storage-encrypted \
  --vpc-security-group-ids "$SG_DB" \
  --db-subnet-group-name "${APP_NAME}-${ENV}-subnet-group" \
  --db-parameter-group-name "${APP_NAME}-${ENV}-pg16" \
  --backup-retention-period 7 \
  --preferred-backup-window "02:00-03:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --enable-performance-insights \
  --performance-insights-retention-period 7 \
  --enable-cloudwatch-logs-exports "postgresql" \
  --deletion-protection \
  --no-publicly-accessible \
  --tags "Key=App,Value=${APP_NAME}" "Key=Env,Value=${ENV}" > /dev/null

echo "RDS instance created: $DB_INSTANCE_ID (provisioning in background)"
echo "Run: aws rds wait db-instance-available --db-instance-identifier $DB_INSTANCE_ID"

# ── S3 Buckets ────────────────────────────────────────────────────────────────
echo "--- S3 ---"

BUCKETS=(
  "${APP_NAME}-sft-decks"
  "${APP_NAME}-sft-videos"
  "${APP_NAME}-sft-practice"
  "${APP_NAME}-learning-media"
)

for BUCKET in "${BUCKETS[@]}"; do
  if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
    echo "   · $BUCKET already exists"
  else
    if [ "$REGION" = "us-east-1" ]; then
      aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" > /dev/null
    else
      aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
        --create-bucket-configuration LocationConstraint="$REGION" > /dev/null
    fi

    # Block all public access
    aws s3api put-public-access-block --bucket "$BUCKET" \
      --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
        > /dev/null

    # Server-side encryption
    aws s3api put-bucket-encryption --bucket "$BUCKET" \
      --server-side-encryption-configuration \
        '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
        > /dev/null

    # CORS for presigned upload
    aws s3api put-bucket-cors --bucket "$BUCKET" \
      --cors-configuration '{
        "CORSRules": [{
          "AllowedHeaders": ["*"],
          "AllowedMethods": ["GET","PUT","POST"],
          "AllowedOrigins": ["*"],
          "ExposeHeaders":  ["ETag"],
          "MaxAgeSeconds":  3000
        }]
      }' > /dev/null

    echo "   ✓ Created: $BUCKET"
  fi
done

# ── IAM user for app ──────────────────────────────────────────────────────────
echo "--- IAM ---"

IAM_USER="${APP_NAME}-${ENV}-app"
aws iam create-user --user-name "$IAM_USER" > /dev/null 2>&1 || true

# S3 policy
S3_POLICY_ARN=$(aws iam create-policy \
  --policy-name "${APP_NAME}-${ENV}-s3" \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Action\": [\"s3:GetObject\",\"s3:PutObject\",\"s3:DeleteObject\",\"s3:ListBucket\"],
      \"Resource\": [
        \"arn:aws:s3:::${APP_NAME}-sft-decks\",
        \"arn:aws:s3:::${APP_NAME}-sft-decks/*\",
        \"arn:aws:s3:::${APP_NAME}-sft-videos\",
        \"arn:aws:s3:::${APP_NAME}-sft-videos/*\",
        \"arn:aws:s3:::${APP_NAME}-sft-practice\",
        \"arn:aws:s3:::${APP_NAME}-sft-practice/*\",
        \"arn:aws:s3:::${APP_NAME}-learning-media\",
        \"arn:aws:s3:::${APP_NAME}-learning-media/*\"
      ]
    }]
  }" --query 'Policy.Arn' --output text 2>/dev/null || \
  aws iam list-policies --query "Policies[?PolicyName=='${APP_NAME}-${ENV}-s3'].Arn | [0]" --output text)

# SES policy
SES_POLICY_ARN=$(aws iam create-policy \
  --policy-name "${APP_NAME}-${ENV}-ses" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{"Effect":"Allow","Action":["ses:SendEmail","ses:SendRawEmail","ses:GetSendQuota","ses:GetSendStatistics"],"Resource":"*"}]
  }' --query 'Policy.Arn' --output text 2>/dev/null || \
  aws iam list-policies --query "Policies[?PolicyName=='${APP_NAME}-${ENV}-ses'].Arn | [0]" --output text)

aws iam attach-user-policy --user-name "$IAM_USER" --policy-arn "$S3_POLICY_ARN"
aws iam attach-user-policy --user-name "$IAM_USER" --policy-arn "$SES_POLICY_ARN"

# Create access keys
KEYS=$(aws iam create-access-key --user-name "$IAM_USER")
ACCESS_KEY=$(echo "$KEYS" | jq -r '.AccessKey.AccessKeyId')
SECRET_KEY=$(echo "$KEYS" | jq -r '.AccessKey.SecretAccessKey')

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  IAM ACCESS KEYS — SAVE THESE NOW (shown once only) ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  AWS_ACCESS_KEY_ID:     $ACCESS_KEY"
echo "║  AWS_SECRET_ACCESS_KEY: $SECRET_KEY"
echo "╚══════════════════════════════════════════════════════╝"

# ── SES Email Verification ────────────────────────────────────────────────────
echo "--- SES ---"
echo "Verifying sending domain (you'll need to add DNS records):"
aws sesv2 create-email-identity \
  --email-identity "notify.shero.in" \
  --region "$REGION" \
  --tags "Key=App,Value=${APP_NAME}" \
  --dkim-signing-attributes 'SigningAttributesOrigin=AWS_SES' \
  2>/dev/null || echo "   · Email identity may already exist"
echo "   Run 'aws sesv2 get-email-identity --email-identity notify.shero.in' to get DKIM DNS records"
echo "   Also submit a SES sandbox production access request in the AWS console."

# ── Redis (ElastiCache) ───────────────────────────────────────────────────────
echo "--- ElastiCache Redis ---"
SG_REDIS=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-${ENV}-redis-sg" \
  --description "Shero Redis" --vpc-id "$VPC_ID" \
  --query 'GroupId' --output text 2>/dev/null || echo "exists")

if [ "$SG_REDIS" != "exists" ]; then
  aws ec2 authorize-security-group-ingress --group-id "$SG_REDIS" \
    --ip-permissions "IpProtocol=tcp,FromPort=6379,ToPort=6379,UserIdGroupPairs=[{GroupId=${SG_APP}}]" \
    > /dev/null
fi

aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name "${APP_NAME}-${ENV}-redis-subnet" \
  --cache-subnet-group-description "Shero Redis subnet" \
  --subnet-ids "$SUBNET_PRIV1" "$SUBNET_PRIV2" > /dev/null 2>&1 || true

aws elasticache create-cache-cluster \
  --cache-cluster-id "${APP_NAME}-${ENV}-redis" \
  --engine redis \
  --engine-version "7.1" \
  --cache-node-type "cache.t3.micro" \
  --num-cache-nodes 1 \
  --cache-subnet-group-name "${APP_NAME}-${ENV}-redis-subnet" \
  --security-group-ids "$SG_REDIS" \
  --region "$REGION" > /dev/null
echo "ElastiCache Redis cluster created: ${APP_NAME}-${ENV}-redis"

# ── EC2 Key Pair ──────────────────────────────────────────────────────────────
echo "--- EC2 Key Pair ---"
aws ec2 create-key-pair \
  --key-name "$EC2_KEY_PAIR" \
  --query 'KeyMaterial' \
  --output text > "${EC2_KEY_PAIR}.pem" 2>/dev/null || echo "   · Key pair already exists"
chmod 400 "${EC2_KEY_PAIR}.pem" 2>/dev/null || true
echo "   Key saved to: ${EC2_KEY_PAIR}.pem"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  BOOTSTRAP COMPLETE — next steps:                                   ║"
echo "║  1. Wait for RDS: aws rds wait db-instance-available ...            ║"
echo "║  2. Get RDS endpoint from AWS Console or:                           ║"
echo "║     aws rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID ║"
echo "║  3. Update .env DATABASE_URL with RDS endpoint + password           ║"
echo "║  4. Update .env AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY           ║"
echo "║  5. Update .env REDIS_URL with ElastiCache endpoint                 ║"
echo "║  6. Deploy the app: see infra/aws/deploy.sh                         ║"
echo "║  7. Run migrations: npx prisma migrate deploy                       ║"
echo "║  8. Run seed: npx ts-node prisma/seed.ts                            ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
