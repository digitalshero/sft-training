import { Router, Request, Response, NextFunction } from 'express';
import type { LpPartnerCertificate } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireEditor, AuthRequest } from '../../middleware/auth';
import { createSignedUrl, getFileBuffer } from '../../lib/storage';
import { parsePptx } from '../../lib/pptx-parser';
import { getCachedSlides } from '../../lib/deck-slides-cache';

// ── Body mappers: snake_case → camelCase for Prisma ─────────────────────────
function mapCuisineBody(b: Record<string, unknown>): Record<string, unknown> {
  const d: Record<string, unknown> = { ...b };
  const rename: Record<string, string> = {
    course_id: 'courseId', sort_order: 'sortOrder', show_count: 'showCount',
  };
  for (const [s, c] of Object.entries(rename)) { if (s in d) { d[c] = d[s]; delete d[s]; } }
  return d;
}

function mapRecipeBody(b: Record<string, unknown>): Record<string, unknown> {
  const d: Record<string, unknown> = { ...b };
  const rename: Record<string, string> = {
    course_id: 'courseId', cuisine_id: 'cuisineId', food_name: 'foodName',
    ingredients_md: 'ingredientsMd', prep_steps_md: 'prepStepsMd',
    cook_steps_md: 'cookStepsMd', image_path: 'imagePath',
    sort_order: 'sortOrder', created_by: 'createdBy',
  };
  for (const [s, c] of Object.entries(rename)) { if (s in d) { d[c] = d[s]; delete d[s]; } }
  return d;
}

function mapSampleGuideBody(b: Record<string, unknown>): Record<string, unknown> {
  const d: Record<string, unknown> = { ...b };
  const rename: Record<string, string> = {
    sample_image_path: 'sampleImagePath', guidelines_md: 'guidelinesMd', course_id: 'courseId',
  };
  for (const [s, c] of Object.entries(rename)) { if (s in d) { d[c] = d[s]; delete d[s]; } }
  return d;
}

// ── Serializers: camelCase Prisma result → snake_case for frontend ────────────
function serializeCuisine(c: Record<string, unknown>) {
  return {
    id: c.id, course_id: c.courseId, name: c.name,
    sort_order: c.sortOrder, show_count: c.showCount, active: c.active,
    recipe_count: c.recipe_count, created_at: c.createdAt,
  };
}

function serializeRecipe(r: Record<string, unknown>) {
  return {
    id: r.id, course_id: r.courseId, cuisine_id: r.cuisineId,
    food_name: r.foodName, ingredients_md: r.ingredientsMd,
    prep_steps_md: r.prepStepsMd, cook_steps_md: r.cookStepsMd,
    image_path: r.imagePath, active: r.active, sort_order: r.sortOrder,
    status: r.status, created_at: r.createdAt,
    image_url: r.image_url, cuisine_name: r.cuisine_name,
  };
}

export const learningRoutes = Router();
learningRoutes.use(requireAuth);

// ── Enrolment ─────────────────────────────────────────────────────────────────

learningRoutes.post('/enrol-by-invite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { token } = req.body as { token?: string };

    if (!token) {
      res.status(400).json({ error: 'token is required' });
      return;
    }

    const invite = await prisma.lpPartnerInvite.findFirst({
      where: { token, revokedAt: null },
    });

    if (!invite) {
      res.status(404).json({ error: 'Invalid or expired invite link' });
      return;
    }

    const courseId = invite.courseId as string | null;
    if (!courseId) {
      res.status(400).json({ error: 'This invite has no course attached. Ask your trainer to resend the invite.' });
      return;
    }

    await prisma.lpEnrolment.upsert({
      where:  { userId_courseId: { userId, courseId } },
      create: { userId, courseId },
      update: {},
    });

    if (!invite.userId) {
      await prisma.lpPartnerInvite.update({ where: { id: invite.id }, data: { userId } });
    }

    const course = await prisma.lpCourse.findUnique({
      where:  { id: courseId },
      select: { id: true, title: true, summary: true, published: true },
    });

    res.json({ course_id: courseId, course_title: course?.title ?? '', published: course?.published ?? false });
  } catch (e) {
    console.error('[enrol-by-invite]', e);
    next(e);
  }
});

learningRoutes.post('/enrol', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { courseId } = req.body as { courseId: string };
    await prisma.lpEnrolment.upsert({
      where:  { userId_courseId: { userId, courseId } },
      create: { userId, courseId, status: 'active' },
      update: {},
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

learningRoutes.get('/my-enrolments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const enrolments = await prisma.lpEnrolment.findMany({
      where:   { userId },
      orderBy: { enrolledAt: 'desc' },
      include: { course: { include: { program: true } } },
    });
    res.json(enrolments.map(e => ({
      id:          e.id,
      course_id:   e.courseId,
      user_id:     e.userId,
      status:      e.status,
      enrolled_at: e.enrolledAt,
    })));
  } catch (e) { next(e); }
});

// ── Course state ──────────────────────────────────────────────────────────────

// Once a partner is certified for a course, they keep access for this many
// days after issuedAt — past that, the course is treated as terminated for
// them (they'd need a new invite/cert to regain access).
const CERTIFIED_ACCESS_DAYS = 30;

learningRoutes.get('/courses/:courseId/my-state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const courseId = req.params.courseId;

    const [enrolment, modules, certificate] = await Promise.all([
      prisma.lpEnrolment.findUnique({ where: { userId_courseId: { userId, courseId } } }),
      prisma.lpModule.findMany({ where: { courseId }, select: { id: true } }),
      prisma.lpCertificate.findUnique({ where: { userId_courseId: { userId, courseId } } }),
    ]);

    if (certificate && !certificate.revokedAt) {
      const expiresAt = new Date(certificate.issuedAt.getTime() + CERTIFIED_ACCESS_DAYS * 24 * 60 * 60 * 1000);
      if (expiresAt.getTime() <= Date.now()) {
        res.status(403).json({
          error: 'Your access to this course ended 30 days after certification.',
          expired: true,
          issued_at: certificate.issuedAt,
          expires_at: expiresAt,
        });
        return;
      }
    }

    const moduleIds = modules.map(m => m.id);
    const progress  = moduleIds.length
      ? await prisma.lpModuleProgress.findMany({
          where: { userId, moduleId: { in: moduleIds } },
          select: { moduleId: true, completedAt: true, progressPct: true },
        })
      : [];

    res.json({
      enrolment,
      progress: progress.map(p => ({
        module_id:    p.moduleId,
        completed_at: p.completedAt,
        progress_pct: p.progressPct,
      })),
    });
  } catch (e) { next(e); }
});

// ── Module Progress ───────────────────────────────────────────────────────────

learningRoutes.post('/modules/:moduleId/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const moduleId = req.params.moduleId;
    await prisma.lpModuleProgress.upsert({
      where:  { userId_moduleId: { userId, moduleId } },
      create: { userId, moduleId, completedAt: new Date(), progressPct: 100 },
      update: { completedAt: new Date(), progressPct: 100 },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Deck slides (parsed server-side, cached) ─────────────────────────────────

learningRoutes.get('/modules/:moduleId/slides', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const moduleId = req.params.moduleId;
    const mod = await prisma.lpModule.findUnique({ where: { id: moduleId }, select: { filePath: true } });
    if (!mod?.filePath) { res.status(404).json({ error: 'No deck uploaded for this module' }); return; }

    const slides = await getCachedSlides(mod.filePath, () =>
      getFileBuffer('sft-decks', mod.filePath!).then(parsePptx),
    );
    res.json({ slides });
  } catch (e) { next(e); }
});

// ── Personal Notes ────────────────────────────────────────────────────────────

learningRoutes.get('/modules/:moduleId/note', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const moduleId = req.params.moduleId;
    const note = await prisma.lpModuleNote.findUnique({
      where: { userId_moduleId: { userId, moduleId } },
    });
    res.json({ body: note?.body ?? '', updated_at: note?.updatedAt ?? null });
  } catch (e) { next(e); }
});

learningRoutes.put('/modules/:moduleId/note', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const moduleId = req.params.moduleId;
    const { body } = req.body as { body?: string };
    const note = await prisma.lpModuleNote.upsert({
      where:  { userId_moduleId: { userId, moduleId } },
      create: { userId, moduleId, body: body ?? '' },
      update: { body: body ?? '' },
    });
    res.json({ ok: true, updated_at: note.updatedAt });
  } catch (e) { next(e); }
});

// ── Quiz ──────────────────────────────────────────────────────────────────────

learningRoutes.get('/modules/:moduleId/quiz/next', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const moduleId = req.params.moduleId;

    const mod = await prisma.lpModule.findUniqueOrThrow({
      where:  { id: moduleId },
      select: { quizQuestions: true, quizPlacement: true },
    });

    const bank      = (mod.quizQuestions as unknown[]) as Array<{ id: string }>;
    const placement = mod.quizPlacement ?? 'topic';
    const priorAttempts = await prisma.lpModuleQuizAttempt.findMany({
      where:   { userId, moduleId },
      orderBy: { attemptNo: 'desc' },
    });

    // On retry: show the exact same questions from the most recent attempt.
    // On first attempt: show all questions from the bank.
    let picked: typeof bank;
    if (priorAttempts.length > 0) {
      const lastIds  = priorAttempts[0].questionIds as string[];
      const bankById = new Map(bank.map(q => [q.id, q]));
      const fromLast = lastIds.map(id => bankById.get(id)).filter((q): q is typeof bank[0] => !!q);
      picked = fromLast.length > 0 ? fromLast : bank;
    } else {
      picked = bank;
    }

    // Pass rule: fixed thresholds for the day's checkpoint quizzes; topic
    // quizzes keep the original "one mistake allowed" formula.
    let passPct: number;
    if (placement === 'mid_day') {
      passPct = 60;
    } else if (placement === 'end_of_day') {
      passPct = 80;
    } else {
      passPct = picked.length > 0 ? Math.ceil(((picked.length - 1) / picked.length) * 100) : 100;
    }

    res.json({
      attemptNo: (priorAttempts[0]?.attemptNo ?? 0) + 1,
      questions:  picked,
      placement,
      passPct,
    });
  } catch (e) { next(e); }
});

learningRoutes.post('/modules/:moduleId/quiz/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const moduleId = req.params.moduleId;
    const { scorePct, passed, attemptNo, questionIds, answers, placement } = req.body as {
      scorePct: number; passed: boolean; attemptNo: number;
      questionIds: string[]; answers: Record<string, number>; placement?: string;
    };

    await prisma.lpModuleQuizAttempt.create({
      data: { userId, moduleId, attemptNo, placement: placement ?? 'topic', questionIds, answers, scorePct, passed },
    });

    const prog: Record<string, unknown> = { userId, moduleId, progressPct: Math.round(scorePct) };
    if (passed) prog.completedAt = new Date();

    await prisma.lpModuleProgress.upsert({
      where:  { userId_moduleId: { userId, moduleId } },
      create: prog as never,
      update: prog as never,
    });

    res.json({ ok: true, passed });
  } catch (e) { next(e); }
});

// ── Product Submissions ───────────────────────────────────────────────────────

learningRoutes.post('/courses/:courseId/submit-product', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const courseId = req.params.courseId;
    const sub = await prisma.lpProductSubmission.create({
      data: { userId, courseId, files: req.body.files, notes: req.body.notes ?? null, submittedAt: new Date() },
    });
    await prisma.lpPartnerEvent.create({
      data: { courseId, userId, eventType: 'product_submitted', payload: { submission_id: sub.id, file_count: req.body.files?.length ?? 0 } },
    });
    res.status(201).json(sub);
  } catch (e) { next(e); }
});

learningRoutes.get('/courses/:courseId/my-submission', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const sub = await prisma.lpProductSubmission.findFirst({
      where:   { userId, courseId: req.params.courseId },
      orderBy: { submittedAt: 'desc' },
    });
    res.json(sub ?? null);
  } catch (e) { next(e); }
});

learningRoutes.get('/courses/:courseId/my-submissions-signed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const subs   = await prisma.lpProductSubmission.findMany({
      where:   { userId, courseId: req.params.courseId },
      orderBy: { submittedAt: 'desc' },
    });
    const result = await Promise.all(
      subs.map(async s => {
        const files = (s.files as Array<{ path: string; label?: string; decision?: string; remark?: string }>) ?? [];
        const files_signed = await Promise.all(
          files.map(async f => ({
            ...f,
            url: await createSignedUrl('sft-practice', f.path),
          })),
        );
        return { ...s, files_signed };
      }),
    );
    res.json(result);
  } catch (e) { next(e); }
});

// ── Certificate ───────────────────────────────────────────────────────────────

learningRoutes.get('/courses/:courseId/my-certificate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const courseId = req.params.courseId;
    const [cert, extraCertificates] = await Promise.all([
      prisma.lpCertificate.findUnique({ where: { userId_courseId: { userId, courseId } } }),
      prisma.lpPartnerCertificate.findMany({ where: { userId, courseId, revokedAt: null }, orderBy: { issuedAt: 'asc' } }),
    ]);
    if (!cert) { res.json(null); return; }
    res.json({ ...cert, extra_certificates: extraCertificates });
  } catch (e) { next(e); }
});

// Issues every additional certificate defined in course.certificate_templates
// (beyond the single main LpCertificate above) once a partner is eligible —
// same "completed the whole course" gate, so a partner gets all of a
// course's certificates together, each tracked/downloadable separately.
async function issueExtraCertificates(userId: string, courseId: string) {
  const course = await prisma.lpCourse.findUnique({ where: { id: courseId }, select: { certificateTemplates: true } });
  const templates = (Array.isArray(course?.certificateTemplates) ? course.certificateTemplates : []) as unknown as { id: string }[];
  if (!templates.length) return [];

  const existing = await prisma.lpPartnerCertificate.findMany({ where: { userId, courseId } });
  const already = new Set(existing.map(e => e.templateId));

  const issued: LpPartnerCertificate[] = [];
  for (const tpl of templates) {
    if (!tpl?.id || already.has(tpl.id)) continue;
    const code = `SCP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const cert = await prisma.lpPartnerCertificate.create({ data: { userId, courseId, templateId: tpl.id, code } });
    issued.push(cert);
  }
  if (issued.length) {
    await prisma.lpPartnerEvent.create({
      data: { courseId, userId, eventType: 'extra_certificates_issued', payload: { codes: issued.map(i => i.code) } },
    });
  }
  return [...existing, ...issued];
}

learningRoutes.post('/courses/:courseId/issue-certificate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const courseId = req.params.courseId;

    const existing = await prisma.lpCertificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
    if (existing) {
      const extraCertificates = await issueExtraCertificates(userId, courseId);
      res.json({ issued: true, cert: existing, extra_certificates: extraCertificates });
      return;
    }

    const course  = await prisma.lpCourse.findUniqueOrThrow({ where: { id: courseId } });
    const mods    = await prisma.lpModule.findMany({ where: { courseId, published: true }, select: { id: true } });
    const modIds  = mods.map(m => m.id);
    const progress = await prisma.lpModuleProgress.findMany({
      where: { userId, moduleId: { in: modIds }, completedAt: { not: null } },
    });
    if (progress.length < modIds.length) {
      res.json({ issued: false, reason: 'Modules not all complete' }); return;
    }
    if (course.requiresProductUpload) {
      const sub = await prisma.lpProductSubmission.findFirst({
        where: { userId, courseId, status: 'approved' },
      });
      if (!sub) { res.json({ issued: false, reason: 'Product submission not approved' }); return; }
    }
    if (course.requiresInspection) {
      const visit = await prisma.lpPhysicalVisit.findFirst({
        where: { userId, courseId, status: { in: ['approved', 'certified'] } },
      });
      if (!visit) { res.json({ issued: false, reason: 'Physical visit not approved' }); return; }
    }

    const code = `SCP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const cert = await prisma.lpCertificate.create({ data: { userId, courseId, code } });
    await prisma.lpPartnerEvent.create({
      data: { courseId, userId, eventType: 'certificate_issued', payload: { code } },
    });
    const extraCertificates = await issueExtraCertificates(userId, courseId);
    res.json({ issued: true, cert, extra_certificates: extraCertificates });
  } catch (e) { next(e); }
});

// ── Cuisines (admin) ──────────────────────────────────────────────────────────

learningRoutes.get('/courses/:courseId/cuisines', async (req, res, next) => {
  try {
    const cuisines = await prisma.lpCuisine.findMany({
      where:   { courseId: req.params.courseId },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(cuisines.map(c => serializeCuisine(c as unknown as Record<string, unknown>)));
  } catch (e) { next(e); }
});

learningRoutes.post('/cuisines', requireEditor, async (req, res, next) => {
  try {
    const b = mapCuisineBody((req.body.data ?? req.body) as Record<string, unknown>);
    const cuisine = await prisma.lpCuisine.upsert({
      where:  { id: (b.id as string) ?? '' },
      create: b as any,
      update: b as any,
    });
    res.json(serializeCuisine(cuisine as unknown as Record<string, unknown>));
  } catch (e) { next(e); }
});

learningRoutes.delete('/cuisines/:id', requireEditor, async (req, res, next) => {
  try {
    await prisma.lpCuisine.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Recipes ───────────────────────────────────────────────────────────────────

learningRoutes.get('/courses/:courseId/recipes', requireEditor, async (req, res, next) => {
  try {
    const { cuisine_id } = req.query as { cuisine_id?: string };
    const recipes = await prisma.lpRecipe.findMany({
      where:   { courseId: req.params.courseId, ...(cuisine_id ? { cuisineId: cuisine_id } : {}) },
      include: { cuisine: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const withUrls = await Promise.all(recipes.map(async r => serializeRecipe({
      ...r,
      cuisine_name: (r as any).cuisine?.name ?? null,
      image_url: r.imagePath ? await createSignedUrl('learning-media', r.imagePath) : null,
    } as unknown as Record<string, unknown>)));
    res.json(withUrls);
  } catch (e) { next(e); }
});

learningRoutes.post('/recipes', requireEditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = mapRecipeBody((req.body.data ?? req.body) as Record<string, unknown>);
    const recipe = await prisma.lpRecipe.upsert({
      where:  { id: (b.id as string) ?? '' },
      create: { ...b, createdBy: (req as AuthRequest).user.id } as any,
      update: b as any,
    });
    res.json(serializeRecipe(recipe as unknown as Record<string, unknown>));
  } catch (e) { next(e); }
});

learningRoutes.delete('/recipes/:id', requireEditor, async (req, res, next) => {
  try {
    await prisma.lpRecipe.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Sample Image Guide ────────────────────────────────────────────────────────

learningRoutes.get('/courses/:courseId/sample-guide', async (req, res, next) => {
  try {
    const row = await prisma.lpSampleImageGuide.findUnique({ where: { courseId: req.params.courseId } });
    const signed = row?.sampleImagePath ? await createSignedUrl('learning-media', row.sampleImagePath) : null;
    res.json({
      course_id:         row?.courseId ?? null,
      sample_image_path: row?.sampleImagePath ?? null,
      guidelines_md:     row?.guidelinesMd ?? '',
      sample_image_url:  signed,
    });
  } catch (e) { next(e); }
});

learningRoutes.post('/courses/:courseId/sample-guide', requireEditor, async (req, res, next) => {
  try {
    const b = mapSampleGuideBody((req.body.data ?? req.body) as Record<string, unknown>);
    const guide = await prisma.lpSampleImageGuide.upsert({
      where:  { courseId: req.params.courseId },
      create: { courseId: req.params.courseId, ...b } as any,
      update: b as any,
    });
    res.json({
      course_id:         guide.courseId,
      sample_image_path: guide.sampleImagePath ?? null,
      guidelines_md:     guide.guidelinesMd,
    });
  } catch (e) { next(e); }
});

// ── Quiz Bank ─────────────────────────────────────────────────────────────────

learningRoutes.get('/courses/:courseId/quiz-bank', async (req, res, next) => {
  try {
    const quizzes = await prisma.lpQuiz.findMany({ where: { courseId: req.params.courseId } });
    const links   = await prisma.lpQuizQuestion.findMany({
      where: { quizId: { in: quizzes.map(q => q.id) } },
      include: { question: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ quizzes, questions: links });
  } catch (e) { next(e); }
});

learningRoutes.post('/quiz-questions', requireEditor, async (req, res, next) => {
  try {
    const { id, course_id, module_id, position, prompt, options, correct_index, explanation } = req.body;
    // Find or create quiz for this module+position
    const isFinal = position === 'end';
    const quiz = await prisma.lpQuiz.upsert({
      where: { id: '' },
      create: { courseId: course_id, moduleId: module_id, title: isFinal ? 'End quiz' : 'Mid quiz', isFinal },
      update: {},
    }).catch(() => prisma.lpQuiz.findFirst({ where: { courseId: course_id, moduleId: module_id, isFinal } })
      .then(q => q ?? prisma.lpQuiz.create({ data: { courseId: course_id, moduleId: module_id, title: isFinal ? 'End quiz' : 'Mid quiz', isFinal } })));

    let question;
    if (id) {
      question = await prisma.lpQuestion.update({
        where: { id },
        data:  { courseId: course_id, prompt, options, correct: [correct_index], explanation: explanation ?? null },
      });
    } else {
      question = await prisma.lpQuestion.create({
        data: { courseId: course_id, prompt, options, correct: [correct_index], explanation: explanation ?? null },
      });
      await prisma.lpQuizQuestion.create({
        data: { quizId: quiz!.id, questionId: question.id, sortOrder: Date.now() },
      });
    }
    res.json({ id: question.id });
  } catch (e) { next(e); }
});

learningRoutes.delete('/quiz-questions/:id', requireEditor, async (req, res, next) => {
  try {
    await prisma.lpQuestion.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
