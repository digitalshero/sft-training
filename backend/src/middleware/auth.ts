import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../lib/jwt';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

// ── Require authenticated JWT ─────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Bearer token required' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    (req as AuthRequest).user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

// ── Require super_admin role ──────────────────────────────────────────────────

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const role = await prisma.userRole.findFirst({
    where: { userId: authReq.user.id, role: 'super_admin' },
  });

  if (!role) {
    res.status(403).json({ error: 'Forbidden: super_admin required' });
    return;
  }
  next();
}

// ── Require editor (trainer | admin | super_admin) ────────────────────────────

export async function requireEditor(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const role = await prisma.userRole.findFirst({
    where: {
      userId: authReq.user.id,
      role:   { in: ['trainer', 'admin', 'super_admin'] },
    },
  });

  if (!role) {
    console.warn('[requireEditor] 403 for userId:', authReq.user.id, 'email:', authReq.user.email);
    res.status(403).json({ error: 'Forbidden: editor role required' });
    return;
  }
  next();
}

// ── Require a specific permission ─────────────────────────────────────────────

export function requirePermission(permissionKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // super_admin bypasses all permission checks
    const isSuperAdmin = await prisma.userRole.findFirst({
      where: { userId: authReq.user.id, role: 'super_admin' },
    });
    if (isSuperAdmin) { next(); return; }

    const perm = await prisma.appPermission.findUnique({
      where: { userId_permissionKey: { userId: authReq.user.id, permissionKey } },
    });

    if (!perm) {
      res.status(403).json({ error: `Forbidden: ${permissionKey} permission required` });
      return;
    }
    next();
  };
}

// ── Require any one of several permissions ────────────────────────────────────

export function requireAnyPermission(permissionKeys: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // super_admin bypasses all permission checks
    const isSuperAdmin = await prisma.userRole.findFirst({
      where: { userId: authReq.user.id, role: 'super_admin' },
    });
    if (isSuperAdmin) { next(); return; }

    const perm = await prisma.appPermission.findFirst({
      where: { userId: authReq.user.id, permissionKey: { in: permissionKeys } },
    });

    if (!perm) {
      res.status(403).json({ error: `Forbidden: one of [${permissionKeys.join(', ')}] permission required` });
      return;
    }
    next();
  };
}
