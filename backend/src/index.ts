import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

import { errorHandler } from './middleware/error-handler';
import { runStartupMigrations } from './lib/startup-migrations';
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { sftRoutes } from './routes/sft';
import { learningRoutes } from './routes/learning';
import { partnerRoutes } from './routes/partner';
import { foodcostRoutes } from './routes/foodcost';
import { emailRoutes } from './routes/email';
import { publicRoutes } from './routes/public';
import { ttsRoutes } from './routes/tts';
import { configRoutes } from './routes/config';
import { storageUploadRoutes } from './routes/storage';
import { notificationsRoutes } from './routes/notifications';
import { partnerPaymentsRoutes } from './routes/partner-payments';
import { partnerPaymentsWebhookRoutes } from './routes/partner-payments-webhook';
import { partnerLoginRoutes } from './routes/partner-login';
import { emailLogRoutes } from './routes/email-log';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security ──────────────────────────────────────────────────
app.use(helmet());
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const isDev = process.env.NODE_ENV !== 'production';

app.use(cors({
  origin: isDev ? /^http:\/\/localhost:\d+$/ : FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Logging ───────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Body Parsing ──────────────────────────────────────────────
// ── Body Parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Unwrap { data: {...} } wrapper from frontend ──────────────
app.use((req, _res, next) => {
  if (
    req.body &&
    typeof req.body === 'object' &&
    req.body.data &&
    typeof req.body.data === 'object' &&
    !Array.isArray(req.body.data)
  ) {
    req.body = req.body.data;
  }
  next();
});

// ── Static uploads (dev only) ─────────────────────────────────
// ── Static uploads (dev only) ─────────────────────────────────
if (process.env.STORAGE_MODE === 'local') {
  app.use('/uploads', express.static(process.env.LOCAL_UPLOAD_DIR || './uploads'));
}

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, ts: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/sft',       sftRoutes);
app.use('/api/learning',  learningRoutes);
app.use('/api/partner',   partnerRoutes);
app.use('/api/foodcost',  foodcostRoutes);
app.use('/api/email',     emailRoutes);
app.use('/api/tts',       ttsRoutes);
app.use('/api/public',    publicRoutes);   // token-gated, no JWT
app.use('/api/config',    configRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin/partner-payments', partnerPaymentsRoutes);
app.use('/api/partner-payments', partnerPaymentsWebhookRoutes);   // public, no JWT — webhook only
app.use('/api/partner-login', partnerLoginRoutes);
app.use('/api/admin/email-log', emailLogRoutes);
if (process.env.STORAGE_MODE === 'local') {
  app.use('/api/storage/upload', storageUploadRoutes);
}

// ── Error Handler ─────────────────────────────────────────────
app.use(errorHandler);

runStartupMigrations()
  .catch(e => console.error('[startup-migrations] failed', e))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Shero Backend running on http://localhost:${PORT}`);
      console.log(`   ENV: ${process.env.NODE_ENV}`);
      console.log(`   Storage: ${process.env.STORAGE_MODE || 'local'}`);
      console.log(`   Email: ${process.env.EMAIL_PROVIDER || 'resend'}`);
    });
  });

export default app;
