import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireSuperAdmin, AuthRequest } from '../../middleware/auth';
import { PERMANENT_SUPER_ADMIN_EMAIL } from '../../lib/constants';

export const adminRoutes = Router();

adminRoutes.use(requireAuth);
adminRoutes.use(requireSuperAdmin);

// ── GET /api/admin/users ──────────────────────────────────────────────────────

adminRoutes.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      include: { profile: true, userRoles: true, appPermissions: true },
      orderBy: { email: 'asc' },
    });

    res.json(users.map(u => ({
      id:            u.id,
      email:         u.email,
      display_name:  u.profile?.displayName ?? null,
      created_at:    u.createdAt,
      is_super_admin: u.userRoles.some(r => r.role === 'super_admin'),
      permissions:   u.appPermissions.map(p => p.permissionKey),
    })));
  } catch (err) { next(err); }
});

// ── POST /api/admin/users ─────────────────────────────────────────────────────

adminRoutes.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, display_name, is_super_admin, permissions } = req.body as {
      email: string; password: string; display_name?: string;
      is_super_admin?: boolean; permissions?: string[];
    };

    if (!email || !password || password.length < 8) {
      res.status(400).json({ error: 'email and password (min 8 chars) required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) { res.status(409).json({ error: 'Email already registered' }); return; }

    const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email:          email.toLowerCase(),
        passwordHash,
        emailConfirmed: true,
        profile: { create: { displayName: display_name || email.split('@')[0] } },
        ...(is_super_admin && {
          userRoles: { create: { role: 'super_admin' } },
        }),
        ...(permissions?.length && {
          appPermissions: {
            create: permissions.map(k => ({ permissionKey: k, grantedBy: null })),
          },
        }),
      },
    });

    res.status(201).json({ id: user.id });
  } catch (err) { next(err); }
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────

adminRoutes.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = (req as AuthRequest).user.id;

    if (id === actorId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (target?.email.toLowerCase() === PERMANENT_SUPER_ADMIN_EMAIL) {
      res.status(400).json({ error: 'This account is permanent and cannot be deleted' });
      return;
    }

    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── PUT /api/admin/users/:id/permissions ──────────────────────────────────────

adminRoutes.put('/users/:id/permissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = (req as AuthRequest).user.id;
    const { is_super_admin, permissions } = req.body as {
      is_super_admin: boolean; permissions: string[];
    };

    // Prevent removing your own super_admin
    if (!is_super_admin && id === actorId) {
      res.status(400).json({ error: 'Cannot remove your own super_admin role' });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (!is_super_admin && target?.email.toLowerCase() === PERMANENT_SUPER_ADMIN_EMAIL) {
      res.status(400).json({ error: "This account's super admin access is permanent and cannot be removed" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Update super_admin role
      if (is_super_admin) {
        await tx.userRole.upsert({
          where:  { userId_role: { userId: id, role: 'super_admin' } },
          create: { userId: id, role: 'super_admin' },
          update: {},
        });
      } else {
        await tx.userRole.deleteMany({ where: { userId: id, role: 'super_admin' } });
      }

      // Replace permissions
      await tx.appPermission.deleteMany({ where: { userId: id } });
      if (permissions?.length) {
        await tx.appPermission.createMany({
          data: permissions.map(k => ({ userId: id, permissionKey: k, grantedBy: actorId })),
        });
      }
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /api/admin/users/:id/reset-password ──────────────────────────────────

adminRoutes.post('/users/:id/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { password } = req.body as { password: string };

    if (!password || password.length < 8) {
      res.status(400).json({ error: 'Password min 8 chars required' });
      return;
    }

    const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    res.json({ ok: true });
  } catch (err) { next(err); }
});
