import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { suppressEmail } from '../../lib/email';

export const emailRoutes = Router();

// ── GET /api/email/unsubscribe?token=... ──────────────────────────────────────

emailRoutes.get('/unsubscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) { res.status(400).json({ error: 'Token required' }); return; }

    const record = await prisma.emailUnsubscribeToken.findUnique({ where: { token } });
    if (!record) { res.status(400).json({ error: 'Invalid unsubscribe token' }); return; }
    if (record.usedAt) { res.json({ ok: true, already: true, email: record.email }); return; }

    await suppressEmail(record.email, 'user_unsubscribe');
    await prisma.emailUnsubscribeToken.update({
      where: { id: record.id },
      data:  { usedAt: new Date() },
    });

    res.json({ ok: true, email: record.email });
  } catch (e) { next(e); }
});

// ── POST /api/email/suppress ──────────────────────────────────────────────────
// (internal use — admin can mark an email as suppressed)

emailRoutes.post('/suppress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, reason } = req.body as { email: string; reason?: string };
    await suppressEmail(email, reason);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
