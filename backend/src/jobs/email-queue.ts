import Bull from 'bull';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export interface EmailJobData {
  messageId:     string;
  to:            string;
  subject:       string;
  html:          string;
  text?:         string;
  templateName?: string;
}

// ── Create queue ──────────────────────────────────────────────────────────────

export const emailQueue = new Bull<EmailJobData>('email', REDIS_URL, {
  defaultJobOptions: {
    attempts:     5,
    backoff:      { type: 'exponential', delay: 10_000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// ── Processor ─────────────────────────────────────────────────────────────────

emailQueue.process(async (job) => {
  const { messageId, to, subject, html, text, templateName } = job.data;
  console.log(`[email-queue] Processing ${messageId} → ${to}`);

  await prisma.emailQueue.updateMany({
    where: { messageId },
    data:  { status: 'processing', lastAttemptAt: new Date(), attempts: { increment: 1 } },
  });

  try {
    await sendEmail({ to, subject, html, text, templateName, messageId });
    await prisma.emailQueue.updateMany({ where: { messageId }, data: { status: 'sent' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (job.attemptsMade >= (job.opts.attempts ?? 5) - 1) {
      await prisma.emailQueue.updateMany({ where: { messageId }, data: { status: 'dead' } });
    } else {
      await prisma.emailQueue.updateMany({ where: { messageId }, data: { status: 'failed' } });
    }
    throw new Error(msg); // let Bull retry
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function enqueueEmail(data: EmailJobData, delay?: number): Promise<void> {
  await prisma.emailQueue.create({
    data: {
      messageId: data.messageId,
      payload:   data as unknown as Prisma.InputJsonValue,
      status:    'pending',
      processAfter: delay ? new Date(Date.now() + delay) : new Date(),
    },
  });
  await emailQueue.add(data, { delay, jobId: data.messageId });
}

// ── Event logging ─────────────────────────────────────────────────────────────

emailQueue.on('failed', (job, err) => {
  console.error(`[email-queue] Job ${job.id} failed (attempt ${job.attemptsMade}): ${err.message}`);
});

emailQueue.on('completed', (job) => {
  console.log(`[email-queue] Job ${job.id} completed`);
});

export default emailQueue;
