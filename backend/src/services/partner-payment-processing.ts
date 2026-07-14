// Shared, idempotent "a partner has paid" pipeline — accepts the partner,
// syncs them into the existing Invite & Certify module, and emails their
// OTP-login invite. Used by both the public payment webhook and the admin
// test-payment endpoint, since Accept/Send Invite are no longer manual
// buttons — this is the only path a payment goes through now.
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';
import { buildPartnerWelcomeEmail } from './email-dispatch';
import type { PartnerPayment } from '@prisma/client';

export async function processPaidPayment(payment: PartnerPayment): Promise<void> {
  if (payment.paymentStatus !== 'paid') return;
  if (payment.approvalStatus === 'accepted' && payment.inviteStatus === 'sent') return;

  // Same default-course convention the existing Invite & Certify page uses
  // (it pre-selects courses[0] ordered by sortOrder) — there's no "default
  // course" flag in the schema to key off instead.
  const course = await prisma.lpCourse.findFirst({ orderBy: { sortOrder: 'asc' } });
  if (!course) throw new Error('No course is configured yet to invite partners into');

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

  // Exact same writes as POST /sft/invites (sft/index.ts) — reproduced here
  // rather than refactoring that route, so the existing Invite & Certify
  // module's code is never touched. Idempotent: skip if this user already
  // has an invite for this course (repeat webhook calls shouldn't duplicate
  // rows in the existing module).
  let lpInvite = await prisma.lpPartnerInvite.findFirst({
    where: { userId: user.id, courseId: course.id },
  });
  if (!lpInvite) {
    lpInvite = await prisma.lpPartnerInvite.create({
      data: {
        courseId: course.id,
        recipientName: payment.partnerName,
        recipientEmail: payment.partnerEmail,
        invitedBy: null,
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
  }

  // This module's own invite token/link, used by the OTP partner-login
  // flow — independent of lp_partner_invites' own JWT magic-link token.
  // Reuse the existing token/link if one was already generated, so the
  // link stays stable across repeat calls instead of rotating underneath
  // a partner who may have already opened an earlier email.
  const existingInvite = await prisma.partnerInvite.findUnique({ where: { partnerPaymentId: payment.id } });
  const inviteToken = existingInvite?.inviteToken ?? randomBytes(24).toString('hex');
  const inviteLink  = existingInvite?.inviteLink
    ?? `${process.env.PUBLIC_SITE_URL || 'http://localhost:5173'}/partner-login?token=${inviteToken}`;

  const [, invite] = await prisma.$transaction([
    prisma.partnerPayment.update({ where: { id: payment.id }, data: { approvalStatus: 'accepted' } }),
    prisma.partnerInvite.upsert({
      where: { partnerPaymentId: payment.id },
      create: { partnerPaymentId: payment.id, partnerEmail: payment.partnerEmail, inviteToken, inviteLink },
      update: {},
    }),
  ]);

  if (payment.inviteStatus === 'sent') return;

  const { subject, html, text } = await buildPartnerWelcomeEmail({
    recipientName:  payment.partnerName,
    recipientEmail: payment.partnerEmail,
    loginUrl:       invite.inviteLink!,
  });

  await sendEmail({
    to: payment.partnerEmail,
    subject,
    html,
    text,
    templateName: 'partner-payment-invite',
    messageId: `partner-payment-invite-${invite.id}`,
  });

  await prisma.$transaction([
    prisma.partnerPayment.update({ where: { id: payment.id }, data: { inviteStatus: 'sent' } }),
    prisma.partnerInvite.update({ where: { id: invite.id }, data: { inviteStatus: 'sent' } }),
  ]);
}
