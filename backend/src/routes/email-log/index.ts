// Admin — Email Delivery Log: every email dispatched via sendEmail()
// (invites, OTPs, certificates, etc.), with counts, filters, and a manual
// resend for failed/suppressed deliveries. Reuses the same
// sft_partner_payments permission as Partner Payments rather than adding a
// new permission key, since this panel lives alongside it.
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { sendEmail } from '../../lib/email';

export const emailLogRoutes = Router();

const requireEmailLog = requirePermission('sft_partner_payments');

const WINDOW_MS: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function serialize(r: {
  id: string; messageId: string | null; templateName: string; recipientEmail: string;
  status: string; errorMessage: string | null; createdAt: Date;
}) {
  return {
    id: r.id,
    message_id: r.messageId,
    template_name: r.templateName,
    recipient_email: r.recipientEmail,
    status: r.status,
    error_message: r.errorMessage,
    created_at: r.createdAt,
  };
}

// ── GET / — list + counts, filterable by window/template/status/recipient ──

emailLogRoutes.get('/', requireAuth, requireEmailLog, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const window = String(req.query.window ?? '7d');
    const since = new Date(Date.now() - (WINDOW_MS[window] ?? WINDOW_MS['7d']));
    const template = req.query.template ? String(req.query.template) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const search = req.query.search ? String(req.query.search).trim().toLowerCase() : undefined;

    const where = {
      createdAt: { gte: since },
      ...(template ? { templateName: template } : {}),
      ...(status ? { status } : {}),
      ...(search ? { recipientEmail: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total, sent, failed, suppressed, pending, templates] = await Promise.all([
      prisma.emailSendLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.emailSendLog.count({ where }),
      prisma.emailSendLog.count({ where: { ...where, status: 'sent' } }),
      prisma.emailSendLog.count({ where: { ...where, status: 'failed' } }),
      prisma.emailSendLog.count({ where: { ...where, status: 'suppressed' } }),
      prisma.emailSendLog.count({ where: { ...where, status: 'pending' } }),
      prisma.emailSendLog.findMany({
        distinct: ['templateName'],
        select: { templateName: true },
        orderBy: { templateName: 'asc' },
      }),
    ]);

    res.json({
      counts: { total, sent, failed, suppressed, pending },
      templates: templates.map(t => t.templateName),
      rows: rows.map(serialize),
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /:id/resend — replay a stored send with the exact same content ────

emailLogRoutes.post('/:id/resend', requireAuth, requireEmailLog, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const log = await prisma.emailSendLog.findUnique({ where: { id: req.params.id } });
    if (!log) {
      res.status(404).json({ error: 'Email log entry not found' });
      return;
    }
    const meta = (log.metadata ?? {}) as { subject?: string; html?: string; text?: string | null };
    if (!meta.subject || !meta.html) {
      res.status(400).json({ error: 'No stored content available to resend for this entry' });
      return;
    }

    await sendEmail({
      to: log.recipientEmail,
      subject: meta.subject,
      html: meta.html,
      text: meta.text ?? undefined,
      templateName: log.templateName,
      messageId: `${log.messageId ?? log.id}-resend-${Date.now()}`,
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
