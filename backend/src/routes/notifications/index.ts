import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, AuthRequest } from '../../middleware/auth';

export const notificationsRoutes = Router();
notificationsRoutes.use(requireAuth);

const EMPTY_COUNTS = { physical_visit: 0, prepare_cook: 0, certificate: 0, physical_visit_admin: 0 };

notificationsRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as AuthRequest).user.id;
    const rows = await prisma.lpNotification.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(rows.map((n) => ({
      id: n.id,
      module_name: n.moduleName,
      message: n.message,
      reference_id: n.referenceId,
      status: n.status,
      created_at: n.createdAt,
      read_at: n.readAt,
    })));
  } catch (e) { next(e); }
});

notificationsRoutes.get('/unread-counts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as AuthRequest).user.id;
    const rows = await prisma.lpNotification.groupBy({
      by: ['moduleName'],
      where: { partnerId, status: 'unread' },
      _count: { _all: true },
    });
    const counts: Record<string, number> = { ...EMPTY_COUNTS };
    let total = 0;
    for (const r of rows) {
      counts[r.moduleName] = r._count._all;
      total += r._count._all;
    }
    res.json({ ...counts, total });
  } catch (e) { next(e); }
});

notificationsRoutes.post('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as AuthRequest).user.id;
    const n = await prisma.lpNotification.findUnique({ where: { id: req.params.id } });
    if (!n || n.partnerId !== partnerId) { res.status(404).json({ error: 'Not found' }); return; }
    const updated = await prisma.lpNotification.update({
      where: { id: n.id },
      data: { status: 'read', readAt: new Date() },
    });
    res.json({ ok: true, id: updated.id });
  } catch (e) { next(e); }
});

notificationsRoutes.post('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as AuthRequest).user.id;
    await prisma.lpNotification.updateMany({
      where: { partnerId, status: 'unread' },
      data: { status: 'read', readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Removes a notification once the partner has viewed/opened it — read
// notifications aren't kept around in the panel.
notificationsRoutes.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as AuthRequest).user.id;
    const n = await prisma.lpNotification.findUnique({ where: { id: req.params.id } });
    if (!n || n.partnerId !== partnerId) { res.status(404).json({ error: 'Not found' }); return; }
    await prisma.lpNotification.delete({ where: { id: n.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Clears every notification for one module — called when the partner visits
// that module's own page, so a comment they've already seen/handled there
// (e.g. a Prepare & Cook redo) doesn't keep sitting as an unread badge just
// because they never happened to open the bell panel.
notificationsRoutes.delete('/module/:moduleName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerId = (req as AuthRequest).user.id;
    await prisma.lpNotification.deleteMany({
      where: { partnerId, moduleName: req.params.moduleName },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
