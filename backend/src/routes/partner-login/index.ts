// Partner login via email + OTP (public — no JWT required). An email may
// request an OTP if it's either an accepted partner_payments row (new
// onboarding flow) or has a non-revoked lp_partner_invites row (classic
// Invite & Certify flow) — both paths land on the same OTP gate since every
// partner-facing invite email now points here instead of /login. On
// successful verification, issues a real session through the same
// JWT/refresh-token flow as normal sign-in, so the partner lands on the
// existing, unmodified Partner Hub with no second session system to maintain.
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../lib/prisma';
import { generateOtp, getOtpExpiry } from '../../lib/otp';
import { sendEmail } from '../../lib/email';
import {
  signAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
} from '../../lib/jwt';

export const partnerLoginRoutes = Router();

async function isApprovedPartnerEmail(normalizedEmail: string): Promise<boolean> {
  const payment = await prisma.partnerPayment.findFirst({
    where: { partnerEmail: normalizedEmail, approvalStatus: 'accepted' },
  });
  if (payment) return true;

  const invite = await prisma.lpPartnerInvite.findFirst({
    where: { recipientEmail: normalizedEmail, revokedAt: null },
  });
  return Boolean(invite);
}

const requestOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

// A 6-digit OTP is guessable if unbounded — cap verify attempts tightly.
const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

// Shared by /request-otp and /resend-otp — generates a fresh code, stores
// it, and emails it. Kept as one function so both endpoints stay in sync.
async function issueAndSendOtp(normalizedEmail: string): Promise<void> {
  const otpCode = generateOtp();
  await prisma.partnerOtp.create({
    data: { partnerEmail: normalizedEmail, otpCode, expiresAt: getOtpExpiry() },
  });

  await sendEmail({
    to: normalizedEmail,
    subject: 'Your Shero partner sign-in code',
    html: `<p>Your one-time sign-in code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${otpCode}</p><p>This code expires in 10 minutes.</p>`,
    text: `Your Shero sign-in code is ${otpCode}. It expires in 10 minutes.`,
    templateName: 'partner-otp',
    messageId: `partner-otp-${normalizedEmail}-${Date.now()}`,
  });
}

// ── POST /request-otp ─────────────────────────────────────────────────────────

partnerLoginRoutes.post('/request-otp', requestOtpLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body as { email?: string };
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    if (!normalizedEmail) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const isApprovedPartner = await isApprovedPartnerEmail(normalizedEmail);
    if (!isApprovedPartner) {
      res.status(401).json({ error: 'This email is not on the approved partner list.' });
      return;
    }

    await issueAndSendOtp(normalizedEmail);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /resend-otp — explicit resend (e.g. after an expired-OTP error) ───
// Functionally the same gate + issue path as /request-otp, exposed as its
// own endpoint so the frontend can call something named for what it's
// doing rather than re-calling "request" for a resend.

partnerLoginRoutes.post('/resend-otp', requestOtpLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body as { email?: string };
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    if (!normalizedEmail) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const isApprovedPartner = await isApprovedPartnerEmail(normalizedEmail);
    if (!isApprovedPartner) {
      res.status(401).json({ error: 'This email is not on the approved partner list.' });
      return;
    }

    await issueAndSendOtp(normalizedEmail);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── POST /verify-otp ───────────────────────────────────────────────────────────

partnerLoginRoutes.post('/verify-otp', verifyOtpLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp } = req.body as { email?: string; otp?: string };
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    const normalizedOtp = (otp ?? '').trim();
    if (!normalizedEmail || !normalizedOtp) {
      res.status(400).json({ error: 'Email and OTP are required' });
      return;
    }

    const record = await prisma.partnerOtp.findFirst({
      where: {
        partnerEmail: normalizedEmail,
        otpCode: normalizedOtp,
        verifiedStatus: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      // Distinguish "this exact code existed but expired" from "wrong code
      // entirely" so the frontend can specifically prompt to resend rather
      // than just say try again.
      const expired = await prisma.partnerOtp.findFirst({
        where: { partnerEmail: normalizedEmail, otpCode: normalizedOtp, verifiedStatus: false },
        orderBy: { createdAt: 'desc' },
      });
      if (expired) {
        res.status(401).json({ error: 'This code has expired. Please request a new one.', expired: true });
        return;
      }
      res.status(401).json({ error: 'Invalid OTP. Please try again.' });
      return;
    }

    // Re-confirm approval is still current — it could have been revoked
    // between requesting and verifying the OTP.
    const isApprovedPartner = await isApprovedPartnerEmail(normalizedEmail);
    if (!isApprovedPartner) {
      res.status(401).json({ error: 'This email is not on the approved partner list.' });
      return;
    }

    await prisma.partnerOtp.update({ where: { id: record.id }, data: { verifiedStatus: true } });

    // The Accept step already provisions this user — this just finds it.
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { userRoles: true },
    });
    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          emailConfirmed: true,
          profile: { create: { displayName: normalizedEmail.split('@')[0] } },
          userRoles: { create: { role: 'kitchen_partner' } },
        },
        include: { userRoles: true },
      });
    } else if (!user.userRoles.some((r) => r.role === 'kitchen_partner')) {
      await prisma.userRole.create({ data: { userId: user.id, role: 'kitchen_partner' } });
    }

    const accessToken = signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt: getRefreshTokenExpiry() },
    });

    res.json({ access_token: accessToken, refresh_token: refreshToken });
  } catch (e) {
    next(e);
  }
});
