import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireEditor } from '../../middleware/auth';

export const configRoutes = Router();

// ── GET /api/config?section=... ───────────────────────────────────────────────
configRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { section, key } = req.query as { section?: string; key?: string };
    const entries = await prisma.configEntry.findMany({
      where: {
        isActive: true,
        ...(section ? { section } : {}),
        ...(key     ? { key }     : {}),
      },
      orderBy: [{ section: 'asc' }, { position: 'asc' }],
    });
    res.json(entries);
  } catch (e) { next(e); }
});

// ── PUT /api/config/:section/:key (admin) ─────────────────────────────────────
configRoutes.put('/:section/:key', requireAuth, requireEditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { section, key } = req.params;
    const entry = await prisma.configEntry.upsert({
      where:  { section_key: { section, key } },
      create: { section, key, label: req.body.label ?? key, value: req.body.value, ...req.body },
      update: req.body,
    });
    res.json(entry);
  } catch (e) { next(e); }
});

// ── FAQ ───────────────────────────────────────────────────────────────────────
configRoutes.get('/faq', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { audience, category, language, country } = req.query as Record<string, string>;
    const faqs = await prisma.faqEntry.findMany({
      where: {
        isActive: true,
        ...(audience ? { audience: audience as 'kob_lead' | 'sft_partner' } : {}),
        ...(category ? { category } : {}),
        ...(language ? { language } : {}),
        ...(country  ? { OR: [{ country }, { country: null }] } : {}),
      },
      orderBy: { position: 'asc' },
    });
    res.json(faqs);
  } catch (e) { next(e); }
});

configRoutes.post('/faq', requireAuth, requireEditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const faq = await prisma.faqEntry.create({ data: req.body });
    res.status(201).json(faq);
  } catch (e) { next(e); }
});

configRoutes.patch('/faq/:id', requireAuth, requireEditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await prisma.faqEntry.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

configRoutes.delete('/faq/:id', requireAuth, requireEditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.faqEntry.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
