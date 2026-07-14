import { Resend } from 'resend';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { prisma } from './prisma';
import { randomBytes } from 'crypto';

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'resend';
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || process.env.AWS_SES_FROM_ADDRESS || 'noreply@shero.in';
const FROM_NAME    = process.env.EMAIL_FROM_NAME    || process.env.AWS_SES_FROM_NAME    || 'Shero Training';

// ── Resend (default) ──────────────────────────────────────────────────────────

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY not configured');
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// ── SES (alternate production option) ─────────────────────────────────────────

let sesClient: SESClient | null = null;
function getSES(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return sesClient;
}

// ── Send email ────────────────────────────────────────────────────────────────

interface SendEmailOptions {
  to:       string;
  subject:  string;
  html:     string;
  text?:    string;
  messageId?: string;
  templateName?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const { to, subject, html, text, messageId, templateName } = opts;

  const logId = messageId || `msg-${Date.now()}`;
  // Subject/html/text are kept alongside the log entry so a failed or
  // suppressed send can actually be resent later (see /api/admin/email-log)
  // instead of just recording that something went wrong.
  const metadata = { subject, html, text: text ?? null };

  // Check suppression list
  const suppressed = await prisma.suppressedEmail.findUnique({
    where: { email: to.toLowerCase() },
  });
  if (suppressed) {
    console.log(`[email] Suppressed: ${to}`);
    await prisma.emailSendLog.create({
      data: {
        messageId: logId,
        templateName: templateName || 'unknown',
        recipientEmail: to,
        status: 'suppressed',
        metadata,
      },
    });
    return;
  }

  // Log as pending
  await prisma.emailSendLog.create({
    data: {
      messageId: logId,
      templateName: templateName || 'unknown',
      recipientEmail: to,
      status: 'pending',
      metadata,
    },
  });

  try {
    if (EMAIL_PROVIDER === 'ses') {
      await sendViaSES({ to, subject, html, text: text || '' });
    } else {
      await sendViaResend({ to, subject, html, text: text || '' });
    }

    await prisma.emailSendLog.updateMany({
      where: { messageId: logId },
      data: { status: 'sent' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.emailSendLog.updateMany({
      where: { messageId: logId },
      data: { status: 'failed', errorMessage: msg },
    });
    throw err;
  }
}

async function sendViaResend(opts: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const { data, error } = await getResend().emails.send({
    from:    `${FROM_NAME} <${FROM_ADDRESS}>`,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text,
  });
  if (error) throw new Error(error.message);
  console.log('[email] Resend id:', data?.id);
}

async function sendViaSES(opts: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const boundary = `----=_Part_${Date.now().toString(36)}`;
  const raw = [
    `From: "${FROM_NAME}" <${FROM_ADDRESS}>`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    opts.text,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    opts.html,
    ``,
    `--${boundary}--`,
  ].join('\r\n');

  await getSES().send(new SendRawEmailCommand({
    RawMessage: { Data: Buffer.from(raw) },
  }));
}

// ── Unsubscribe token helpers ─────────────────────────────────────────────────

export async function getOrCreateUnsubscribeToken(email: string): Promise<string> {
  const normalized = email.toLowerCase();
  const existing = await prisma.emailUnsubscribeToken.findUnique({
    where: { email: normalized },
  });
  if (existing && !existing.usedAt) return existing.token;

  const token = randomBytes(32).toString('hex');
  await prisma.emailUnsubscribeToken.upsert({
    where:  { email: normalized },
    create: { email: normalized, token },
    update: { token, usedAt: null },
  });
  return token;
}

export async function suppressEmail(email: string, reason?: string): Promise<void> {
  await prisma.suppressedEmail.upsert({
    where:  { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), reason },
    update: {},
  });
}

export function buildUnsubscribeUrl(token: string): string {
  const base = process.env.PUBLIC_SITE_URL || 'http://localhost:5173';
  return `${base}/unsubscribe?token=${token}`;
}
