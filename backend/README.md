# Shero Training Centre — Backend

Node.js + Express + TypeScript + Prisma + AWS

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, TypeScript |
| Framework | Express 4 |
| ORM | Prisma 5 (PostgreSQL) |
| Auth | JWT (access + refresh tokens) |
| Storage | AWS S3 (prod) / local disk (dev) |
| Email | AWS SES (prod) / Mailtrap SMTP (dev) |
| Job queue | Bull + Redis |
| TTS proxy | OpenAI TTS API |
| Dev DB | Local PostgreSQL |
| Prod DB | AWS RDS PostgreSQL 16 |
| Prod cache | AWS ElastiCache Redis 7 |
| Hosting | EC2 (Ubuntu 24) + Nginx + PM2 |
| CI/CD | GitHub Actions |

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ running locally
- Redis running locally (for job queues)
- An OpenAI API key (for TTS)

### Setup

```bash
# 1. Clone and install
npm install

# 2. Copy env file and fill in values
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, SMTP_*, OPENAI_API_KEY

# 3. Generate Prisma client
npx prisma generate

# 4. Run migrations (creates all tables)
npx prisma migrate dev --name init

# 5. Seed the database (units, super admin)
npx ts-node prisma/seed.ts

# 6. Start dev server (hot reload)
npm run dev
```

The API is now at `http://localhost:4000`. Test it:
```bash
curl http://localhost:4000/health
```

Default super admin:
- Email: `admin@shero.in`
- Password: `ChangeMe123!`  ← change immediately

---

## Environment Variables

See [`.env.example`](./.env.example) for all variables and their descriptions.

Key groups:

| Group | Variables |
|---|---|
| Server | `NODE_ENV`, `PORT`, `FRONTEND_URL` |
| JWT | `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` |
| Database | `DATABASE_URL` |
| AWS | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| S3 buckets | `AWS_S3_BUCKET_SFT_DECKS`, `…_VIDEOS`, `…_PRACTICE`, `…_LEARNING_MEDIA` |
| Email | `EMAIL_PROVIDER` (smtp\|ses), `SMTP_*` or `AWS_SES_*` |
| Storage | `STORAGE_MODE` (local\|s3), `LOCAL_UPLOAD_DIR` |
| Redis | `REDIS_URL` |
| OpenAI | `OPENAI_API_KEY` (partner cook-photo validation) |
| ElevenLabs | `ELEVENLABS_API_KEY` (slide narration voice generation) |

---

## API Routes

### Auth  `/api/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/signup` | Register user |
| POST | `/signin` | Login → access + refresh tokens |
| POST | `/refresh` | Rotate refresh token |
| POST | `/signout` | Revoke refresh token |
| GET | `/me` | Current user profile |
| GET | `/permissions` | Roles + permission keys |
| POST | `/forgot-password` | Send password reset email |
| POST | `/reset-password` | Set new password via token |
| PUT | `/update-password` | Change password (authenticated) |

### Admin  `/api/admin`  _(super_admin only)_
| Method | Path | Description |
|---|---|---|
| GET | `/users` | List all users |
| POST | `/users` | Create user |
| DELETE | `/users/:id` | Delete user |
| PUT | `/users/:id/permissions` | Set roles + permission keys |
| POST | `/users/:id/reset-password` | Force password reset |

### SFT Training  `/api/sft`
Programs, courses, modules, days, decks, invites, review queue, submissions, certificates, physical visits, resources, videos, tasks.

### Learning  `/api/learning`
Enrolments, course state, module progress/completion, quizzes, product submissions, certificates, cuisines, recipes, sample image guide, quiz bank.

### Partner  `/api/partner`
Dashboard (self-heal), tasks, resources (signed), videos (signed), cuisine selection, cook assignments (signed), physical visit status.

### Food Cost  `/api/foodcost`
Units, brands, categories, ingredients (with price history), packing containers, products, preps, recipes, recipe versions, recipe items, price lists, price list items, approval log.

### Public (token-gated)  `/api/public`
Physical visit portal: view data, upload photos, delete photos, submit form, receive Google Form webhook.

### Config  `/api/config`
Site config entries, FAQ entries.

### Email  `/api/email`
Unsubscribe (via token), suppress email.

### TTS  `/api/tts`
Proxy to OpenAI TTS with auto-chunking for long text.

---

## AWS Setup

### Step 1 — Bootstrap AWS infrastructure

```bash
export AWS_PROFILE=shero-prod
export AWS_REGION=ap-south-1
export DB_PASSWORD="YourStrongPasswordHere"

bash infra/aws/bootstrap.sh
```

This creates:
- **VPC** with public + private subnets across 2 AZs
- **RDS** PostgreSQL 16 (db.t3.micro, 20GB gp3, encrypted)
- **S3 buckets** × 4 (all private, encrypted, CORS-enabled)
- **ElastiCache** Redis 7 (cache.t3.micro)
- **IAM user** with scoped S3 + SES permissions
- **Security groups** (app, db, redis — least-privilege)

Wait for RDS to be available (~10 min):
```bash
aws rds wait db-instance-available --db-instance-identifier shero-prod-db
```

Get the RDS endpoint:
```bash
aws rds describe-db-instances \
  --db-instance-identifier shero-prod-db \
  --query 'DBInstances[0].Endpoint.Address' --output text
```

### Step 2 — Provision EC2

Launch an EC2 instance (Ubuntu 24, t3.small minimum) in the **public subnet** created by bootstrap.sh, attach the `shero-prod-app-sg` security group and the key pair `shero-prod-key`.

Then SSH in and run the server setup script:
```bash
ssh -i shero-prod-key.pem ubuntu@<EC2_HOST>
bash /tmp/ec2-setup.sh   # copy the file first
```

Edit the `.env` on the server:
```bash
nano /srv/shero-backend/.env
```

Fill in all values: `DATABASE_URL` (with RDS endpoint), `JWT_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `REDIS_URL` (ElastiCache endpoint), etc.

### Step 3 — First deploy

```bash
# From your local machine
EC2_HOST=<EC2_PUBLIC_IP_OR_DNS> \
EC2_KEY=./shero-prod-key.pem \
bash infra/aws/deploy.sh
```

### Step 4 — Run migrations + seed

```bash
EC2_HOST=<EC2_HOST> EC2_KEY=./shero-prod-key.pem \
bash infra/aws/db.sh migrate

EC2_HOST=<EC2_HOST> EC2_KEY=./shero-prod-key.pem \
bash infra/aws/db.sh seed
```

### Step 5 — SSL (optional but recommended)

```bash
ssh -i shero-prod-key.pem ubuntu@<EC2_HOST>
sudo certbot --nginx -d api.shero.in
```

Copy `infra/aws/nginx-ssl.conf` to `/etc/nginx/sites-available/shero-backend` for the full SSL config.

---

## CI/CD

Add these secrets to your GitHub repo (`Settings → Secrets → Actions`):

| Secret | Value |
|---|---|
| `EC2_HOST` | EC2 public IP or DNS |
| `EC2_SSH_KEY` | Contents of `shero-prod-key.pem` |

Every push to `main` will automatically build, sync, migrate, and restart the app.

Manual deploy:
```bash
EC2_HOST=<HOST> EC2_KEY=./key.pem bash infra/aws/deploy.sh
```

---

## Database Operations

```bash
# Check migration status (remote)
EC2_HOST=<HOST> EC2_KEY=./key.pem bash infra/aws/db.sh status

# Run pending migrations (remote)
EC2_HOST=<HOST> EC2_KEY=./key.pem bash infra/aws/db.sh migrate

# Create a manual RDS snapshot before a big deploy
bash infra/aws/snapshot.sh

# Open Prisma Studio locally (dev only)
bash infra/aws/db.sh studio
```

---

## S3 Bucket Summary

| Bucket | Content | Used by |
|---|---|---|
| `shero-sft-decks` | Training slide decks (PPTX/PDF) | Module deck uploads |
| `shero-sft-videos` | Trainer/brand videos | Partner hub videos |
| `shero-sft-practice` | Partner product photos | Submissions + physical visits |
| `shero-learning-media` | Recipe images, sample guides | Recipe image, sample guide |

All buckets are **private** — files are served via short-lived signed URLs (default 1h TTL).

---

## Permission Keys

| Key | Access |
|---|---|
| `sft_course_builder` | Create/edit courses and modules |
| `sft_invite_review` | Review partner submissions |
| `foodcost_dashboard` | View food cost module |
| `foodcost_in` | Edit INR food cost data |
| `foodcost_us` | Edit USD food cost data |
| `team_guide` | Access team guide section |

`super_admin` role bypasses all permission checks.

---

## Project Structure

```
shero-backend/
├── prisma/
│   ├── schema.prisma       ← Full Prisma schema (mirrors Supabase)
│   └── seed.ts             ← Seed data (units, admin user)
├── src/
│   ├── index.ts            ← Express app entry point
│   ├── lib/
│   │   ├── prisma.ts       ← Prisma client singleton
│   │   ├── jwt.ts          ← Token sign/verify
│   │   ├── storage.ts      ← S3 / local dual-mode
│   │   └── email.ts        ← SMTP / SES + suppression
│   ├── middleware/
│   │   ├── auth.ts         ← requireAuth, requireEditor, requirePermission
│   │   └── error-handler.ts
│   ├── routes/
│   │   ├── auth/           ← Sign in/up, refresh, reset password
│   │   ├── admin/          ← User + permission management
│   │   ├── sft/            ← Courses, invites, review, certificates
│   │   ├── learning/       ← Enrolments, modules, quizzes, submissions
│   │   ├── partner/        ← Partner dashboard + hub
│   │   ├── foodcost/       ← FC brands → price lists
│   │   ├── email/          ← Unsubscribe, suppression
│   │   ├── public/         ← Physical visit portal (no JWT)
│   │   ├── tts/            ← OpenAI TTS proxy
│   │   ├── config/         ← Site config + FAQs
│   │   └── storage/        ← Local dev upload endpoint
│   ├── services/
│   │   └── email-dispatch.ts ← Partner invite + physical visit emails
│   └── jobs/
│       └── email-queue.ts  ← Bull queue worker
├── infra/aws/
│   ├── bootstrap.sh        ← Provision VPC, RDS, S3, Redis, IAM
│   ├── ec2-setup.sh        ← Fresh EC2 Node/Nginx/PM2 setup
│   ├── deploy.sh           ← rsync + remote migrate + PM2 reload
│   ├── db.sh               ← Migration helper (local + remote)
│   ├── snapshot.sh         ← Manual RDS snapshot + prune
│   └── nginx-ssl.conf      ← Production Nginx SSL config
├── .github/workflows/
│   └── deploy.yml          ← GitHub Actions auto-deploy on push to main
├── ecosystem.config.js     ← PM2 cluster config
├── .env.example
├── tsconfig.json
└── package.json
```
