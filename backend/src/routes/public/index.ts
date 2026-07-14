import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { uploadFile, deleteFile, createSignedUrl } from '../../lib/storage';
import { sendCertificationEmail } from '../../services/email-dispatch';
import { createNotification } from '../../lib/notifications';

export const publicRoutes = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// ── Helper: load visit by token ───────────────────────────────────────────────

async function loadByToken(token: string) {
  const tok = await prisma.lpPhysicalVisitToken.findUnique({ where: { token } });
  if (!tok) throw new Error('Invalid or expired link');
  if (tok.expiresAt && tok.expiresAt < new Date()) throw new Error('Link expired');
  const visit = await prisma.lpPhysicalVisit.findUnique({ where: { id: tok.visitId } });
  if (!visit) throw new Error('Visit not found');
  return { tok, visit };
}

// ── GET /api/public/physical-visit?token=... ──────────────────────────────────

publicRoutes.get('/physical-visit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) { res.status(400).json({ error: 'Token required' }); return; }

    const { visit } = await loadByToken(token);

    const [profRes, inviteRes, photosRes, inspectionsRes] = await Promise.all([
      prisma.profile.findUnique({ where: { id: visit.userId } }),
      prisma.lpPartnerInvite.findFirst({
        where:  { userId: visit.userId, courseId: visit.courseId },
        select: { recipientName: true, recipientEmail: true, kitchenLocation: true },
      }),
      prisma.lpPhysicalVisitPhoto.findMany({
        where:   { visitId: visit.id, attemptNo: visit.attemptNo },
        orderBy: { uploadedAt: 'asc' },
      }),
      prisma.lpPhysicalVisitProductInspection.findMany({
        where: { visitId: visit.id, attemptNo: visit.attemptNo },
      }),
    ]);

    const recipeIds  = Array.isArray(visit.productIds) ? visit.productIds as string[] : [];
    const [recipes, cuisine]: [Array<{ id: string; foodName: string; imagePath: string | null }>, { name: string } | null] = await Promise.all([
      (recipeIds.length ? prisma.lpRecipe.findMany({ where: { id: { in: recipeIds } } }) : []) as Array<{ id: string; foodName: string; imagePath: string | null }>,
      visit.cuisineId ? prisma.lpCuisine.findUnique({ where: { id: visit.cuisineId }, select: { name: true } }) : null,
    ]);

    const recipeMap  = new Map<string, typeof recipes[0]>(recipes.map(r => [r.id, r]));
    const assignedProducts = recipeIds
      .map((id: string) => ({ product_id: id, product_name: recipeMap.get(id)?.foodName }))
      .filter((p): p is { product_id: string; product_name: string } => !!p.product_name);
    const cuisineName   = cuisine?.name ?? null;

    const photos = await Promise.all(photosRes.map(async p => ({
      id:           p.id,
      product_id:   p.productId,
      caption:      p.caption,
      signed_url:   await createSignedUrl('sft-practice', p.imagePath),
      uploaded_at:  p.uploadedAt,
    })));

    const productInspections = inspectionsRes.map(i => ({
      product_id: i.productId,
      status:     i.status,
      comment:    i.comment,
    }));

    res.json({
      visit_id:          visit.id,
      status:            visit.status,
      attempt_no:        visit.attemptNo,
      already_submitted: !!visit.submittedAt,
      visitor_name:      visit.visitorName,
      visitor_email:     visit.visitorEmail,
      visitor_phone:     visit.visitorPhone,
      visitor_location:  visit.visitorLocation,
      partner_name:      profRes?.displayName ?? inviteRes?.recipientName ?? null,
      partner_location:  visit.partnerLocation ?? inviteRes?.kitchenLocation ?? null,
      partner_state:     visit.partnerState,
      partner_country:   visit.partnerCountry,
      cuisine_name:      cuisineName,
      assigned_products: assignedProducts,
      product_inspections: productInspections,
      visit_date:        visit.visitDate,
      visit_time:        visit.visitTime,
      remarks:           visit.remarks,
      photos,
    });
  } catch (e) { next(e); }
});

// ── POST /api/public/physical-visit/upload?token=... ─────────────────────────

publicRoutes.post(
  '/physical-visit/upload',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query as { token?: string };
      if (!token) { res.status(400).json({ error: 'Missing token' }); return; }

      const { visit } = await loadByToken(token);
      if (visit.submittedAt) { res.status(409).json({ error: 'Visit already submitted' }); return; }

      const file = req.file;
      if (!file) { res.status(400).json({ error: 'Missing file' }); return; }

      const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const key = `physical-visit/${visit.id}/${visit.attemptNo}/${randomUUID()}.${ext}`;

      await uploadFile('sft-practice', key, file.buffer, file.mimetype || 'image/jpeg');

      const caption = (req.body.caption as string | undefined) ?? null;
      const productId = (req.body.product_id as string | undefined) ?? null;
      const photo = await prisma.lpPhysicalVisitPhoto.create({
        data: { visitId: visit.id, attemptNo: visit.attemptNo, productId, imagePath: key, caption },
      });

      const signedUrl = await createSignedUrl('sft-practice', key);
      res.json({ id: photo.id, product_id: photo.productId, caption: photo.caption, signed_url: signedUrl, uploaded_at: photo.uploadedAt });
    } catch (e) { next(e); }
  },
);

// ── POST /api/public/physical-visit/product-status?token=... ────────────────
// Upserts a single assigned product's accept/reject decision + comment. Callable
// repeatedly as the visitor works through the product list, before final submit.

publicRoutes.post('/physical-visit/product-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, product_id, product_name, status, comment } = req.body as {
      token: string; product_id: string; product_name: string;
      status: 'pending' | 'accepted' | 'rejected'; comment?: string;
    };
    if (!token || !product_id || !product_name) { res.status(400).json({ error: 'Missing params' }); return; }
    if (!['pending', 'accepted', 'rejected'].includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }

    const { visit } = await loadByToken(token);
    if (visit.submittedAt) { res.status(409).json({ error: 'Visit already submitted' }); return; }

    const inspection = await prisma.lpPhysicalVisitProductInspection.upsert({
      where:  { visitId_attemptNo_productId: { visitId: visit.id, attemptNo: visit.attemptNo, productId: product_id } },
      create: { visitId: visit.id, attemptNo: visit.attemptNo, productId: product_id, productName: product_name, status, comment: comment ?? null },
      update: { status, comment: comment ?? null },
    });

    res.json({ product_id: inspection.productId, status: inspection.status, comment: inspection.comment });
  } catch (e) { next(e); }
});

// ── DELETE /api/public/physical-visit/upload?token=...&photo_id=... ──────────

publicRoutes.delete('/physical-visit/upload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, photo_id } = req.query as { token?: string; photo_id?: string };
    if (!token || !photo_id) { res.status(400).json({ error: 'Missing params' }); return; }

    const { tok } = await loadByToken(token);
    const photo = await prisma.lpPhysicalVisitPhoto.findUnique({ where: { id: photo_id } });
    if (!photo || photo.visitId !== tok.visitId) { res.status(404).json({ error: 'Not found' }); return; }

    await deleteFile('sft-practice', photo.imagePath);
    await prisma.lpPhysicalVisitPhoto.delete({ where: { id: photo_id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── POST /api/public/physical-visit/submit ───────────────────────────────────

publicRoutes.post('/physical-visit/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, decision, comments, visitor_name, visitor_location } = req.body as {
      token: string; decision: 'approved' | 'rejected'; comments?: string;
      visitor_name?: string; visitor_location?: string;
    };
    if (!token) { res.status(400).json({ error: 'Token required' }); return; }
    if (decision === 'rejected' && !comments?.trim()) {
      res.status(400).json({ error: 'Comments required when rejecting' }); return;
    }

    const { tok, visit } = await loadByToken(token);
    if (visit.submittedAt) { res.status(409).json({ error: 'Already submitted' }); return; }

    const attempt = visit.attemptNo;
    const photos  = await prisma.lpPhysicalVisitPhoto.findMany({ where: { visitId: visit.id, attemptNo: attempt } });

    const now        = new Date();
    const finalName  = visitor_name?.trim() || visit.visitorName;
    const finalLoc   = visitor_location?.trim() || null;

    let newStatus   = decision === 'approved' ? 'approved' : 'rejected';
    if (decision === 'rejected' && attempt >= 3) newStatus = 'waiting_admin_reschedule';

    // Snapshot what was assigned for this attempt — recipes can be renamed/deleted
    // later, so archive the names here for history.
    const visitRecipeIds = Array.isArray(visit.productIds) ? visit.productIds as string[] : [];
    const assignedProducts = await (async () => {
      if (!visitRecipeIds.length) return [] as string[];
      const recipes = await prisma.lpRecipe.findMany({ where: { id: { in: visitRecipeIds } } });
      const recipeMap = new Map(recipes.map(r => [r.id, r]));
      const cuisine = visit.cuisineId ? await prisma.lpCuisine.findUnique({ where: { id: visit.cuisineId }, select: { name: true } }) : null;
      return visitRecipeIds
        .map(rid => `${cuisine?.name ?? ''} — ${recipeMap.get(rid)?.foodName ?? ''}`.trim())
        .filter(Boolean);
    })();

    // Per-product inspection scoring — only applies when the visit has assigned
    // products; legacy/unassigned visits fall back to the old flat photo check.
    let totalProducts = 0;
    let acceptedProducts = 0;
    let rejectedProducts = 0;
    let inspectionPercentage: number | null = null;
    let productInspectionsSnapshot: Array<{
      product_id: string;
      product_name: string;
      uploaded_image: string | null;
      status: string;
      product_comment: string | null;
    }> = [];

    if (visitRecipeIds.length) {
      const inspections = await prisma.lpPhysicalVisitProductInspection.findMany({
        where: { visitId: visit.id, attemptNo: attempt },
      });
      const inspectionMap = new Map(inspections.map(i => [i.productId, i]));
      const unreviewed = visitRecipeIds.filter(id => (inspectionMap.get(id)?.status ?? 'pending') === 'pending');
      if (unreviewed.length) {
        res.status(400).json({ error: 'Please accept or reject every assigned product before submitting' });
        return;
      }
      totalProducts    = visitRecipeIds.length;
      acceptedProducts = inspections.filter(i => i.status === 'accepted').length;
      rejectedProducts = inspections.filter(i => i.status === 'rejected').length;
      inspectionPercentage = totalProducts ? Math.round((acceptedProducts / totalProducts) * 1000) / 10 : null;

      const photoByProduct = new Map<string, string>();
      for (const p of photos) {
        if (p.productId && !photoByProduct.has(p.productId)) photoByProduct.set(p.productId, p.imagePath);
      }
      productInspectionsSnapshot = inspections.map(i => ({
        product_id:      i.productId,
        product_name:    i.productName,
        uploaded_image:  photoByProduct.get(i.productId) ?? null,
        status:          i.status,
        product_comment: i.comment,
      }));
    } else if (!photos.length) {
      res.status(400).json({ error: 'Upload at least one photo' });
      return;
    }

    await prisma.lpPhysicalVisitHistory.create({
      data: {
        visitId:         visit.id,
        attemptNo:       attempt,
        visitorName:     finalName,
        visitorEmail:    visit.visitorEmail,
        visitorPhone:    visit.visitorPhone,
        visitorLocation: finalLoc,
        visitDate:       visit.visitDate,
        visitTime:       visit.visitTime,
        decision,
        comments:        comments ?? null,
        photos:          photos.map(p => ({ id: p.id, image_path: p.imagePath, caption: p.caption, uploaded_at: p.uploadedAt })),
        assignedProducts,
        productInspections: productInspectionsSnapshot,
        totalProducts,
        acceptedProducts,
        rejectedProducts,
        inspectionPercentage,
        submittedAt:     now,
      },
    });

    await prisma.lpPhysicalVisit.update({
      where: { id: visit.id },
      data:  {
        visitorName:      finalName,
        visitorLocation:  finalLoc,
        status:           newStatus as never,
        finalDecision:    decision,
        decisionComments: comments ?? null,
        totalProducts,
        acceptedProducts,
        rejectedProducts,
        inspectionPercentage,
        submittedAt:      now,
        formStatus:       'submitted',
        formSubmittedAt:  now,
      },
    });

    await createNotification(
      visit.userId,
      'physical_visit',
      decision === 'approved'
        ? 'Your physical visit was approved.'
        : 'Your physical visit was rejected — please review the comments.',
      comments,
      visit.id,
    );

    if (visit.assignedBy) {
      const scoreNote = inspectionPercentage !== null ? ` Inspection score: ${inspectionPercentage}%.` : '';
      await createNotification(
        visit.assignedBy,
        'physical_visit_admin',
        `Physical visit inspection completed for ${finalName ?? 'the partner'}.${scoreNote} Visitor decision: ${decision}.`,
        comments,
        visit.id,
      );
    }

    if (decision === 'approved') {
      let certCode: string;
      const existingCert = await prisma.lpCertificate.findUnique({
        where: { userId_courseId: { userId: visit.userId, courseId: visit.courseId } },
      });
      if (!existingCert) {
        certCode = `SCP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        await prisma.lpCertificate.create({ data: { userId: visit.userId, courseId: visit.courseId, code: certCode } });
        await createNotification(visit.userId, 'certificate', 'A certificate has been issued for your completed course.', null, certCode);
      } else {
        certCode = existingCert.code;
      }
      await prisma.lpPhysicalVisit.update({ where: { id: visit.id }, data: { status: 'certified' } });
      // Send certification email with certificate code and resources
      sendCertificationEmail(visit.userId, visit.courseId, certCode).catch(e =>
        console.error('[certification-email] failed', e),
      );
    }

    // Invalidate token
    await prisma.lpPhysicalVisitToken.delete({ where: { id: tok.id } });

    res.json({ ok: true, decision, status: newStatus });
  } catch (e) { next(e); }
});

// ── POST /api/public/physical-visit/google-form?token=... ────────────────────

publicRoutes.post('/physical-visit/google-form', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) { res.status(400).json({ error: 'Missing token' }); return; }

    const { tok } = await loadByToken(token);
    const body = req.body as Record<string, unknown>;

    const get = (...keys: string[]): string | null => {
      for (const k of keys) { if (body[k] != null && body[k] !== '') return String(body[k]); }
      return null;
    };

    const decisionRaw = get('Final Decision', 'final_decision', 'decision')?.toLowerCase() ?? '';
    const decision    = decisionRaw.startsWith('appr') ? 'approved' : decisionRaw.startsWith('rej') ? 'rejected' : null;

    const update: Record<string, unknown> = {
      formSubmittedAt: new Date(),
      formStatus:      'submitted',
      status:          decision ?? 'visit_completed',
      finalDecision:   decision,
    };
    if (get('Visitor Name', 'visitor_name')) update.visitorName = get('Visitor Name', 'visitor_name');
    if (get('Visitor Comments', 'visitor_comments', 'comments')) update.decisionComments = get('Visitor Comments', 'visitor_comments', 'comments');

    await prisma.lpPhysicalVisit.update({ where: { id: tok.visitId }, data: update as never });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
