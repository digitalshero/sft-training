// Admin — Partner Payments: review payment records (written by an external
// payment integration, handled separately — this module only displays and
// manages them), accept/reject onboarding, and send the partner login
// invite. Accepting a partner also creates a real row in the EXISTING
// Invite & Certify module (lp_partner_invites) by calling the exact same
// Prisma writes that route already makes, so the partner shows up there
// automatically — that module's own code is never touched.
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '../../lib/prisma';
import { requireAuth, requirePermission, AuthRequest } from '../../middleware/auth';
import { sendEmail } from '../../lib/email';
import { buildPartnerWelcomeEmail } from '../../services/email-dispatch';
import { processPaidPayment } from '../../services/partner-payment-processing';
import type { PartnerPayment, PartnerInvite } from '@prisma/client';

export const partnerPaymentsRoutes = Router();

const requirePartnerPayments = requirePermission('sft_partner_payments');

function serialize(p: PartnerPayment & { invite: PartnerInvite | null }) {
  return {
    id: p.id,
    external_partner_id: p.externalPartnerId,
    partner_name: p.partnerName,
    partner_email: p.partnerEmail,
    payment_id: p.paymentId,
    amount: p.amount,
    payment_status: p.paymentStatus,
    approval_status: p.approvalStatus,
    invite_status: p.inviteStatus,
    created_at: p.createdAt,
    invite_link: p.invite?.inviteLink ?? null,
  };
}

// ── GET / — list all payment records for the admin table ─────────────────────

partnerPaymentsRoutes.get('/', requireAuth, requirePartnerPayments, async (_req, res, next) => {
  try {
    const payments = await prisma.partnerPayment.findMany({
      include: { invite: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments.map(serialize));
  } catch (e) {
    next(e);
  }
});

// ── POST / — internal endpoint for inserting a payment record ───────────────
// The real payment integration (built separately) will call this same
// contract — no frontend changes needed once it's wired up.

partnerPaymentsRoutes.post('/', requireAuth, requirePartnerPayments, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = req.body as Record<string, unknown>;
    const partnerName = String(b.partner_name ?? '').trim();
    const partnerEmail = String(b.partner_email ?? '').trim().toLowerCase();
    const paymentId = String(b.payment_id ?? '').trim();
    const amount = Number(b.amount ?? 0);
    if (!partnerName || !partnerEmail || !paymentId) {
      res.status(400).json({ error: 'partner_name, partner_email, and payment_id are required' });
      return;
    }

    const payment = await prisma.partnerPayment.create({
      data: {
        partnerName,
        partnerEmail,
        paymentId,
        amount,
        paymentStatus: (b.payment_status as string) === 'paid' ? 'paid' : 'unpaid',
      },
    });

    if (payment.paymentStatus === 'paid') {
      await processPaidPayment(payment);
    }

    const withInvite = await prisma.partnerPayment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { invite: true },
    });
    res.status(201).json(serialize(withInvite));
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      res.status(409).json({ error: 'That payment ID already exists' });
      return;
    }
    next(e);
  }
});

// ── DELETE /:id — remove a payment record (e.g. test data cleanup) ─────────
// Only removes the payment + its own invite-link row (cascades via the FK);
// does not touch anything already synced into Invite & Certify on Accept.

partnerPaymentsRoutes.delete('/:id', requireAuth, requirePartnerPayments, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.partnerPayment.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2025') {
      res.status(404).json({ error: 'Payment record not found' });
      return;
    }
    next(e);
  }
});

// ── PUT /:id/accept — verify payment, sync into Invite & Certify ───────────

partnerPaymentsRoutes.put('/:id/accept', requireAuth, requirePartnerPayments, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminUserId = (req as AuthRequest).user.id;
    const payment = await prisma.partnerPayment.findUnique({ where: { id: req.params.id } });
    if (!payment) {
      res.status(404).json({ error: 'Payment record not found' });
      return;
    }
    if (payment.paymentStatus !== 'paid') {
      res.status(400).json({ error: 'Payment must be verified as paid before accepting' });
      return;
    }

    // Same default-course convention the existing Invite & Certify page uses
    // (it pre-selects courses[0] ordered by sortOrder) — there's no "default
    // course" flag in the schema to key off instead.
    const course = await prisma.lpCourse.findFirst({ orderBy: { sortOrder: 'asc' } });
    if (!course) {
      res.status(400).json({ error: 'No course is configured yet to invite partners into' });
      return;
    }

    // Find-or-create the partner's user account now (same bridge pattern
    // used across this app's other partner-facing logins) so the invite
    // synced into the existing module is already linked to a real account.
    let user = await prisma.user.findUnique({ where: { email: payment.partnerEmail } });
    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
      user = await prisma.user.create({
        data: {
          email: payment.partnerEmail,
          passwordHash,
          emailConfirmed: true,
          profile: { create: { displayName: payment.partnerName } },
          userRoles: { create: { role: 'kitchen_partner' } },
        },
      });
    } else {
      const hasRole = await prisma.userRole.findUnique({
        where: { userId_role: { userId: user.id, role: 'kitchen_partner' } },
      });
      if (!hasRole) {
        await prisma.userRole.create({ data: { userId: user.id, role: 'kitchen_partner' } });
      }
    }

    // Exact same writes as POST /sft/invites (sft/index.ts) — reproduced
    // here rather than refactoring that route, so the existing Invite &
    // Certify module's code is never touched.
    const lpInvite = await prisma.lpPartnerInvite.create({
      data: {
        courseId: course.id,
        recipientName: payment.partnerName,
        recipientEmail: payment.partnerEmail,
        invitedBy: adminUserId,
        userId: user.id,
        status: 'sent',
      },
    });
    await prisma.lpPartnerEvent.create({
      data: {
        courseId: lpInvite.courseId,
        inviteId: lpInvite.id,
        userId: user.id,
        eventType: 'invite_created',
        payload: { recipient_email: lpInvite.recipientEmail, source: 'partner_payments' },
      },
    });

    // This module's own invite token/link, used by the OTP partner-login
    // flow — independent of lp_partner_invites' own JWT magic-link token.
    const inviteToken = randomBytes(24).toString('hex');
    const inviteLink = `${process.env.PUBLIC_SITE_URL || 'http://localhost:5173'}/partner-login?token=${inviteToken}`;

    const [updatedPayment, invite] = await prisma.$transaction([
      prisma.partnerPayment.update({ where: { id: payment.id }, data: { approvalStatus: 'accepted' } }),
      prisma.partnerInvite.upsert({
        where: { partnerPaymentId: payment.id },
        create: {
          partnerPaymentId: payment.id,
          partnerEmail: payment.partnerEmail,
          inviteToken,
          inviteLink,
        },
        update: { inviteToken, inviteLink },
      }),
    ]);

    res.json(serialize({ ...updatedPayment, invite }));
  } catch (e) {
    next(e);
  }
});

// ── PUT /:id/reject — reject onboarding, no invite is generated ─────────────

partnerPaymentsRoutes.put('/:id/reject', requireAuth, requirePartnerPayments, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await prisma.partnerPayment.findUnique({
      where: { id: req.params.id },
      include: { invite: true },
    });
    if (!payment) {
      res.status(404).json({ error: 'Payment record not found' });
      return;
    }

    const updated = await prisma.partnerPayment.update({
      where: { id: payment.id },
      data: { approvalStatus: 'rejected' },
    });
    res.json(serialize({ ...updated, invite: payment.invite }));
  } catch (e) {
    next(e);
  }
});

// ── POST /:id/send-invite — email the invite link, Pending → Sent ──────────

partnerPaymentsRoutes.post('/:id/send-invite', requireAuth, requirePartnerPayments, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await prisma.partnerPayment.findUnique({
      where: { id: req.params.id },
      include: { invite: true },
    });
    if (!payment?.invite?.inviteLink || payment.approvalStatus !== 'accepted') {
      res.status(400).json({ error: 'Partner must be accepted before sending an invite' });
      return;
    }

    const { subject, html, text } = await buildPartnerWelcomeEmail({
      recipientName:  payment.partnerName,
      recipientEmail: payment.partnerEmail,
      loginUrl:       payment.invite.inviteLink,
    });

    await sendEmail({
      to: payment.partnerEmail,
      subject,
      html,
      text,
      templateName: 'partner-payment-invite',
      messageId: `partner-payment-invite-${payment.invite.id}-${Date.now()}`,
    });

    const [updatedPayment, updatedInvite] = await prisma.$transaction([
      prisma.partnerPayment.update({ where: { id: payment.id }, data: { inviteStatus: 'sent' } }),
      prisma.partnerInvite.update({ where: { id: payment.invite.id }, data: { inviteStatus: 'sent' } }),
    ]);

    res.json(serialize({ ...updatedPayment, invite: updatedInvite }));
  } catch (e) {
    next(e);
  }
});
