
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { processPaidPayment } from '../../services/partner-payment-processing';

export const partnerPaymentsWebhookRoutes = Router();

// ── POST /webhook — payment provider notification ──────────────────────────
// Upserts by payment_id so repeat/retry deliveries are safe, and only ever
// triggers the invite email once per payment (see processPaidPayment).

partnerPaymentsWebhookRoutes.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expectedSecret = process.env.PARTNER_PAYMENTS_WEBHOOK_SECRET;
    const providedSecret = req.header('x-webhook-secret');
    if (!expectedSecret || providedSecret !== expectedSecret) {
      res.status(401).json({ error: 'Invalid webhook secret' });
      return;
    }

    const b = req.body as Record<string, unknown>;
    const externalPartnerId = b.partner_id != null ? String(b.partner_id).trim() : null;
    const partnerName = String(b.partner_name ?? '').trim();
    const partnerEmail = String(b.partner_email ?? '').trim().toLowerCase();
    const paymentId = String(b.payment_id ?? '').trim();
    const amount = Number(b.amount ?? 0);
    const paymentStatus = String(b.payment_status ?? '').toLowerCase() === 'paid' ? 'paid' : 'unpaid';
    if (!partnerName || !partnerEmail || !paymentId) {
      res.status(400).json({ error: 'partner_name, partner_email, and payment_id are required' });
      return;
    }

    const payment = await prisma.partnerPayment.upsert({
      where: { paymentId },
      create: { externalPartnerId, partnerName, partnerEmail, paymentId, amount, paymentStatus },
      update: { externalPartnerId, partnerName, partnerEmail, amount, paymentStatus },
    });

    if (payment.paymentStatus === 'paid') {
      await processPaidPayment(payment);
    }

    res.json({ ok: true, id: payment.id });
  } catch (e) {
    next(e);
  }
});
