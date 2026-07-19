import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import type { LpPartnerCertificate } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth, requirePermission, requireAnyPermission, AuthRequest } from '../../middleware/auth';
import { createNotification } from '../../lib/notifications';

const requireCourseBuilder = requirePermission('sft_course_builder');
const requireInviteCertify = requirePermission('sft_invite_certify');
const requireReview        = requirePermission('sft_review');
const requirePhysicalVisit = requirePermission('sft_physical_visit');
// Invite CRUD is used both from the dedicated Invite & Certify page and from
// an embedded invites tab inside the Course Builder's course-detail page.
const requireCourseBuilderOrInviteCertify = requireAnyPermission(['sft_course_builder', 'sft_invite_certify']);
// Certificate issue/revoke and the eligibility list are used both from the
// Invite & Certify page and from the SFT Review queue.
const requireInviteCertifyOrReview = requireAnyPermission(['sft_invite_certify', 'sft_review']);
import { createSignedUrl, createSignedUploadUrl, signFilePaths, getFileBuffer } from '../../lib/storage';
import { parsePptx } from '../../lib/pptx-parser';
import { getCachedSlides } from '../../lib/deck-slides-cache';
import { randomUUID } from 'crypto';
import { sendPartnerInviteEmail, sendPhysicalVisitEmails } from '../../services/email-dispatch';

export const sftRoutes = Router();
sftRoutes.use(requireAuth);

// ── Helper: map snake_case body → camelCase for Prisma ────────────────────────
function mapModuleBody(b: Record<string, unknown>): Record<string, unknown> {
  const d: Record<string, unknown> = { ...b };
  const rename: Record<string, string> = {
    day_id: 'dayId', course_id: 'courseId', video_url: 'videoUrl',
    reading_md: 'readingMd', file_path: 'filePath', est_minutes: 'estMinutes', deck_id: 'deckId',
    quiz_enabled: 'quizEnabled', quiz_pass_pct: 'quizPassPct',
    quiz_placement: 'quizPlacement', quiz_questions: 'quizQuestions',
    autoplay_advance: 'autoplayAdvance', default_slide_seconds: 'defaultSlideSeconds',
    slide_overrides: 'slideOverrides', sort_order: 'sortOrder',
  };
  for (const [snake, camel] of Object.entries(rename)) {
    if (snake in d) { d[camel] = d[snake]; delete d[snake]; }
  }
  return d;
}

// ── Helper: map snake_case course body → camelCase for Prisma ────────────────
function mapCourseBody(b: Record<string, unknown>): Record<string, unknown> {
  const d: Record<string, unknown> = { ...b };
  const rename: Record<string, string> = {
    program_id: 'programId', duration_label: 'durationLabel', cover_url: 'coverUrl',
    pass_pct: 'passPct', max_attempts: 'maxAttempts', day5_gate_days: 'day5GateDays',
    requires_product_upload: 'requiresProductUpload', requires_inspection: 'requiresInspection',
    issues_certificate: 'issuesCertificate', sort_order: 'sortOrder', max_cuisines: 'maxCuisines',
    product_brief: 'productBrief', inspection_rubric: 'inspectionRubric',
    certificate_template: 'certificateTemplate', certificate_templates: 'certificateTemplates',
    welcome_letter: 'welcomeLetter',
    supported_languages: 'supportedLanguages', journey_steps: 'journeySteps',
    section_order: 'sectionOrder', resource_categories: 'resourceCategories',
    video_categories: 'videoCategories',
  };
  for (const [snake, camel] of Object.entries(rename)) {
    if (snake in d) { d[camel] = d[snake]; delete d[snake]; }
  }
  return d;
}

// ── Helper: serialize Prisma course (camelCase) → snake_case for the frontend ─
function serializeCourse(c: Record<string, unknown>) {
  return {
    id:                      c.id,
    program_id:              c.programId,
    slug:                    c.slug,
    title:                   c.title,
    summary:                 c.summary,
    duration_label:          c.durationLabel,
    cover_url:               c.coverUrl,
    pass_pct:                c.passPct,
    max_attempts:            c.maxAttempts,
    day5_gate_days:          c.day5GateDays,
    requires_product_upload: c.requiresProductUpload,
    requires_inspection:     c.requiresInspection,
    issues_certificate:      c.issuesCertificate,
    max_cuisines:            c.maxCuisines,
    published:               c.published,
    sort_order:              c.sortOrder,
    product_brief:           c.productBrief,
    inspection_rubric:       c.inspectionRubric,
    certificate_template:    c.certificateTemplate,
    certificate_templates:   c.certificateTemplates,
    welcome_letter:          c.welcomeLetter,
    supported_languages:     c.supportedLanguages,
    journey_steps:           c.journeySteps,
    section_order:           c.sectionOrder,
    resource_categories:     c.resourceCategories,
    video_categories:        c.videoCategories,
    created_at:              c.createdAt,
    updated_at:              c.updatedAt,
  };
}
function serializeInvite(i: Record<string, unknown>) {
  return {
    id:               i.id,
    course_id:        i.courseId,
    recipient_name:   i.recipientName,
    recipient_email:  i.recipientEmail,
    kitchen_location: i.kitchenLocation,
    message:          i.message,
    token:            i.token,
    status:           i.status,
    invited_by:       i.invitedBy,
    user_id:          i.userId,
    sent_at:          i.sentAt,
    opened_at:        i.openedAt,
    accepted_at:      i.acceptedAt,
    revoked_at:       i.revokedAt,
    created_at:       i.createdAt,
  };
}

// ── Helper: map snake_case resource body → camelCase for Prisma ──────────────
function mapResourceBody(b: Record<string, unknown>): Record<string, unknown> {
  const d: Record<string, unknown> = { ...b };
  const rename: Record<string, string> = {
    course_id: 'courseId', brand_id: 'brandId', file_path: 'filePath',
    sort_order: 'sortOrder', created_by: 'createdBy',
  };
  for (const [snake, camel] of Object.entries(rename)) {
    if (snake in d) { d[camel] = d[snake]; delete d[snake]; }
  }
  return d;
}

// ── Helper: map snake_case video body → camelCase for Prisma ─────────────────
function mapVideoBody(b: Record<string, unknown>): Record<string, unknown> {
  const d: Record<string, unknown> = { ...b };
  const rename: Record<string, string> = {
    course_id: 'courseId', brand_id: 'brandId', video_path: 'videoPath',
    external_url: 'externalUrl', thumbnail_path: 'thumbnailPath',
    sort_order: 'sortOrder', created_by: 'createdBy',
  };
  for (const [snake, camel] of Object.entries(rename)) {
    if (snake in d) { d[camel] = d[snake]; delete d[snake]; }
  }
  return d;
}

// ── Helper: serialize Prisma module (camelCase) → snake_case for the frontend ─
function serializeModule(m: Record<string, unknown>) {
  return {
    id:                    m.id,
    course_id:             m.courseId,
    sort_order:            m.sortOrder,
    type:                  m.type,
    title:                 m.title,
    summary:               m.summary,
    est_minutes:           m.estMinutes,
    deck_id:               m.deckId,
    video_url:             m.videoUrl,
    reading_md:            m.readingMd,
    file_path:             m.filePath,
    published:             m.published,
    slide_overrides:       m.slideOverrides,
    voice:                 m.voice,
    language:              m.language,
    speed:                 m.speed,
    autoplay_advance:      m.autoplayAdvance,
    default_slide_seconds: m.defaultSlideSeconds,
    quiz_enabled:          m.quizEnabled,
    quiz_pass_pct:         m.quizPassPct,
    quiz_questions:        m.quizQuestions,
    day_id:                m.dayId,
    quiz_placement:        m.quizPlacement,
    pdf_path:              (m.deck as { pdfPath?: string | null } | undefined)?.pdfPath ?? null,
    created_at:            m.createdAt,
    updated_at:            m.updatedAt,
  };
}

function serializeCourseDay(d: Record<string, unknown>) {
  return {
    id:                 d.id,
    course_id:          d.courseId,
    day_no:             d.dayNo,
    title:              d.title,
    summary:            d.summary,
    unlock_after_days:  d.unlockAfterDays,
    sort_order:         d.sortOrder,
    created_at:         d.createdAt,
    updated_at:         d.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAMS
// ─────────────────────────────────────────────────────────────────────────────

sftRoutes.get('/programs', async (_req, res, next) => {
  try {
    const programs = await prisma.lpProgram.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(programs);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// COURSES
// ─────────────────────────────────────────────────────────────────────────────

sftRoutes.get('/courses', async (_req, res, next) => {
  try {
    const courses = await prisma.lpCourse.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(courses.map(c => serializeCourse(c as unknown as Record<string, unknown>)));
  } catch (e) { next(e); }
});

sftRoutes.get('/courses/:courseId', async (req, res, next) => {
  try {
    const course = await prisma.lpCourse.findUniqueOrThrow({ where: { id: req.params.courseId } });
    const [program, modules, days] = await Promise.all([
      prisma.lpProgram.findUniqueOrThrow({ where: { id: course.programId } }),
      prisma.lpModule.findMany({ where: { courseId: course.id }, orderBy: { sortOrder: 'asc' }, include: { deck: true } }),
      prisma.lpCourseDay.findMany({ where: { courseId: course.id }, orderBy: { dayNo: 'asc' } }),
    ]);
    res.json({
      course: serializeCourse(course as unknown as Record<string, unknown>),
      program,
      modules: modules.map(serializeModule),
      days: days.map(d => serializeCourseDay(d as unknown as Record<string, unknown>)),
    });
  } catch (e) { next(e); }
});

sftRoutes.get('/courses/:courseId/teach-data', async (req, res, next) => {
  try {
    const [course, module] = await Promise.all([
      prisma.lpCourse.findUniqueOrThrow({ where: { id: req.params.courseId } }),
      prisma.lpModule.findFirst({
        where: { courseId: req.params.courseId, type: 'slides', deckId: { not: null }, dayId: null },
        orderBy: { sortOrder: 'asc' },
        include: { deck: true },
      }),
    ]);
    if (!module || !module.deck) {
      res.json({ course: serializeCourse(course as unknown as Record<string, unknown>), module: null, deck: null, deckUrl: null, pdfUrl: null });
      return;
    }
    // The pitch player only needs the deck's text (titles/bullets/speaker
    // notes) — parse it here (cached) instead of making the admin's browser
    // download the full, often multi-MB .pptx just to read that text.
    const [deckUrl, pdfUrl, slides] = await Promise.all([
      createSignedUrl('sft-decks', module.deck.filePath),
      module.deck.pdfPath ? createSignedUrl('sft-decks', module.deck.pdfPath) : Promise.resolve(null),
      getCachedSlides(module.deck.filePath, () =>
        getFileBuffer('sft-decks', module.deck!.filePath).then(parsePptx),
      ),
    ]);
    res.json({
      course: serializeCourse(course as unknown as Record<string, unknown>),
      module: serializeModule(module as unknown as Record<string, unknown>),
      deck: {
        id:              module.deck.id,
        name:            module.deck.name,
        file_path:       module.deck.filePath,
        pdf_path:        module.deck.pdfPath,
        voice:           module.deck.voice,
        speed:           module.deck.speed,
        autoplay_advance: module.deck.autoplayAdvance,
      },
      deckUrl,
      pdfUrl,
      slides,
    });
  } catch (e) { next(e); }
});

sftRoutes.post('/courses', requireCourseBuilder, async (req, res, next) => {
  try {
    const { title, program_id, programId, slug, ...rest } = req.body as {
      title: string; program_id?: string; programId?: string; slug?: string; [key: string]: unknown;
    };
    const pid = programId || program_id;
    if (!pid) { res.status(400).json({ error: 'program_id required' }); return; }
    const autoSlug = (slug || title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now().toString(36);
    const course = await prisma.lpCourse.create({
      data: { title, slug: autoSlug, program: { connect: { id: pid } }, ...rest },
    });
    res.status(201).json(course);
  } catch (e) { next(e); }
});

sftRoutes.patch('/courses/:courseId', requireCourseBuilder, async (req, res, next) => {
  try {
    const data = mapCourseBody((req.body.data ?? req.body) as Record<string, unknown>);
    const course = await prisma.lpCourse.update({ where: { id: req.params.courseId }, data });
    res.json(serializeCourse(course as unknown as Record<string, unknown>));
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULES
// ─────────────────────────────────────────────────────────────────────────────

sftRoutes.post('/modules', requireCourseBuilder, async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>;
    const courseId = (b.courseId || b.course_id) as string;
    const dayId    = (b.dayId    || b.day_id)    as string | undefined;
    const deckId   = (b.deckId   || b.deck_id)   as string | undefined;

    if (!courseId) { res.status(400).json({ error: 'course_id required' }); return; }

    const last = await prisma.lpModule.findFirst({
      where: { courseId }, orderBy: { sortOrder: 'desc' },
    });

    const module = await prisma.lpModule.create({
      data: {
        courseId,
        dayId:               dayId ?? null,
        deckId:              deckId ?? null,
        title:               (b.title as string) ?? 'New Topic',
        type:                (b.type as 'slides' | 'video' | 'reading' | 'mixed') ?? 'reading',
        summary:             (b.summary as string) ?? null,
        estMinutes:          (b.est_minutes ?? b.estMinutes) as number | null ?? null,
        readingMd:           (b.reading_md ?? b.readingMd) as string | null ?? null,
        filePath:            (b.file_path ?? b.filePath) as string | null ?? null,
        videoUrl:            (b.video_url ?? b.videoUrl) as string | null ?? null,
        published:           (b.published as boolean) ?? false,
        voice:               (b.voice as string) ?? null,
        language:            (b.language as string) ?? 'en',
        speed:               (b.speed as number) ?? 1.0,
        autoplayAdvance:     ((b.autoplay_advance ?? b.autoplayAdvance) as boolean) ?? true,
        defaultSlideSeconds: ((b.default_slide_seconds ?? b.defaultSlideSeconds) as number) ?? 5,
        quizEnabled:         ((b.quiz_enabled ?? b.quizEnabled) as boolean) ?? false,
        quizPassPct:         ((b.quiz_pass_pct ?? b.quizPassPct) as number) ?? 70,
        quizPlacement:       ((b.quiz_placement ?? b.quizPlacement) as string) ?? 'topic',
        sortOrder:           (last?.sortOrder ?? -1) + 1,
        slideOverrides:      {},
        quizQuestions:       [],
      },
    });
    res.status(201).json(module);
  } catch (e) { next(e); }
});

sftRoutes.patch('/modules/:id', requireCourseBuilder, async (req, res, next) => {
  try {
    const data = mapModuleBody((req.body.data ?? req.body) as Record<string, unknown>);
    const mod = await prisma.lpModule.update({ where: { id: req.params.id }, data });
    res.json(serializeModule(mod as unknown as Record<string, unknown>));
  } catch (e) { next(e); }
});

sftRoutes.delete('/modules/:id', requireCourseBuilder, async (req, res, next) => {
  try {
    await prisma.lpModule.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

sftRoutes.post('/modules/reorder', requireCourseBuilder, async (req, res, next) => {
  try {
    const { course_id, order } = req.body as { course_id: string; order: string[] };
    await prisma.$transaction(
      order.map((id, i) => prisma.lpModule.update({ where: { id, courseId: course_id }, data: { sortOrder: i } })),
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// COURSE DAYS
// ─────────────────────────────────────────────────────────────────────────────

sftRoutes.get('/courses/:courseId/days', async (req, res, next) => {
  try {
    const days = await prisma.lpCourseDay.findMany({
      where: { courseId: req.params.courseId },
      orderBy: { dayNo: 'asc' },
    });
    res.json(days.map(d => serializeCourseDay(d as unknown as Record<string, unknown>)));
  } catch (e) { next(e); }
});

sftRoutes.post('/courses/:courseId/days', requireCourseBuilder, async (req, res, next) => {
  try {
    
    const courseId = req.params.courseId;
    const last = await prisma.lpCourseDay.findFirst({ where: { courseId }, orderBy: { dayNo: 'desc' } });
    const nextNo    = (last?.dayNo    ?? 0) + 1;
    const nextOrder = (last?.sortOrder ?? -1) + 1;
    const day = await prisma.lpCourseDay.create({
      data: {
        courseId,
        dayNo:           nextNo,
        sortOrder:       nextOrder,
        title:           req.body.title ?? `Day ${nextNo}`,
        summary:         req.body.summary ?? null,
        unlockAfterDays: req.body.unlock_after_days ?? req.body.unlockAfterDays ?? 0,
      },
    });
    res.status(201).json(serializeCourseDay(day as unknown as Record<string, unknown>));
  } catch (e) { next(e); }
});

sftRoutes.post('/courses/:courseId/days/reset', requireCourseBuilder, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    await prisma.$transaction([
      prisma.lpModule.updateMany({ where: { courseId }, data: { dayId: null } }),
      prisma.lpCourseDay.deleteMany({ where: { courseId } }),
    ]);
    const day = await prisma.lpCourseDay.create({
      data: { courseId, dayNo: 1, sortOrder: 0, title: 'Day 1', unlockAfterDays: 0 },
    });
    res.json({ ok: true, day: serializeCourseDay(day as unknown as Record<string, unknown>) });
  } catch (e) { next(e); }
});

sftRoutes.patch('/days/:id', requireCourseBuilder, async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (b.title !== undefined)        data.title = b.title;
    if (b.summary !== undefined)      data.summary = b.summary;
    if (b.unlock_after_days !== undefined) data.unlockAfterDays = b.unlock_after_days;
    if (b.unlockAfterDays !== undefined)   data.unlockAfterDays = b.unlockAfterDays;
    const day = await prisma.lpCourseDay.update({ where: { id: req.params.id }, data });
    res.json(serializeCourseDay(day as unknown as Record<string, unknown>));
  } catch (e) { next(e); }
});

sftRoutes.delete('/days/:id', requireCourseBuilder, async (req, res, next) => {
  try {
    const day = await prisma.lpCourseDay.findUniqueOrThrow({ where: { id: req.params.id } });
    const siblings = await prisma.lpCourseDay.findMany({
      where: { courseId: day.courseId }, orderBy: { dayNo: 'asc' },
    });
    if (siblings.length <= 1) { res.status(400).json({ error: 'A course must have at least one day' }); return; }
    const idx      = siblings.findIndex(s => s.id === day.id);
    const fallback = siblings[idx === 0 ? 1 : idx - 1];
    await prisma.$transaction([
      prisma.lpModule.updateMany({ where: { dayId: day.id }, data: { dayId: fallback.id } }),
      prisma.lpCourseDay.delete({ where: { id: day.id } }),
    ]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DECK SETUP
// ─────────────────────────────────────────────────────────────────────────────

sftRoutes.get('/decks', async (_req, res, next) => {
  try {
    const decks = await prisma.sftDeckSetup.findMany({ orderBy: { uploadedAt: 'desc' } });
    res.json(decks);
  } catch (e) { next(e); }
});

sftRoutes.get('/decks/active', async (_req, res, next) => {
  try {
    const deck = await prisma.sftDeckSetup.findFirst({
      where:   { active: true },
      orderBy: { uploadedAt: 'desc' },
    });
    res.json(deck);
  } catch (e) { next(e); }
});
sftRoutes.get('/decks/:id', async (req, res, next) => {
  try {
    const deck = await prisma.sftDeckSetup.findUnique({ where: { id: req.params.id } });
    if (!deck) { res.status(404).json({ error: 'Deck not found' }); return; }
    res.json(deck);
  } catch (e) { next(e); }
});

sftRoutes.post('/decks', requireCourseBuilder, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const b = req.body as Record<string, unknown>;
    await prisma.sftDeckSetup.updateMany({ where: { active: true }, data: { active: false } });
    const deck = await prisma.sftDeckSetup.create({
      data: {
        name:            (b.name as string) ?? 'Untitled deck',
        filePath:        (b.file_path ?? b.filePath) as string,
        pdfPath:         (b.pdf_path ?? b.pdfPath) as string | null ?? null,
        voice:           (b.voice as string) ?? undefined,
        speed:           (b.speed as number) ?? 1.0,
        autoplayAdvance: (b.autoplay_advance ?? b.autoplayAdvance) as boolean ?? true,
        uploadedBy:      userId,
        active:          true,
      },
    });
    // Link deck to the course's slides module (upsert)
    const courseId = (b.course_id ?? b.courseId) as string | undefined;
    if (courseId) {
      const existingSlides = await prisma.lpModule.findFirst({
        where: { courseId, type: 'slides', dayId: null },
        orderBy: { sortOrder: 'asc' },
      });
      if (existingSlides) {
        await prisma.lpModule.update({ where: { id: existingSlides.id }, data: { deckId: deck.id } });
      } else {
        const last = await prisma.lpModule.findFirst({ where: { courseId }, orderBy: { sortOrder: 'desc' } });
        await prisma.lpModule.create({
          data: {
            courseId,
            title: deck.name,
            type: 'slides',
            deckId: deck.id,
            sortOrder: (last?.sortOrder ?? -1) + 1,
            language: 'en',
            speed: 1.0,
            autoplayAdvance: true,
            defaultSlideSeconds: 5,
            quizEnabled: false,
            quizPassPct: 70,
            quizPlacement: 'topic',
            slideOverrides: {},
            quizQuestions: [],
          },
        });
      }
    }
    res.status(201).json(deck);
  } catch (e) { next(e); }
});
sftRoutes.patch('/decks/:id', requireCourseBuilder, async (req, res, next) => {
  try {
    const b = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (b.name !== undefined)                          data.name = b.name;
    if (b.file_path !== undefined || b.filePath !== undefined) data.filePath = b.file_path ?? b.filePath;
    if (b.pdf_path !== undefined || b.pdfPath !== undefined)   data.pdfPath = b.pdf_path ?? b.pdfPath;
    if (b.voice !== undefined)                         data.voice = b.voice;
    if (b.speed !== undefined)                         data.speed = b.speed;
    if (b.autoplay_advance !== undefined || b.autoplayAdvance !== undefined)
      data.autoplayAdvance = b.autoplay_advance ?? b.autoplayAdvance;
    const deck = await prisma.sftDeckSetup.update({ where: { id: req.params.id }, data });
    res.json(deck);
  } catch (e) { next(e); }

});

sftRoutes.post('/decks/:id/signed-url', async (req, res, next) => {
  try {
    const deck = await prisma.sftDeckSetup.findUniqueOrThrow({ where: { id: req.params.id } });
    const url = await createSignedUrl('sft-decks', deck.filePath);
    const pdfUrl = deck.pdfPath ? await createSignedUrl('sft-decks', deck.pdfPath) : null;
    res.json({ url, pdfUrl });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD SIGNED URL
// ─────────────────────────────────────────────────────────────────────────────

sftRoutes.post('/storage/signed-url', async (req, res, next) => {
  try {
    const { bucket, path } = req.body as { bucket: string; path: string };
    const url = await createSignedUrl(bucket, path);
    res.json({ url });
  } catch (e) { next(e); }
});

sftRoutes.post('/storage/signed-upload-url', async (req, res, next) => {
  try {
    const { bucket, path } = req.body as { bucket: string; path: string };
    const result = await createSignedUploadUrl(bucket, path);
    res.json(result);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER INVITES
// ─────────────────────────────────────────────────────────────────────────────

function serializeVisit(v: Record<string, unknown>) {
  return {
    id:                     v.id,
    user_id:                v.userId,
    course_id:              v.courseId,
    status:                 v.status,
    visitor_name:           v.visitorName,
    visitor_email:          v.visitorEmail,
    visitor_phone:          v.visitorPhone,
    visitor_location:       v.visitorLocation ?? null,
    visit_date:             v.visitDate,
    visit_time:             v.visitTime,
    remarks:                v.remarks,
    decision:               v.finalDecision ?? null,
    decision_comments:      v.decisionComments ?? null,
    total_products:         v.totalProducts ?? null,
    accepted_products:      v.acceptedProducts ?? null,
    rejected_products:      v.rejectedProducts ?? null,
    inspection_percentage:  v.inspectionPercentage ?? null,
    product_inspections:    v.productInspections ?? [],
    partner_location:       v.partnerLocation,
    partner_state:          v.partnerState,
    partner_country:        v.partnerCountry,
    partner_phone:          v.partnerPhone,
    partner_address:        v.partnerAddress,
    cuisine_id:             v.cuisineId,
    cuisine_name:           v.cuisineName ?? null,
    recipe_id:              v.recipeId,
    assigned_products:      v.assignedProducts ?? [],
    photos:                 v.photos ?? [],
    history:                v.history ?? [],
    attempt_no:             v.attemptNo,
    form_status:            v.formStatus,
    created_at:             v.createdAt,
    updated_at:             v.updatedAt,
    partner_name:           v.partnerName ?? null,
    partner_email:          v.partnerEmail ?? null,
  };
}

sftRoutes.get('/courses/:courseId/invites', requireCourseBuilderOrInviteCertify, async (req, res, next) => {
  try {
    const invites = await prisma.lpPartnerInvite.findMany({
      where:   { courseId: req.params.courseId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invites.map(i => serializeInvite(i as unknown as Record<string, unknown>)));
  } catch (e) { next(e); }
});

sftRoutes.post('/invites', requireCourseBuilderOrInviteCertify, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { course_id, recipient_name, recipient_email, kitchen_location, message } = req.body as {
      course_id: string; recipient_name: string; recipient_email: string;
      kitchen_location?: string; message?: string;
    };
    const invite = await prisma.lpPartnerInvite.create({
      data: {
        courseId:        course_id,
        recipientName:   recipient_name,
        recipientEmail:  recipient_email,
        kitchenLocation: kitchen_location,
        message,
        invitedBy:       userId,
        status:          'sent',
      },
    });
    await prisma.lpPartnerEvent.create({
      data: {
        courseId:  invite.courseId,
        inviteId:  invite.id,
        eventType: 'invite_created',
        payload:   { recipient_email: invite.recipientEmail },
      },
    });
    try { await sendPartnerInviteEmail(invite.id); } catch (e) { console.error('[invite] email failed', e); }
    res.status(201).json(serializeInvite(invite as unknown as Record<string, unknown>));
  } catch (e) { next(e); }
});

sftRoutes.post('/invites/:id/revoke', requireCourseBuilderOrInviteCertify, async (req, res, next) => {
  try {
    await prisma.lpPartnerInvite.update({
      where: { id: req.params.id },
      data:  { status: 'revoked', revokedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

sftRoutes.post('/invites/:id/resend', requireCourseBuilderOrInviteCertify, async (req, res, next) => {
  try {
    const result = await sendPartnerInviteEmail(req.params.id);
    res.json(result);
  } catch (e) { next(e); }
});
sftRoutes.get('/invites/:id/events', requireInviteCertifyOrReview, async (req, res, next) => {
  try {
    const invite = await prisma.lpPartnerInvite.findUniqueOrThrow({ where: { id: req.params.id } });
    const course = await prisma.lpCourse.findUniqueOrThrow({ where: { id: invite.courseId }, select: { id: true, title: true } });

    let profile: { displayName: string | null; phone: string | null } | null = null;
    let user: { createdAt: Date; lastSignInAt: Date | null } | null = null;
    if (invite.userId) {
      [profile, user] = await Promise.all([
        prisma.profile.findUnique({ where: { id: invite.userId }, select: { displayName: true, phone: true } }),
        prisma.user.findUnique({ where: { id: invite.userId }, select: { createdAt: true, lastSignInAt: true } }),
      ]);
    }

    const modules = invite.userId
      ? await prisma.lpModule.findMany({
          where: { courseId: invite.courseId, published: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, title: true, sortOrder: true, dayId: true },
        })
      : [];

    const progress = invite.userId && modules.length
      ? await prisma.lpModuleProgress.findMany({
          where: { userId: invite.userId, moduleId: { in: modules.map(m => m.id) } },
          select: { moduleId: true, completedAt: true, progressPct: true },
        })
      : [];
    const progressByModule = new Map(progress.map(p => [p.moduleId, p]));

    const modulesOut = modules.map(m => ({
      id: m.id,
      title: m.title,
      sort_order: m.sortOrder,
      completed_at: progressByModule.get(m.id)?.completedAt ?? null,
      progress_pct: progressByModule.get(m.id)?.progressPct ?? 0,
    }));

    // Day-level milestones ("Day 1 Completed" etc.) — a day counts as done once
    // every one of its modules has a completedAt.
    const days = invite.userId && modules.length
      ? await prisma.lpCourseDay.findMany({ where: { courseId: invite.courseId }, orderBy: { dayNo: 'asc' } })
      : [];
    const modulesByDay = new Map<string, typeof modules>();
    modules.forEach(m => { if (m.dayId) { const arr = modulesByDay.get(m.dayId) ?? []; arr.push(m); modulesByDay.set(m.dayId, arr); } });
    const dayMilestones = days
      .map(d => {
        const dayModules = modulesByDay.get(d.id) ?? [];
        if (!dayModules.length) return null;
        const completions = dayModules.map(m => progressByModule.get(m.id)?.completedAt ?? null);
        if (completions.some(c => !c)) return null;
        const at = completions.reduce((latest: Date, c) => (c! > latest ? c! : latest), completions[0]!);
        return { title: `Day ${d.dayNo} Completed`, at, detail: null };
      })
      .filter((m): m is { title: string; at: Date; detail: null } => m !== null);

    const quizAttempts = invite.userId && modules.length
      ? await prisma.lpModuleQuizAttempt.findMany({
          where: { userId: invite.userId, moduleId: { in: modules.map(m => m.id) }, passed: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const quizMilestones = (() => {
      const seenPlacement = new Set<string>();
      return quizAttempts
        .filter(a => { if (seenPlacement.has(a.placement)) return false; seenPlacement.add(a.placement); return true; })
        .map(a => ({
          title: a.placement === 'end' ? 'Final Quiz' : 'Mid Quiz Completed',
          at: a.createdAt,
          detail: `${Math.round(a.scorePct)}%`,
        }));
    })();

    const submissionsRaw = invite.userId
      ? await prisma.lpProductSubmission.findMany({
          where: { userId: invite.userId, courseId: invite.courseId },
          orderBy: { submittedAt: 'desc' },
        })
      : [];

    const submissions = await Promise.all(
      submissionsRaw.map(async (s) => {
        const filesArr = (Array.isArray(s.files) ? s.files : []) as Array<{
          path: string; label?: string | null; decision?: string | null; remark?: string | null;
        }>;
        const urls = await signFilePaths('sft-practice', filesArr.map(f => f.path));
        return {
          id: s.id,
          submitted_at: s.submittedAt,
          reviewed_at: s.reviewedAt,
          feedback: s.feedback,
          notes: s.notes,
          status: s.status,
          files_signed: filesArr.map((f, i) => ({
            path: f.path,
            label: f.label ?? null,
            url: urls[i] ?? '',
            decision: f.decision ?? null,
            remark: f.remark ?? null,
          })),
        };
      }),
    );

    // Selected cuisine(s) + when Prepare & Cook started (first product assigned).
    const assignments = invite.userId
      ? await prisma.lpProductAssignment.findMany({ where: { userId: invite.userId, courseId: invite.courseId } })
      : [];
    const cuisineIds = [...new Set(assignments.map(a => a.cuisineId))];
    const cuisines = cuisineIds.length ? await prisma.lpCuisine.findMany({ where: { id: { in: cuisineIds } } }) : [];
    const cookStartedAt = assignments.length
      ? assignments.reduce((earliest, a) => (a.createdAt < earliest ? a.createdAt : earliest), assignments[0].createdAt)
      : null;

    const visit = invite.userId
      ? await prisma.lpPhysicalVisit.findFirst({
          where: { userId: invite.userId, courseId: invite.courseId },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    const certificate = invite.userId
      ? await prisma.lpCertificate.findUnique({
          where: { userId_courseId: { userId: invite.userId, courseId: invite.courseId } },
          select: { id: true, code: true, issuedAt: true, revokedAt: true },
        })
      : null;

    const events = await prisma.lpPartnerEvent.findMany({
      where: { inviteId: invite.id },
      orderBy: { createdAt: 'asc' },
    });

    const timeline = [
      { title: 'Invited', at: invite.sentAt, detail: null },
      ...(invite.acceptedAt ? [{ title: 'Accepted invite', at: invite.acceptedAt, detail: null }] : []),
      ...(user ? [{ title: 'Registered', at: user.createdAt, detail: null }] : []),
      ...(user?.lastSignInAt ? [{ title: 'Last login', at: user.lastSignInAt, detail: null }] : []),
      ...(cookStartedAt ? [{ title: 'Prepare & Cook Started', at: cookStartedAt, detail: null }] : []),
      ...dayMilestones,
      ...quizMilestones,
      ...events.map(e => ({ title: e.eventType.replace(/_/g, ' '), at: e.createdAt, detail: null })),
      ...(visit?.assignedAt
        ? [{ title: 'Physical Visit Scheduled', at: visit.assignedAt, detail: visit.visitDate ? `Scheduled for ${visit.visitDate}${visit.visitTime ? ` ${visit.visitTime}` : ''}` : null }]
        : []),
      ...(visit?.submittedAt ? [{ title: 'Physical Visit Completed', at: visit.submittedAt, detail: null }] : []),
    ].sort((a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime());

    res.json({
      partner: {
        display_name: profile?.displayName ?? null,
        email: invite.recipientEmail,
        user_id: invite.userId,
        mobile: profile?.phone ?? null,
        city: invite.kitchenLocation ?? null,
        cuisines: cuisines.map(c => c.name),
      },
      invite: { recipient_name: invite.recipientName },
      course: { id: course.id, title: course.title },
      modules: modulesOut,
      submissions,
      certificate: certificate && !certificate.revokedAt
        ? { id: certificate.id, code: certificate.code, issued_at: certificate.issuedAt }
        : null,
      timeline,
    });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW QUEUE
// ─────────────────────────────────────────────────────────────────────────────

sftRoutes.get('/review', requireInviteCertifyOrReview, async (req, res, next) => {
  try {
    const { courseId } = req.query as { courseId?: string };
    const invites = await prisma.lpPartnerInvite.findMany({
      where:   { ...(courseId ? { courseId } : {}), revokedAt: null },
      orderBy: { sentAt: 'desc' },
    });
    const userIds   = invites.map(i => i.userId).filter((x): x is string => !!x);
    const courseIds = [...new Set(invites.map(i => i.courseId))];

    const [courses, mods, submissions, certs, extraCerts] = await Promise.all([
      prisma.lpCourse.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true, certificateTemplates: true } }),
      prisma.lpModule.findMany({ where: { courseId: { in: courseIds }, published: true }, select: { id: true, courseId: true } }),
      userIds.length ? prisma.lpProductSubmission.findMany({ where: { userId: { in: userIds }, courseId: { in: courseIds } }, orderBy: { submittedAt: 'desc' } }) : [],
      userIds.length ? prisma.lpCertificate.findMany({ where: { userId: { in: userIds }, courseId: { in: courseIds } } }) : [],
      userIds.length ? prisma.lpPartnerCertificate.findMany({ where: { userId: { in: userIds }, courseId: { in: courseIds }, revokedAt: null } }) : [],
    ]);

    const courseMap    = new Map(courses.map(c => [c.id, c.title]));
    const extraTemplateCountByCourse = new Map(
      courses.map(c => [c.id, Array.isArray(c.certificateTemplates) ? (c.certificateTemplates as unknown[]).length : 0]),
    );
    const extraCertsByKey = new Map<string, typeof extraCerts>();
    extraCerts.forEach(c => {
      const k = `${c.userId}::${c.courseId}`;
      const arr = extraCertsByKey.get(k) ?? [];
      arr.push(c);
      extraCertsByKey.set(k, arr);
    });
    const modsByCourse = new Map<string, string[]>();
    mods.forEach(m => { const arr = modsByCourse.get(m.courseId) ?? []; arr.push(m.id); modsByCourse.set(m.courseId, arr); });

    let progress: { userId: string; moduleId: string }[] = [];
    if (userIds.length && mods.length) {
      progress = await prisma.lpModuleProgress.findMany({
        where: { userId: { in: userIds }, moduleId: { in: mods.map(m => m.id) }, completedAt: { not: null } },
        select: { userId: true, moduleId: true },
      });
    }
    const doneByKey = new Map<string, Set<string>>();
    progress.forEach(p => { const set = doneByKey.get(p.userId) ?? new Set<string>(); set.add(p.moduleId); doneByKey.set(p.userId, set); });

    // Group ALL submissions per partner+course (not just the newest) — a
    // partner can now have several small per-product submissions in flight at
    // once, so "the status" must reflect whether ANY of them still needs
    // review, not just whichever happens to be most recently created.
    const subsByKey = new Map<string, typeof submissions>();
    submissions.forEach(s => {
      const k = `${s.userId}::${s.courseId}`;
      const arr = subsByKey.get(k) ?? [];
      arr.push(s);
      subsByKey.set(k, arr);
    });
    const certByKey = new Map<string, typeof certs[0]>();
    certs.forEach(c => certByKey.set(`${c.userId}::${c.courseId}`, c));

    const rows = invites.map(i => {
      const key  = i.userId ? `${i.userId}::${i.courseId}` : '';
      const subs = key ? (subsByKey.get(key) ?? []) : [];
      const newestSub = subs[0]; // already ordered submittedAt desc
      const aggregatedStatus = subs.some(s => s.status === 'pending')
        ? 'pending'
        : (newestSub?.status ?? null);
      const cert = key ? certByKey.get(key) : undefined;
      const total = modsByCourse.get(i.courseId)?.length ?? 0;
      const done  = i.userId ? (doneByKey.get(i.userId)?.size ?? 0) : 0;
      const extra = key ? (extraCertsByKey.get(key) ?? []) : [];
      return {
        invite_id: i.id, user_id: i.userId, course_id: i.courseId,
        course_title: courseMap.get(i.courseId) ?? '—',
        recipient_name: i.recipientName, recipient_email: i.recipientEmail,
        status: i.status, sent_at: i.sentAt, accepted_at: i.acceptedAt,
        modules_total: total, modules_done: done,
        submission_status: aggregatedStatus, submission_id: newestSub?.id ?? null,
        submitted_at: newestSub?.submittedAt ?? null,
        certificate_code: cert?.code ?? null, certificate_issued_at: cert?.issuedAt ?? null,
        extra_certificates_total: extraTemplateCountByCourse.get(i.courseId) ?? 0,
        extra_certificates: extra.map(c => ({ id: c.id, template_id: c.templateId, code: c.code, issued_at: c.issuedAt })),
      };
    });
    res.json(rows);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBMISSIONS REVIEW
// ─────────────────────────────────────────────────────────────────────────────

sftRoutes.post('/submissions/:id/review', requireReview, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reviewerId = (req as AuthRequest).user.id;
    const { decision, feedback, files } = req.body as { decision: string; feedback?: string; files?: unknown[] };
    const sub = await prisma.lpProductSubmission.update({
      where: { id: req.params.id },
      data: {
        status:     decision as 'approved' | 'redo' | 'rejected',
        feedback:   feedback ?? null,
        reviewerId,
        reviewedAt: new Date(),
        ...(files ? { files: files as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    await prisma.lpPartnerEvent.create({
      data: { courseId: sub.courseId, userId: sub.userId, eventType: `submission_${decision}`, payload: { submission_id: sub.id, feedback: feedback ?? null } },
    });
    await createNotification(
      sub.userId,
      'prepare_cook',
      decision === 'approved'
        ? 'Your product submission has been approved.'
        : decision === 'redo'
          ? 'Your product submission needs changes — please redo and resubmit.'
          : 'Your product submission has been rejected.',
      feedback,
      sub.id,
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// CERTIFICATES (admin)
// ─────────────────────────────────────────────────────────────────────────────

sftRoutes.post('/certificates/issue', requireInviteCertifyOrReview, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id, course_id } = req.body as { user_id: string; course_id: string };
    const existing = await prisma.lpCertificate.findUnique({ where: { userId_courseId: { userId: user_id, courseId: course_id } } });
    if (existing) { res.json(existing); return; }
    const code = `SCP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const cert = await prisma.lpCertificate.create({ data: { userId: user_id, courseId: course_id, code } });
    await prisma.lpPartnerEvent.create({ data: { courseId: course_id, userId: user_id, eventType: 'certificate_issued_manual', payload: { code } } });
    await createNotification(user_id, 'certificate', 'A certificate has been issued for your completed course.', null, cert.id);
    res.status(201).json(cert);
  } catch (e) { next(e); }
});

sftRoutes.delete('/certificates/:id', requireInviteCertifyOrReview, async (req, res, next) => {
  try {
    const cert = await prisma.lpCertificate.delete({ where: { id: req.params.id } });
    await prisma.lpPartnerEvent.create({ data: { courseId: cert.courseId, userId: cert.userId, eventType: 'certificate_revoked', payload: { code: cert.code } } });
    await createNotification(cert.userId, 'certificate', 'Your certificate has been revoked. Please contact support for details.', null, cert.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL CERTIFICATES — a course can define several extra certificate
// templates (course.certificate_templates, an array) beyond the single main
// one above. All of them get issued together once a partner completes the
// course; each issued row is tracked separately so they can be downloaded
// individually.
// ─────────────────────────────────────────────────────────────────────────────

interface ExtraCertTemplate { id: string; title?: string }

// GET /certificates/extra?course_id=... — every issued "extra" certificate
// for a course, used by the Certify tab so admins can see what's been given
// out, and to check-then-skip already-issued ones.
sftRoutes.get('/certificates/extra', requireInviteCertifyOrReview, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courseId = String(req.query.course_id ?? '');
    if (!courseId) { res.status(400).json({ error: 'course_id is required' }); return; }
    const rows = await prisma.lpPartnerCertificate.findMany({ where: { courseId }, orderBy: { issuedAt: 'desc' } });
    res.json(rows.map(r => ({
      id: r.id, user_id: r.userId, course_id: r.courseId, template_id: r.templateId,
      code: r.code, issued_at: r.issuedAt, revoked_at: r.revokedAt,
    })));
  } catch (e) { next(e); }
});

// POST /certificates/issue-extra — issues every template defined in
// course.certificate_templates for one partner, skipping any already issued
// (matches the idempotent behaviour of the main /certificates/issue route).
sftRoutes.post('/certificates/issue-extra', requireInviteCertifyOrReview, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id, course_id } = req.body as { user_id: string; course_id: string };
    const course = await prisma.lpCourse.findUnique({ where: { id: course_id }, select: { certificateTemplates: true } });
    const templates = (Array.isArray(course?.certificateTemplates) ? course.certificateTemplates : []) as unknown as ExtraCertTemplate[];
    if (!templates.length) { res.json({ issued: [] }); return; }

    const existing = await prisma.lpPartnerCertificate.findMany({ where: { userId: user_id, courseId: course_id } });
    const already = new Set(existing.map(e => e.templateId));

    const issued: LpPartnerCertificate[] = [];
    for (const tpl of templates) {
      if (!tpl?.id || already.has(tpl.id)) continue;
      const code = `SCP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const cert = await prisma.lpPartnerCertificate.create({
        data: { userId: user_id, courseId: course_id, templateId: tpl.id, code },
      });
      issued.push(cert);
    }
    if (issued.length) {
      await prisma.lpPartnerEvent.create({
        data: { courseId: course_id, userId: user_id, eventType: 'extra_certificates_issued', payload: { codes: issued.map(i => i.code) } },
      });
      await createNotification(user_id, 'certificate', 'New certificates are ready for your completed course.', null, issued[0].id);
    }
    res.status(201).json({ issued: [...existing, ...issued].map(r => ({
      id: r.id, user_id: r.userId, course_id: r.courseId, template_id: r.templateId,
      code: r.code, issued_at: r.issuedAt,
    })) });
  } catch (e) { next(e); }
});

sftRoutes.delete('/certificates/extra/:id', requireInviteCertifyOrReview, async (req, res, next) => {
  try {
    const cert = await prisma.lpPartnerCertificate.delete({ where: { id: req.params.id } });
    await prisma.lpPartnerEvent.create({ data: { courseId: cert.courseId, userId: cert.userId, eventType: 'extra_certificate_revoked', payload: { code: cert.code } } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER SELECTED CUISINES (for Physical Visit scheduling)
// ─────────────────────────────────────────────────────────────────────────────
// The partner's own Prepare & Cook cuisine choice (LpProductAssignment) is the
// single source of truth here — the physical-visit cuisine dropdown must only
// offer cuisines the partner actually picked, not the full course cuisine list.

sftRoutes.get('/partners/:userId/courses/:courseId/selected-cuisines', requirePhysicalVisit, async (req, res, next) => {
  try {
    const { userId, courseId } = req.params;
    const assignments = await prisma.lpProductAssignment.findMany({ where: { userId, courseId } });
    if (!assignments.length) { res.json({ cuisines: [] }); return; }

    // A recipe's own cuisineId is the live source of truth — an assignment's
    // stored cuisineId can go stale if the cuisine it was picked under was
    // later deleted/recreated (same rule /my-cook-assignments already uses).
    const recipes = await prisma.lpRecipe.findMany({
      where: { id: { in: assignments.map(a => a.recipeId) } },
      select: { cuisineId: true },
    });
    const cuisineIds = new Set<string>();
    assignments.forEach(a => cuisineIds.add(a.cuisineId));
    recipes.forEach(r => { if (r.cuisineId) cuisineIds.add(r.cuisineId); });

    const cuisines = await prisma.lpCuisine.findMany({
      where: { id: { in: [...cuisineIds] } },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({
      cuisines: cuisines.map(c => ({
        id: c.id, course_id: c.courseId, name: c.name,
        sort_order: c.sortOrder, show_count: c.showCount, active: c.active,
      })),
    });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHYSICAL VISITS
// ─────────────────────────────────────────────────────────────────────────────

sftRoutes.get('/physical-visits', requirePhysicalVisit, async (req, res, next) => {
  try {
    const { status, search } = req.query as { status?: string; search?: string };

    // Existing real visit rows
    const visits = await prisma.lpPhysicalVisit.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const visitedUserIds = new Set(visits.map(v => v.userId));

    // Find approved submissions whose partner has NO physical visit row yet
    const approvedSubs = await prisma.lpProductSubmission.findMany({
      where: { status: 'approved' },
      orderBy: { reviewedAt: 'desc' },
    });
    const eligibleUserIds = [...new Set(approvedSubs.map(s => s.userId))]
      .filter(uid => !visitedUserIds.has(uid));

    let eligibleRows: typeof visits = [];
    if (eligibleUserIds.length) {
      const [invites, profiles] = await Promise.all([
        prisma.lpPartnerInvite.findMany({
          where: { userId: { in: eligibleUserIds }, revokedAt: null },
          select: { userId: true, courseId: true, recipientName: true, recipientEmail: true, kitchenLocation: true },
        }),
        prisma.profile.findMany({
          where: { id: { in: eligibleUserIds } },
          select: { id: true, displayName: true },
        }),
      ]);
      const inviteByUser = new Map(invites.map(i => [i.userId as string, i]));
      const profileByUser = new Map(profiles.map(p => [p.id, p]));

      eligibleRows = eligibleUserIds
        .map(uid => {
          const inv = inviteByUser.get(uid);
          if (!inv) return null;
          const prof = profileByUser.get(uid);
          return {
            id: `eligible-${uid}`,
            userId: uid,
            courseId: inv.courseId,
            status: 'eligible',
            visitorName: null,
            visitorEmail: null,
            visitorPhone: null,
            visitDate: null,
            visitTime: null,
            remarks: null,
            partnerLocation: inv.kitchenLocation ?? null,
            partnerState: null,
            partnerCountry: null,
            partnerPhone: null,
            partnerAddress: null,
            cuisineId: null,
            cuisineName: null,
            recipeId: null,
            assignedProducts: [],
            photos: [],
            attemptNo: 0,
            formStatus: null,
            assignedBy: null,
            assignedAt: null,
            visitorEmailSentAt: null,
            partnerEmailSentAt: null,
            emailStatus: null,
            lastEmailKind: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            partnerName: prof?.displayName ?? inv.recipientName,
            partnerEmail: inv.recipientEmail,
          } as unknown as typeof visits[0];
        })
        .filter((r): r is typeof visits[0] => r !== null);
    }

    // Enrich real visit rows with partner info and assigned products
    const realUserIds   = visits.map(v => v.userId);

    const realVisitIds = visits.map(v => v.id);
    const realCuisineIds = [...new Set(visits.map(v => v.cuisineId).filter((id): id is string => !!id))];

    const [visitInvites, visitProfiles, allHistories] = await Promise.all([
      realUserIds.length ? prisma.lpPartnerInvite.findMany({
        where: { userId: { in: realUserIds }, revokedAt: null },
        select: { userId: true, courseId: true, recipientName: true, recipientEmail: true },
      }) : [],
      realUserIds.length ? prisma.profile.findMany({
        where: { id: { in: realUserIds } },
        select: { id: true, displayName: true },
      }) : [],
      realVisitIds.length ? prisma.lpPhysicalVisitHistory.findMany({
        where: { visitId: { in: realVisitIds } },
        orderBy: { attemptNo: 'asc' },
      }) : [],
    ]);

    const [allPhotos, cuisineList, allInspections] = await Promise.all([
      realVisitIds.length ? prisma.lpPhysicalVisitPhoto.findMany({
        where: { OR: visits.map(v => ({ visitId: v.id, attemptNo: v.attemptNo })) },
        orderBy: { uploadedAt: 'asc' },
      }) : [],
      realCuisineIds.length ? prisma.lpCuisine.findMany({
        where: { id: { in: realCuisineIds } },
        select: { id: true, name: true },
      }) : [],
      realVisitIds.length ? prisma.lpPhysicalVisitProductInspection.findMany({
        where: { OR: visits.map(v => ({ visitId: v.id, attemptNo: v.attemptNo })) },
      }) : [],
    ]);

    const recipeIds = [...new Set(visits.flatMap(v => (Array.isArray(v.productIds) ? v.productIds as string[] : [])))];
    const recipes   = recipeIds.length
      ? await prisma.lpRecipe.findMany({ where: { id: { in: recipeIds } }, select: { id: true, foodName: true } })
      : [];
    const recipeNameMap = new Map(recipes.map(r => [r.id, r.foodName]));

    const visitInviteMap  = new Map<string, any>(visitInvites.map(i => [`${(i as any).userId}::${(i as any).courseId}`, i] as [string, any]));
    const visitProfileMap = new Map<string, any>(visitProfiles.map(p => [(p as any).id, p] as [string, any]));
    const assignedMap     = new Map<string, string[]>();
    for (const v of visits) {
      const ids = Array.isArray(v.productIds) ? v.productIds as string[] : [];
      assignedMap.set(v.id, ids.map(id => recipeNameMap.get(id) ?? id));
    }
    const historyByVisit = new Map<string, typeof allHistories>();
    for (const h of allHistories) {
      const arr = historyByVisit.get(h.visitId) ?? [];
      arr.push(h);
      historyByVisit.set(h.visitId, arr);
    }

    const cuisineNameMap = new Map<string, string>((cuisineList as Array<{ id: string; name: string }>).map(c => [c.id, c.name] as [string, string]));

    const photosWithUrls = await Promise.all(
      (allPhotos as Array<{ visitId: string; id: string; caption: string | null; imagePath: string; uploadedAt: Date }>).map(async p => ({
        visitId:     p.visitId,
        id:          p.id,
        caption:     p.caption,
        signed_url:  await createSignedUrl('sft-practice', p.imagePath),
        uploaded_at: p.uploadedAt,
      })),
    );
    const photosByVisit = new Map<string, Array<{ id: string; caption: string | null; signed_url: string | null; uploaded_at: Date }>>();
    for (const p of photosWithUrls) {
      const arr = photosByVisit.get(p.visitId) ?? [];
      arr.push({ id: p.id, caption: p.caption, signed_url: p.signed_url, uploaded_at: p.uploaded_at });
      photosByVisit.set(p.visitId, arr);
    }

    const inspectionsByVisit = new Map<string, Array<{ product_id: string; product_name: string; status: string; comment: string | null }>>();
    for (const insp of allInspections) {
      const arr = inspectionsByVisit.get(insp.visitId) ?? [];
      arr.push({ product_id: insp.productId, product_name: insp.productName, status: insp.status, comment: insp.comment });
      inspectionsByVisit.set(insp.visitId, arr);
    }

    const enrichedVisits = visits.map(v => {
      const key     = `${v.userId}::${v.courseId}`;
      const inv     = visitInviteMap.get(key);
      const prof    = visitProfileMap.get(v.userId);
      const history = (historyByVisit.get(v.id) ?? []).map(h => ({
        id:          h.id,
        attempt_no:  h.attemptNo,
        visitor_name: h.visitorName,
        visitor_email: h.visitorEmail,
        decision:    h.decision,
        comments:    h.comments,
        submitted_at: h.submittedAt,
        total_products:        h.totalProducts ?? null,
        accepted_products:     h.acceptedProducts ?? null,
        rejected_products:     h.rejectedProducts ?? null,
        inspection_percentage: h.inspectionPercentage ?? null,
        product_inspections:   Array.isArray(h.productInspections) ? h.productInspections : [],
        photos:      (Array.isArray(h.photos) ? h.photos as Array<Record<string, unknown>> : [])
                       .map((p: Record<string, unknown>) => ({ id: p.id, caption: p.caption, signed_url: null, uploaded_at: p.uploaded_at })),
      }));
      return {
        ...v,
        partnerName:      prof?.displayName ?? inv?.recipientName ?? null,
        partnerEmail:     inv?.recipientEmail ?? null,
        assignedProducts: assignedMap.get(v.id) ?? [],
        cuisineName:      v.cuisineId ? cuisineNameMap.get(v.cuisineId) ?? null : null,
        photos:           photosByVisit.get(v.id) ?? [],
        productInspections: inspectionsByVisit.get(v.id) ?? [],
        history,
      } as unknown as typeof visits[0];
    });

    let all = [...eligibleRows, ...enrichedVisits];

    if (status && status !== 'all') {
      all = all.filter(v => v.status === status);
    }
    if (search) {
      const needle = search.toLowerCase();
      all = all.filter(v =>
        [
          (v as any).visitorName, (v as any).visitorEmail, (v as any).partnerLocation,
          (v as any).partnerName, (v as any).partnerEmail,
        ].some(f => f?.toLowerCase().includes(needle)),
      );
    }

    res.json(all.map(serializeVisit));
  } catch (e) { next(e); }
});

sftRoutes.post('/physical-visits/:id/assign', requirePhysicalVisit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = (req as AuthRequest).user.id;
    const { id } = req.params;

    let existing: Awaited<ReturnType<typeof prisma.lpPhysicalVisit.findUniqueOrThrow>>;

    if (id.startsWith('eligible-')) {
      // First-time assignment — create the real row now.
      const userId = id.replace('eligible-', '');
      const invite = await prisma.lpPartnerInvite.findFirst({
        where: { userId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (!invite) { res.status(404).json({ error: 'Partner invite not found' }); return; }

      existing = await prisma.lpPhysicalVisit.create({
        data: {
          userId,
          courseId: invite.courseId,
          attemptNo: 1,
        },
      });
    } else {
      existing = await prisma.lpPhysicalVisit.findUniqueOrThrow({ where: { id } });
    }
    const isRetry = req.body.isReschedule || ['rejected', 'waiting_admin_reschedule', 'rescheduled'].includes(existing.status);
    const nextAttempt = isRetry ? existing.attemptNo + 1 : existing.attemptNo;
    await prisma.lpPhysicalVisit.update({
      where: { id: existing.id },
      data: {
        visitorName: req.body.visitor_name, visitorEmail: req.body.visitor_email,
        visitorPhone: req.body.visitor_phone ?? null, visitDate: req.body.visit_date,
        visitTime: req.body.visit_time, remarks: req.body.remarks ?? null,
        partnerLocation: req.body.partner_location ?? null, partnerState: req.body.partner_state ?? null,
        partnerCountry: req.body.partner_country ?? null, partnerPhone: req.body.partner_phone ?? null,
        partnerAddress: req.body.partner_address ?? null, cuisineId: req.body.cuisine_id,
        recipeId: req.body.recipe_ids?.[0] ?? null, productIds: req.body.recipe_ids ?? [],
        attemptNo: nextAttempt,
        status: 'visitor_assigned', formStatus: 'pending', submittedAt: null,
        assignedBy: actorId, assignedAt: new Date(),
      },
    });
    await prisma.lpPhysicalVisitToken.deleteMany({ where: { visitId: existing.id } });
    const token = randomUUID().replace(/-/g, '');
    await prisma.lpPhysicalVisitToken.create({ data: { visitId: existing.id, token } });
    const emailKind = isRetry ? 'rescheduled' : 'assigned';
    try { await sendPhysicalVisitEmails(existing.id, emailKind); } catch (e) { console.error('[physical-visit] email failed', e); }
    await createNotification(
      existing.userId,
      'physical_visit',
      isRetry ? 'Your physical visit has been rescheduled.' : 'A physical visit has been scheduled for you.',
      req.body.remarks,
      existing.id,
    );
    res.json({ ok: true, attempt_no: nextAttempt });
  } catch (e) { next(e); }
});

sftRoutes.post('/physical-visits/:id/resend-emails', requirePhysicalVisit, async (req, res, next) => {
  try {
    const { id } = req.params;
    const target = (req.body.target as 'visitor' | 'partner' | 'both') || 'both';
    // Reset submission state and regenerate token so the visitor can fill the form again
    await prisma.lpPhysicalVisit.update({
      where: { id },
      data: { submittedAt: null, formStatus: 'pending' },
    });
    await prisma.lpPhysicalVisitToken.deleteMany({ where: { visitId: id } });
    const newToken = randomUUID().replace(/-/g, '');
    await prisma.lpPhysicalVisitToken.create({ data: { visitId: id, token: newToken } });
    await sendPhysicalVisitEmails(id, 'assigned', target);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER HUB ADMIN — Resources & Videos
// ─────────────────────────────────────────────────────────────────────────────

sftRoutes.get('/resources', requireCourseBuilder, async (req, res, next) => {
  try {
    const courseId = (req.query.course_id ?? req.query.courseId) as string | undefined;
    const resources = await prisma.sftPartnerResource.findMany({
      where: courseId ? { courseId } : {}, orderBy: { sortOrder: 'asc' },
    });
    res.json(resources);
  } catch (e) { next(e); }
});

sftRoutes.post('/resources', requireCourseBuilder, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = mapResourceBody((req.body.data ?? req.body) as Record<string, unknown>);
    const resource = await prisma.sftPartnerResource.create({ data: { ...data, createdBy: (req as AuthRequest).user.id } as any });
    res.status(201).json(resource);
  } catch (e) { next(e); }
});

sftRoutes.patch('/resources/:id', requireCourseBuilder, async (req, res, next) => {
  try {
    res.json(await prisma.sftPartnerResource.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

sftRoutes.delete('/resources/:id', requireCourseBuilder, async (req, res, next) => {
  try {
    await prisma.sftPartnerResource.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

sftRoutes.get('/videos', requireCourseBuilder, async (req, res, next) => {
  try {
    const courseId = (req.query.course_id ?? req.query.courseId) as string | undefined;
    res.json(await prisma.sftVideo.findMany({ where: courseId ? { courseId } : {}, orderBy: { sortOrder: 'asc' } }));
  } catch (e) { next(e); }
});

sftRoutes.post('/videos', requireCourseBuilder, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = mapVideoBody((req.body.data ?? req.body) as Record<string, unknown>);
    const video = await prisma.sftVideo.create({ data: { ...data, createdBy: (req as AuthRequest).user.id } as any });
    res.status(201).json(video);
  } catch (e) { next(e); }
});

sftRoutes.patch('/videos/:id', requireCourseBuilder, async (req, res, next) => {
  try {
    res.json(await prisma.sftVideo.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

sftRoutes.delete('/videos/:id', requireCourseBuilder, async (req, res, next) => {
  try {
    await prisma.sftVideo.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER TASKS (admin side)
// ─────────────────────────────────────────────────────────────────────────────

sftRoutes.get('/invites/:inviteId/tasks', async (req, res, next) => {
  try {
    res.json(await prisma.sftPartnerTask.findMany({ where: { inviteId: req.params.inviteId }, orderBy: { createdAt: 'desc' } }));
  } catch (e) { next(e); }
});

sftRoutes.post('/tasks', requireCourseBuilder, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await prisma.sftPartnerTask.create({ data: { ...req.body, createdBy: (req as AuthRequest).user.id } });
    res.status(201).json(task);
  } catch (e) { next(e); }
});

sftRoutes.delete('/tasks/:id', requireCourseBuilder, async (req, res, next) => {
  try {
    await prisma.sftPartnerTask.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});