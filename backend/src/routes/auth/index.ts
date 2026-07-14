import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '../../lib/prisma';
import {
  signAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  getPasswordResetExpiry,
} from '../../lib/jwt';
import { requireAuth, AuthRequest } from '../../middleware/auth';
import { sendEmail } from '../../lib/email';

export const authRoutes = Router();

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

// ── POST /api/auth/signup ─────────────────────────────────────────────────────

authRoutes.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, display_name } = req.body as {
      email: string; password: string; display_name?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email:         email.toLowerCase(),
        passwordHash,
        emailConfirmed: true, // auto-confirm; add email verification flow if needed
        profile: {
          create: { displayName: display_name || email.split('@')[0] },
        },
      },
      include: { profile: true },
    });

    const accessToken  = signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt: getRefreshTokenExpiry() },
    });

    res.status(201).json({
      access_token:  accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, display_name: user.profile?.displayName },
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/signin ─────────────────────────────────────────────────────

authRoutes.post('/signin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where:   { email: email.toLowerCase() },
      include: { profile: true, userRoles: true },
    });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data:  { lastSignInAt: new Date() },
    });

    const accessToken  = signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt: getRefreshTokenExpiry() },
    });

    res.json({
      access_token:  accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, display_name: user.profile?.displayName, roles: user.userRoles.map(r => r.role) },
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────

authRoutes.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.body as { refresh_token: string };
    if (!refresh_token) {
      res.status(400).json({ error: 'refresh_token required' });
      return;
    }

    const stored = await prisma.refreshToken.findUnique({
      where:   { token: refresh_token },
      include: { user: { include: { profile: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    // Rotate: revoke old, issue new
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data:  { revokedAt: new Date() },
    });

    const newRefreshToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: { userId: stored.userId, token: newRefreshToken, expiresAt: getRefreshTokenExpiry() },
    });

    const accessToken = signAccessToken({ sub: stored.userId, email: stored.user.email });

    res.json({
      access_token:  accessToken,
      refresh_token: newRefreshToken,
      user: {
        id:           stored.user.id,
        email:        stored.user.email,
        display_name: stored.user.profile?.displayName,
      },
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/signout ────────────────────────────────────────────────────

authRoutes.post('/signout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.body as { refresh_token?: string };
    if (refresh_token) {
      await prisma.refreshToken.updateMany({
        where: { token: refresh_token },
        data:  { revokedAt: new Date() },
      });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

authRoutes.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = (req as AuthRequest).user;
    const user = await prisma.user.findUnique({
      where:   { id },
      include: { profile: true, userRoles: true, appPermissions: true },
    });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    res.json({
      id:           user.id,
      email:        user.email,
      display_name: user.profile?.displayName,
      roles:        user.userRoles.map(r => r.role),
      permissions:  user.appPermissions.map(p => p.permissionKey),
      is_super_admin: user.userRoles.some(r => r.role === 'super_admin'),
    });
  } catch (err) { next(err); }
});

// ── GET /api/auth/permissions ─────────────────────────────────────────────────

authRoutes.get('/permissions', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = (req as AuthRequest).user;
    const [roles, perms] = await Promise.all([
      prisma.userRole.findMany({ where: { userId: id } }),
      prisma.appPermission.findMany({ where: { userId: id } }),
    ]);
    const isSuperAdmin = roles.some(r => r.role === 'super_admin');
    res.json({
      is_super_admin: isSuperAdmin,
      roles:          roles.map(r => r.role),
      permissions:    perms.map(p => p.permissionKey),
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────

authRoutes.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body as { email: string };
    if (!email) { res.status(400).json({ error: 'Email required' }); return; }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always return success to prevent user enumeration
    if (!user) { res.json({ ok: true }); return; }

    const token = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: getPasswordResetExpiry() },
    });

    const resetUrl = `${process.env.PUBLIC_SITE_URL}/reset-password?token=${token}`;
    await sendEmail({
      to:           email,
      subject:      'Reset your Shero Training password',
      html:         `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 30 minutes.</p>`,
      text:         `Reset your password: ${resetUrl}`,
      templateName: 'password-reset',
      messageId:    `pwd-reset-${user.id}-${Date.now()}`,
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────

authRoutes.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = req.body as { token: string; password: string };
    if (!token || !password) {
      res.status(400).json({ error: 'token and password required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Revoke all refresh tokens on password change
      prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── PUT /api/auth/update-password ────────────────────────────────────────────

authRoutes.put('/update-password', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = (req as AuthRequest).user;
    const { current_password, new_password } = req.body as { current_password: string; new_password: string };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const valid = await bcrypt.compare(current_password, user.passwordHash);
    if (!valid) { res.status(400).json({ error: 'Current password is incorrect' }); return; }

    const passwordHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    res.json({ ok: true });
  } catch (err) { next(err); }
});
