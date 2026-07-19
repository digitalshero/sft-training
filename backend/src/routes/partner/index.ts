import { Router, Request, Response, NextFunction } from 'express';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { prisma } from '../../lib/prisma';
import { requireAuth, AuthRequest } from '../../middleware/auth';
import { createSignedUrl } from '../../lib/storage';

export const partnerRoutes = Router();
partnerRoutes.use(requireAuth);

// ── Dashboard ─────────────────────────────────────────────────────────────────

partnerRoutes.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const email  = (req as AuthRequest).user.email;

    // Self-heal: link orphaned invites to current user
    await prisma.lpPartnerInvite.updateMany({
      where: { userId: null, revokedAt: null, recipientEmail: { equals: email, mode: 'insensitive' } },
      data:  { userId },
    });

    const allInvites = await prisma.lpPartnerInvite.findMany({
      where:   { userId, revokedAt: null },
      orderBy: { sentAt: 'desc' },
    });

    // Deduplicate: one invite per course — prefer accepted over sent, then most recent
    const seenCourses = new Set<string>();
    const invites = allInvites
      .sort((a, b) => {
        if (a.status === 'accepted' && b.status !== 'accepted') return -1;
        if (b.status === 'accepted' && a.status !== 'accepted') return 1;
        return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
      })
      .filter(i => {
        if (seenCourses.has(i.courseId)) return false;
        seenCourses.add(i.courseId);
        return true;
      });

    const courseIds  = [...new Set(invites.map(i => i.courseId))];
    const inviteIds  = invites.map(i => i.id);

    // Independent reads/writes — fire together instead of one round-trip at a time.
    const [courses, tasks, certs, extraCerts, mods, subs, doneModuleIds, , assignments, recipes, cuisines] = await Promise.all([
      courseIds.length ? prisma.lpCourse.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true, coverUrl: true, certificateTemplate: true, certificateTemplates: true } }) : [],
      inviteIds.length ? prisma.sftPartnerTask.findMany({ where: { inviteId: { in: inviteIds } }, orderBy: { createdAt: 'desc' } }) : [],
      courseIds.length ? prisma.lpCertificate.findMany({ where: { userId, courseId: { in: courseIds } } }) : [],
      courseIds.length ? prisma.lpPartnerCertificate.findMany({ where: { userId, courseId: { in: courseIds }, revokedAt: null } }) : [],
      courseIds.length ? prisma.lpModule.findMany({ where: { courseId: { in: courseIds }, published: true, dayId: { not: null } }, select: { id: true, courseId: true } }) : [],
      courseIds.length ? prisma.lpProductSubmission.findMany({ where: { userId, courseId: { in: courseIds } }, orderBy: { submittedAt: 'desc' } }) : [],
      // Not filtered by moduleId — that'd force this to wait on the mods query above. Filtered client-side instead.
      courseIds.length ? prisma.lpModuleProgress.findMany({ where: { userId, completedAt: { not: null } }, select: { moduleId: true } }) : [],
      // Auto-enrol partner in all invited courses
      courseIds.length ? Promise.all((courseIds as string[]).map(courseId =>
        prisma.lpEnrolment.upsert({
          where:  { userId_courseId: { userId, courseId } },
          create: { userId, courseId, status: 'active' },
          update: {},
        })
      )) : [],
      // Cuisine/product-assignment model — needed to compute a correct
      // "all assigned products approved" submission_status per course below.
      courseIds.length ? prisma.lpProductAssignment.findMany({ where: { userId, courseId: { in: courseIds } } }) : [],
      courseIds.length ? prisma.lpRecipe.findMany({ where: { courseId: { in: courseIds } } }) : [],
      courseIds.length ? prisma.lpCuisine.findMany({ where: { courseId: { in: courseIds } } }) : [],
    ]);

    const courseMap = new Map<string, { id: string; title: string; coverUrl: string | null }>((courses as Array<{ id: string; title: string; coverUrl: string | null }>).map(c => [c.id, c]));
    // Full template objects (including any uploaded design — background
    // path/size/tokens) so the partner's browser can composite/download the
    // exact certificate an admin designed, without a separate admin-only call.
    type CourseWithTemplates = { id: string; certificateTemplate: unknown; certificateTemplates: unknown };
    const mainDesignByCourse = new Map<string, unknown>();
    const extraTemplateByKey = new Map<string, { id?: string; title?: string } & Record<string, unknown>>();
    (courses as CourseWithTemplates[]).forEach(c => {
      mainDesignByCourse.set(c.id, c.certificateTemplate ?? {});
      const templates = Array.isArray(c.certificateTemplates) ? c.certificateTemplates as Array<{ id?: string; title?: string }> : [];
      templates.forEach(t => { if (t?.id) extraTemplateByKey.set(`${c.id}::${t.id}`, t); });
    });

    // Progress
    const progress: Record<string, { modules_total: number; modules_done: number; submission_status: string | null }> = {};
    if (courseIds.length) {
      const modsByCourse = new Map<string, string[]>();
      mods.forEach(m => { const a = modsByCourse.get(m.courseId) ?? []; a.push(m.id); modsByCourse.set(m.courseId, a); });

      const doneSet = new Set(doneModuleIds.map(p => p.moduleId));

      // Legacy fallback (courses with no cuisine/product-assignment model):
      // unchanged "latest submission's status" calculation, exactly as before.
      const latestSub = new Map<string, string>();
      subs.forEach(s => { if (!latestSub.has(s.courseId)) latestSub.set(s.courseId, s.status); });

      // Cuisine-model courses: submission_status must mean "every assigned
      // product is approved," not "the single latest submission row is
      // approved" — per-product submissions can now exist independently and
      // in parallel before all products are done, so picking just the latest
      // one could wrongly report "approved" after only one product is.
      const assignmentsByCourse = new Map<string, typeof assignments>();
      assignments.forEach(a => { const arr = assignmentsByCourse.get(a.courseId) ?? []; arr.push(a); assignmentsByCourse.set(a.courseId, arr); });
      const recipeMap = new Map(recipes.map(r => [r.id, r] as const));
      const cuisineMap = new Map(cuisines.map(c => [c.id, c] as const));
      const subsByCourse = new Map<string, typeof subs>();
      subs.forEach(s => { const arr = subsByCourse.get(s.courseId) ?? []; arr.push(s); subsByCourse.set(s.courseId, arr); });

      type SubFile = { label?: string; decision?: string };
      const resolveAssignmentStatus = (label: string, subsForCourse: typeof subs): string => {
        for (const s of subsForCourse) { // newest-first (subs query ordered submittedAt desc)
          const files = ((s.files as SubFile[]) ?? []).filter(f => f.label === label);
          if (!files.length) continue;
          if (files.some(f => f.decision === 'redo')) return 'redo';
          if (files.every(f => f.decision === 'approved')) return 'approved';
          return 'pending';
        }
        return 'not_uploaded';
      };

      (courseIds as string[]).forEach((cid: string) => {
        const modIds = modsByCourse.get(cid) ?? [];
        const courseAssignments = assignmentsByCourse.get(cid) ?? [];

        let submissionStatus: string | null;
        if (courseAssignments.length > 0) {
          const subsForCourse = subsByCourse.get(cid) ?? [];
          const statuses = courseAssignments.map(a => {
            const recipe = recipeMap.get(a.recipeId);
            const cuisineId = recipe?.cuisineId ?? a.cuisineId;
            const label = `${cuisineMap.get(cuisineId ?? '')?.name ?? ''} — ${recipe?.foodName ?? ''}`.trim();
            return resolveAssignmentStatus(label, subsForCourse);
          });
          submissionStatus = statuses.every(s => s === 'approved')
            ? 'approved'
            : statuses.some(s => s === 'redo')
              ? 'redo'
              : statuses.some(s => s !== 'not_uploaded')
                ? 'pending'
                : null;
        } else {
          submissionStatus = latestSub.get(cid) ?? null;
        }

        progress[cid] = {
          modules_total:     modIds.length,
          modules_done:      modIds.filter((m: string) => doneSet.has(m)).length,
          submission_status: submissionStatus,
        };
      });
    }

    res.json({
      invites: invites.map(i => ({
        id:               i.id,
        course_id:        i.courseId,
        course_title:     courseMap.get(i.courseId)?.title ?? '—',
        cover_url:        courseMap.get(i.courseId)?.coverUrl ?? null,
        recipient_name:   i.recipientName,
        recipient_email:  i.recipientEmail,
        kitchen_location: i.kitchenLocation,
        status:           i.status,
        sent_at:          i.sentAt,
        opened_at:        i.openedAt,
        accepted_at:      i.acceptedAt,
        revoked_at:       i.revokedAt,
        user_id:          i.userId,
      })),
      tasks,
      certificates: certs.map(c => ({
        id: c.id, course_id: c.courseId, course_title: courseMap.get(c.courseId)?.title ?? '—',
        code: c.code, issued_at: c.issuedAt,
        design: mainDesignByCourse.get(c.courseId) ?? {},
      })),
      extra_certificates: extraCerts.map(c => {
        const tpl = extraTemplateByKey.get(`${c.courseId}::${c.templateId}`) ?? {};
        return {
          id: c.id, course_id: c.courseId, course_title: courseMap.get(c.courseId)?.title ?? '—',
          template_id: c.templateId, title: tpl.title ?? 'Certificate',
          code: c.code, issued_at: c.issuedAt,
          design: tpl,
        };
      }),
      progress,
    });
  } catch (e) { next(e); }
});

// ── Insights (streak, today's goal, recent activity) ────────────────────────────
// All derived from existing timestamped records — no new tracking tables.

partnerRoutes.get('/insights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;

    const allInvites = await prisma.lpPartnerInvite.findMany({ where: { userId, revokedAt: null } });
    const courseIds  = [...new Set(allInvites.map(i => i.courseId))];
    if (!courseIds.length) { res.json({ streak_days: 0, today_goal: null, recent_activity: [] }); return; }

    // Same primary-course selection as /dashboard: prefer accepted, then most recent.
    const primaryCourseId = [...allInvites]
      .sort((a, b) => {
        if (a.status === 'accepted' && b.status !== 'accepted') return -1;
        if (b.status === 'accepted' && a.status !== 'accepted') return 1;
        return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
      })[0].courseId;

    const [modules, moduleProgress, assignments, submissions, visits, certs, cuisines, course] = await Promise.all([
      prisma.lpModule.findMany({ where: { courseId: { in: courseIds }, published: true, dayId: { not: null } }, orderBy: { sortOrder: 'asc' } }),
      prisma.lpModuleProgress.findMany({ where: { userId } }),
      prisma.lpProductAssignment.findMany({ where: { userId, courseId: { in: courseIds } } }),
      prisma.lpProductSubmission.findMany({ where: { userId, courseId: { in: courseIds } } }),
      prisma.lpPhysicalVisit.findMany({ where: { userId, courseId: { in: courseIds } } }),
      prisma.lpCertificate.findMany({ where: { userId, courseId: { in: courseIds } } }),
      prisma.lpCuisine.findMany({ where: { courseId: { in: courseIds } } }),
      prisma.lpCourse.findUnique({ where: { id: primaryCourseId }, select: { title: true } }),
    ]);

    const moduleMap  = new Map(modules.map(m => [m.id, m]));
    const cuisineMap = new Map(cuisines.map(c => [c.id, c.name]));
    const doneModuleIds = new Set(
      moduleProgress.filter(p => p.completedAt && moduleMap.has(p.moduleId)).map(p => p.moduleId),
    );

    // ── Streak: consecutive days (ending today or yesterday) with any activity ──
    const activeDays = new Set<string>();
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    moduleProgress.forEach(p => { if (p.completedAt && moduleMap.has(p.moduleId)) activeDays.add(dayKey(p.completedAt)); });
    assignments.forEach(a => activeDays.add(dayKey(a.createdAt)));
    submissions.forEach(s => activeDays.add(dayKey(s.submittedAt)));
    visits.forEach(v => {
      if (v.assignedAt) activeDays.add(dayKey(v.assignedAt));
      if (v.submittedAt) activeDays.add(dayKey(v.submittedAt));
    });
    certs.forEach(c => activeDays.add(dayKey(c.issuedAt)));

    let streakDays = 0;
    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    if (!activeDays.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (activeDays.has(dayKey(cursor))) {
      streakDays++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    // ── Today's goal: next concrete action in the primary course ────────────────
    const primaryModules = modules.filter(m => m.courseId === primaryCourseId);
    const nextModule = primaryModules.find(m => !doneModuleIds.has(m.id));
    const primarySub = submissions
      .filter(s => s.courseId === primaryCourseId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
    const primaryCert = certs.find(c => c.courseId === primaryCourseId);
    const primaryVisit = visits.find(v => v.courseId === primaryCourseId);

    let todayGoal: { label: string; done: boolean };
    if (primaryCert) {
      todayGoal = { label: `You're certified for ${course?.title ?? 'this course'}! 🎉`, done: true };
    } else if (nextModule) {
      todayGoal = { label: `Complete "${nextModule.title}"`, done: false };
    } else if (!primarySub) {
      todayGoal = { label: 'Choose your cuisine and start cooking', done: false };
    } else if (primarySub.status === 'redo') {
      todayGoal = { label: 'Redo the photos your trainer flagged', done: false };
    } else if (primarySub.status === 'pending') {
      todayGoal = { label: 'Your cook photos are under review', done: true };
    } else if (!primaryVisit || primaryVisit.status === 'eligible') {
      todayGoal = { label: 'Waiting for your physical visit to be scheduled', done: true };
    } else {
      todayGoal = { label: 'Get your kitchen ready for the physical visit', done: false };
    }

    // ── Recent activity: merge real events, newest first ─────────────────────────
    type Activity = { id: string; type: string; label: string; at: string };
    const activity: Activity[] = [];

    moduleProgress.forEach(p => {
      const m = moduleMap.get(p.moduleId);
      if (m && p.completedAt) {
        activity.push({ id: `mod-${p.id}`, type: 'module', label: `Completed "${m.title}"`, at: p.completedAt.toISOString() });
      }
    });
    const seenCuisineSelections = new Set<string>();
    assignments.forEach(a => {
      const key = `${a.courseId}-${a.cuisineId}`;
      if (seenCuisineSelections.has(key)) return;
      seenCuisineSelections.add(key);
      activity.push({ id: `cui-${a.id}`, type: 'cuisine', label: `Selected ${cuisineMap.get(a.cuisineId) ?? 'a'} cuisine`, at: a.createdAt.toISOString() });
    });
    submissions.forEach(s => {
      activity.push({ id: `sub-${s.id}`, type: 'submission', label: 'Submitted cook photos for review', at: s.submittedAt.toISOString() });
    });
    visits.forEach(v => {
      if (v.assignedAt) activity.push({ id: `visit-a-${v.id}`, type: 'visit', label: 'Physical visit scheduled', at: v.assignedAt.toISOString() });
      if (v.submittedAt) activity.push({ id: `visit-s-${v.id}`, type: 'visit', label: 'Physical visit report submitted', at: v.submittedAt.toISOString() });
    });
    certs.forEach(c => {
      activity.push({ id: `cert-${c.id}`, type: 'certificate', label: 'Earned your Shero certificate', at: c.issuedAt.toISOString() });
    });

    activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    res.json({
      streak_days: streakDays,
      today_goal: todayGoal,
      recent_activity: activity.slice(0, 6),
    });
  } catch (e) { next(e); }
});

// ── Tasks (partner marks done) ────────────────────────────────────────────────

partnerRoutes.post('/tasks/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { done } = req.body as { done: boolean };
    await prisma.sftPartnerTask.update({
      where: { id: req.params.id },
      data:  { status: done ? 'done' : 'open', completedAt: done ? new Date() : null },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Resources (partner view with signed URLs) ─────────────────────────────────

partnerRoutes.get('/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId } = req.query as { courseId?: string };
    const resources = await prisma.sftPartnerResource.findMany({
      where:   courseId ? { OR: [{ courseId }, { courseId: null }] } : {},
      orderBy: { sortOrder: 'asc' },
    });
    const withUrls = await Promise.all(
      resources.map(async r => ({
        ...r,
        signed_url: await createSignedUrl(r.bucket, r.filePath),
      })),
    );
    res.json(withUrls);
  } catch (e) { next(e); }
});

// ── Videos (partner view) ─────────────────────────────────────────────────────

partnerRoutes.get('/videos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId, brandId } = req.query as { courseId?: string; brandId?: string };
    const videos = await prisma.sftVideo.findMany({
      where: {
        ...(courseId ? { OR: [{ courseId }, { courseId: null }] } : {}),
        ...(brandId  ? { OR: [{ brandId  }, { brandId:  null }] } : {}),
      },
      orderBy: { sortOrder: 'asc' },
    });
    const withUrls = await Promise.all(
      videos.map(async v => ({
        ...v,
        signed_url:    v.videoPath ? await createSignedUrl(v.bucket, v.videoPath) : v.externalUrl,
        thumbnail_url: v.thumbnailPath ? await createSignedUrl(v.bucket, v.thumbnailPath) : null,
      })),
    );
    res.json(withUrls);
  } catch (e) { next(e); }
});

// ── Cuisines (partner pick) ────────────────────────────────────────────────────

partnerRoutes.get('/courses/:courseId/cuisines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [course, cuisines] = await Promise.all([
      prisma.lpCourse.findUniqueOrThrow({ where: { id: req.params.courseId }, select: { maxCuisines: true } }),
      prisma.lpCuisine.findMany({
        where:   { courseId: req.params.courseId, active: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
    const counts = await prisma.lpRecipe.groupBy({
      by:    ['cuisineId'],
      where: { courseId: req.params.courseId, active: true, cuisineId: { in: cuisines.map(c => c.id) } },
      _count: { id: true },
    });
    const countMap = new Map(counts.map(c => [c.cuisineId!, c._count.id]));
    res.json({
      max_cuisines: course.maxCuisines,
      cuisines: cuisines.map(c => ({ ...c, recipe_count: countMap.get(c.id) ?? 0 })),
    });
  } catch (e) { next(e); }
});

partnerRoutes.post('/courses/:courseId/choose-cuisine', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const courseId = req.params.courseId;
    const { cuisineId } = req.body as { cuisineId: string };

    const existing = await prisma.lpProductAssignment.findFirst({ where: { userId, courseId, cuisineId } });
    if (existing) { res.json({ ok: true, already: true }); return; }

    const [course, chosenCuisineIds] = await Promise.all([
      prisma.lpCourse.findUniqueOrThrow({ where: { id: courseId }, select: { maxCuisines: true } }),
      prisma.lpProductAssignment.findMany({ where: { userId, courseId }, select: { cuisineId: true }, distinct: ['cuisineId'] }),
    ]);
    if (course.maxCuisines != null && chosenCuisineIds.length >= course.maxCuisines) {
      res.status(400).json({ error: `You can select up to ${course.maxCuisines} cuisine${course.maxCuisines === 1 ? '' : 's'} for this course.` });
      return;
    }

    const cuisine = await prisma.lpCuisine.findUniqueOrThrow({ where: { id: cuisineId } });
    if (cuisine.courseId !== courseId) { res.status(400).json({ error: 'Cuisine not in course' }); return; }

    const recipes = await prisma.lpRecipe.findMany({
      where:   { cuisineId, active: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (!recipes.length) { res.status(400).json({ error: 'No active products in this cuisine' }); return; }

    const take    = cuisine.showCount > 0 ? Math.min(cuisine.showCount, recipes.length) : recipes.length;
    const picked  = recipes.sort(() => Math.random() - 0.5).slice(0, take);

    await prisma.lpProductAssignment.createMany({
      data: picked.map(r => ({ userId, courseId, cuisineId, recipeId: r.id })),
    });
    res.json({ ok: true, assigned: picked.length });
  } catch (e) { next(e); }
});

partnerRoutes.get('/courses/:courseId/my-cook-assignments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const courseId = req.params.courseId;
    const assignments = await prisma.lpProductAssignment.findMany({
      where: { userId, courseId },
    });
    if (!assignments.length) { res.json([]); return; }

    const recipeIds = assignments.map(a => a.recipeId);
    const recipes   = await prisma.lpRecipe.findMany({ where: { id: { in: recipeIds } } });
    const recipeMap = new Map<string, (typeof recipes)[number]>(recipes.map(r => [r.id, r]));

    // A recipe's own cuisineId is the live source of truth — an assignment's stored
    // cuisineId can go stale if the cuisine it was picked under was later deleted/recreated.
    const cuisineIds = new Set<string>();
    assignments.forEach(a => cuisineIds.add(a.cuisineId));
    recipes.forEach(r => { if (r.cuisineId) cuisineIds.add(r.cuisineId); });
    const cuisines   = await prisma.lpCuisine.findMany({ where: { id: { in: [...cuisineIds] } } });
    const cuisineMap = new Map<string, (typeof cuisines)[number]>(cuisines.map(c => [c.id, c]));

    const latestSub = await prisma.lpProductSubmission.findMany({
      where: { userId, courseId }, orderBy: { submittedAt: 'desc' },
    });

    const drafts = await prisma.lpProductUploadDraft.findMany({
      where: { assignmentId: { in: assignments.map(a => a.id) } },
    });
    const draftByAssignment = new Map(drafts.map(d => [d.assignmentId, d]));

    // A product can now have multiple uploaded photos. Group each submission's
    // files by label first, then — same as before — the most recent submission
    // that has any files for a given label wins (older submissions only fill in
    // labels a newer partial resubmission left out). Also remember that
    // submission's overall feedback, so a comment left in the trainer's general
    // remarks box (rather than on one specific photo) still surfaces per-product.
    type SubFile = { label: string; path: string; decision?: string; remark?: string };
    const labelToFiles = new Map<string, SubFile[]>();
    const labelToOverallFeedback = new Map<string, string | null>();
    for (const s of latestSub) {
      const files = (s.files as SubFile[]) ?? [];
      const byLabelThisSub = new Map<string, SubFile[]>();
      for (const f of files) {
        if (!byLabelThisSub.has(f.label)) byLabelThisSub.set(f.label, []);
        byLabelThisSub.get(f.label)!.push(f);
      }
      for (const [label, fs] of byLabelThisSub) {
        if (!labelToFiles.has(label)) {
          labelToFiles.set(label, fs);
          labelToOverallFeedback.set(label, s.feedback ?? null);
        }
      }
    }

    const result = await Promise.all(assignments.map(async a => {
      const recipe     = recipeMap.get(a.recipeId);
      const cuisineId  = recipe?.cuisineId ?? a.cuisineId;
      const cuisine    = cuisineMap.get(cuisineId);
      const label   = `${cuisine?.name ?? ''} — ${recipe?.foodName ?? ''}`.trim();
      const files   = labelToFiles.get(label) ?? [];
      const status  = files.length === 0
        ? 'not_uploaded'
        : files.some(f => f.decision === 'redo')
          ? 'redo'
          : files.every(f => f.decision === 'approved')
            ? 'approved'
            : 'pending';
      const uploads = await Promise.all(files.map(async f => ({
        path:     f.path,
        url:      await createSignedUrl('sft-practice', f.path),
        decision: f.decision ?? null,
        remark:   f.remark ?? null,
      })));

      const draft = draftByAssignment.get(a.id);
      const draftFiles = (draft?.files as Array<{ path: string }>) ?? [];
      const draftUploads = await Promise.all(draftFiles.map(async f => ({
        path: f.path,
        url:  await createSignedUrl('sft-practice', f.path),
      })));

      return {
        assignment_id: a.id,
        recipe_id:     a.recipeId,
        cuisine_id:    cuisineId,
        cuisine_name:  cuisine?.name ?? '',
        food_name:     recipe?.foodName ?? '',
        ingredients_md: recipe?.ingredientsMd ?? '',
        prep_steps_md:  recipe?.prepStepsMd ?? null,
        cook_steps_md:  recipe?.cookStepsMd ?? null,
        image_url:      recipe?.imagePath ? await createSignedUrl('learning-media', recipe.imagePath) : null,
        uploads,
        status,
        draft_status:  draft?.status ?? 'none',
        draft_uploads: draftUploads,
        admin_comment:
          uploads.find(u => u.remark)?.remark ??
          labelToOverallFeedback.get(label) ??
          null,
      };
    }));
    res.json(result);
  } catch (e) { next(e); }
});

partnerRoutes.post('/courses/:courseId/cuisines/:cuisineId/remove', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId    = (req as AuthRequest).user.id;
    const courseId  = req.params.courseId;
    const cuisineId = req.params.cuisineId;

    const subs = await prisma.lpProductSubmission.findFirst({ where: { userId, courseId } });
    if (subs) { res.status(400).json({ error: 'Cannot change cuisines after uploading' }); return; }

    const assignments = await prisma.lpProductAssignment.findMany({ where: { userId, courseId } });
    const recipes = await prisma.lpRecipe.findMany({
      where:  { id: { in: assignments.map(a => a.recipeId) } },
      select: { id: true, cuisineId: true },
    });
    // Resolve each assignment's live cuisine the same way /my-cook-assignments does —
    // a recipe's own cuisineId is the source of truth, since the assignment's stored
    // cuisineId can go stale if the cuisine it was picked under was later deleted/recreated.
    const recipeCuisineMap = new Map(recipes.map(r => [r.id, r.cuisineId]));
    const toDelete = assignments
      .filter(a => (recipeCuisineMap.get(a.recipeId) ?? a.cuisineId) === cuisineId)
      .map(a => a.id);
    if (!toDelete.length) { res.status(404).json({ error: 'No products assigned for this cuisine' }); return; }

    const draftExists = await prisma.lpProductUploadDraft.findFirst({ where: { assignmentId: { in: toDelete } } });
    if (draftExists) { res.status(400).json({ error: 'Cannot change cuisines after uploading' }); return; }

    await prisma.lpProductAssignment.deleteMany({ where: { id: { in: toDelete } } });
    res.json({ ok: true, removed: toDelete.length });
  } catch (e) { next(e); }
});

partnerRoutes.post('/courses/:courseId/reset-cuisine', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const courseId = req.params.courseId;
    const subs = await prisma.lpProductSubmission.findFirst({ where: { userId, courseId } });
    if (subs) { res.status(400).json({ error: 'Reset disabled after uploading' }); return; }

    const draftExists = await prisma.lpProductUploadDraft.findFirst({ where: { userId, courseId } });
    if (draftExists) { res.status(400).json({ error: 'Reset disabled after uploading' }); return; }

    await prisma.lpProductAssignment.deleteMany({ where: { userId, courseId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

partnerRoutes.post('/courses/:courseId/submit-cook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const courseId = req.params.courseId;
    const sub = await prisma.lpProductSubmission.create({
      data: { userId, courseId, files: req.body.files, notes: req.body.notes ?? null, submittedAt: new Date() },
    });
    await prisma.lpPartnerEvent.create({
      data: { courseId, userId, eventType: 'product_submitted', payload: { submission_id: sub.id, file_count: req.body.files?.length ?? 0 } },
    });
    res.status(201).json({ id: sub.id });
  } catch (e) { next(e); }
});

// ── Per-product upload drafts ──────────────────────────────────────────────────
// Lets a partner upload/submit one assigned product at a time, persisting
// across logout/refresh. These drafts are the partner's own working copy —
// they only become an admin-reviewable LpProductSubmission once Final Submit
// bundles every assignment's uploads via the existing /submit-cook above.

partnerRoutes.post('/courses/:courseId/cook-drafts/:assignmentId/upload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const courseId = req.params.courseId;
    const { assignmentId } = req.params;
    const { path: filePath } = req.body as { path?: string };
    if (!filePath) { res.status(400).json({ error: 'path required' }); return; }

    const assignment = await prisma.lpProductAssignment.findFirst({ where: { id: assignmentId, userId, courseId } });
    if (!assignment) { res.status(404).json({ error: 'Assignment not found' }); return; }

    const existing = await prisma.lpProductUploadDraft.findUnique({ where: { assignmentId } });
    const files = [...((existing?.files as Array<{ path: string }>) ?? []), { path: filePath }];

    const draft = await prisma.lpProductUploadDraft.upsert({
      where:  { assignmentId },
      create: { userId, courseId, assignmentId, files },
      update: { files },
    });
    res.status(201).json({ id: draft.id, status: draft.status, files: draft.files });
  } catch (e) { next(e); }
});

partnerRoutes.post('/courses/:courseId/cook-drafts/:assignmentId/remove-image', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const courseId = req.params.courseId;
    const { assignmentId } = req.params;
    const { path: filePath } = req.body as { path?: string };
    if (!filePath) { res.status(400).json({ error: 'path required' }); return; }

    const assignment = await prisma.lpProductAssignment.findFirst({ where: { id: assignmentId, userId, courseId } });
    if (!assignment) { res.status(404).json({ error: 'Assignment not found' }); return; }

    const draft = await prisma.lpProductUploadDraft.findUnique({ where: { assignmentId } });
    if (!draft) { res.status(404).json({ error: 'No draft found' }); return; }
    if (draft.status !== 'pending') { res.status(400).json({ error: 'Cannot remove images after submitting' }); return; }

    const files = ((draft.files as Array<{ path: string }>) ?? []).filter(f => f.path !== filePath);
    const updated = await prisma.lpProductUploadDraft.update({ where: { assignmentId }, data: { files } });
    res.json({ id: updated.id, status: updated.status, files: updated.files });
  } catch (e) { next(e); }
});

partnerRoutes.post('/courses/:courseId/cook-drafts/:assignmentId/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthRequest).user.id;
    const courseId = req.params.courseId;
    const { assignmentId } = req.params;

    const assignment = await prisma.lpProductAssignment.findFirst({ where: { id: assignmentId, userId, courseId } });
    if (!assignment) { res.status(404).json({ error: 'Assignment not found' }); return; }

    const draft = await prisma.lpProductUploadDraft.findUnique({ where: { assignmentId } });
    const files = ((draft?.files as Array<{ path: string }>) ?? []);
    if (!draft || files.length === 0) { res.status(400).json({ error: 'Upload at least one photo before submitting' }); return; }

    // Resolve the product's label the same way /my-cook-assignments does — the
    // recipe's own cuisineId is the source of truth over the assignment's stored one.
    const recipe    = await prisma.lpRecipe.findUnique({ where: { id: assignment.recipeId } });
    const cuisineId = recipe?.cuisineId ?? assignment.cuisineId;
    const cuisine   = cuisineId ? await prisma.lpCuisine.findUnique({ where: { id: cuisineId } }) : null;
    const label     = `${cuisine?.name ?? ''} — ${recipe?.foodName ?? ''}`.trim();

    const [updated, sub] = await prisma.$transaction([
      prisma.lpProductUploadDraft.update({
        where: { assignmentId },
        data:  { status: 'submitted', submittedAt: new Date() },
      }),
      prisma.lpProductSubmission.create({
        data: { userId, courseId, files: files.map(f => ({ path: f.path, label })), submittedAt: new Date() },
      }),
    ]);
    await prisma.lpPartnerEvent.create({
      data: { courseId, userId, eventType: 'product_submitted', payload: { submission_id: sub.id, file_count: files.length, label } },
    });

    res.json({ id: updated.id, status: updated.status, submission_id: sub.id });
  } catch (e) { next(e); }
});

// ── Cook photo quality validation ────────────────────────────────────────────
// Uses OpenAI GPT-4o-mini vision to verify image clarity and format.
// Falls back to { valid: true } if OPENAI_API_KEY is not configured.

partnerRoutes.post('/validate-cook-photo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: storagePath } = req.body as { path?: string };
    if (!storagePath) { res.status(400).json({ error: 'path required' }); return; }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.json({ valid: true, reason: '' });
      return;
    }

    // Build image data: base64 in local mode, signed URL in S3 mode.
    let imageUrl: string;
    const storageMode = process.env.STORAGE_MODE || 'local';
    if (storageMode === 'local') {
      const filePath = join(process.env.LOCAL_UPLOAD_DIR || './uploads', 'sft-practice', storagePath);
      const buf = await readFile(filePath);
      const ext = storagePath.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      imageUrl = `data:${mime};base64,${buf.toString('base64')}`;
    } else {
      imageUrl = await createSignedUrl('sft-practice', storagePath, 120);
    }

    const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are checking a food product photo for a cooking certification program.
The photo must meet ALL of these requirements:
1. Clarity: the dish is sharp, in focus, and well-lit — not blurry, too dark, or overexposed.
2. Format: the photo is a genuine, valid image of a plated food dish (not blank, corrupted, or an unrelated picture).

Respond with JSON only — no extra text:
{"valid": true, "reason": ""} if it passes all checks.
{"valid": false, "reason": "One sentence explaining what to fix."} if it fails any check.`,
            },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        }],
        max_tokens: 80,
        response_format: { type: 'json_object' },
      }),
    });

    if (!oaiRes.ok) {
      console.warn('[validate-cook-photo] OpenAI error', oaiRes.status);
      res.json({ valid: true, reason: '' });
      return;
    }

    const oaiData = await oaiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = oaiData.choices?.[0]?.message?.content ?? '{}';
    let result: { valid?: boolean; reason?: string } = {};
    try { result = JSON.parse(content); } catch { /* keep empty */ }

    res.json({ valid: result.valid !== false, reason: result.reason ?? '' });
  } catch (e) {
    console.error('[validate-cook-photo]', e);
    res.json({ valid: true, reason: '' }); // Don't block on AI failure
  }
});

// ── Physical Visit (partner view) ─────────────────────────────────────────────

partnerRoutes.get('/my-physical-visit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const visit  = await prisma.lpPhysicalVisit.findFirst({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      include: { photos: true, history: true },
    });
    if (!visit) { res.json(null); return; }

    const [invite, profile, cuisineRow] = await Promise.all([
      prisma.lpPartnerInvite.findFirst({
        where:  { userId, courseId: visit.courseId, revokedAt: null },
        select: { recipientName: true, recipientEmail: true },
      }),
      prisma.profile.findUnique({
        where:  { id: userId },
        select: { displayName: true },
      }),
      visit.cuisineId ? prisma.lpCuisine.findUnique({ where: { id: visit.cuisineId }, select: { name: true } }) : null,
    ]);

    const recipeIds  = Array.isArray(visit.productIds) ? visit.productIds as string[] : [];
    const recipes    = recipeIds.length
      ? await prisma.lpRecipe.findMany({ where: { id: { in: recipeIds } }, select: { id: true, foodName: true } })
      : [];
    const recipeNameMap    = new Map(recipes.map(r => [r.id, r.foodName]));
    const assignedProducts = recipeIds.map(id => recipeNameMap.get(id) ?? id);

    const currentPhotos = visit.photos.filter(p => p.attemptNo === visit.attemptNo);
    const photosOut = await Promise.all(currentPhotos.map(async p => ({
      id:          p.id,
      caption:     p.caption,
      signed_url:  await createSignedUrl('sft-practice', p.imagePath),
      uploaded_at: p.uploadedAt,
    })));

    const historyOut = await Promise.all(visit.history.map(async h => ({
      id:           h.id,
      attempt_no:   h.attemptNo,
      visitor_name: h.visitorName,
      visitor_email: h.visitorEmail,
      decision:     h.decision,
      comments:     h.comments,
      submitted_at: h.submittedAt,
      assigned_products: Array.isArray(h.assignedProducts) ? h.assignedProducts as string[] : [],
      photos: await Promise.all(
        (Array.isArray(h.photos) ? h.photos as Array<Record<string, unknown>> : [])
          .map(async (p: Record<string, unknown>) => ({
            id:          p.id,
            caption:     p.caption,
            signed_url:  p.image_path ? await createSignedUrl('sft-practice', p.image_path as string) : null,
            uploaded_at: p.uploaded_at,
          })),
      ),
    })));

    res.json({
      id:                   visit.id,
      user_id:              visit.userId,
      course_id:            visit.courseId,
      recipe_id:            visit.recipeId,
      submission_id:        visit.submissionId,
      attempt_no:           visit.attemptNo,
      partner_name:         profile?.displayName ?? invite?.recipientName ?? null,
      partner_email:        invite?.recipientEmail ?? null,
      partner_location:     visit.partnerLocation,
      partner_state:        visit.partnerState,
      partner_country:      visit.partnerCountry,
      partner_phone:        visit.partnerPhone,
      partner_address:      visit.partnerAddress,
      visitor_name:         visit.visitorName,
      visitor_email:        visit.visitorEmail,
      visitor_phone:        visit.visitorPhone,
      visitor_location:     visit.visitorLocation,
      visit_date:           visit.visitDate,
      visit_time:           visit.visitTime,
      remarks:              visit.remarks,
      status:               visit.status,
      email_status:         visit.emailStatus,
      visitor_email_sent_at: visit.visitorEmailSentAt,
      partner_email_sent_at: visit.partnerEmailSentAt,
      cuisine_id:           visit.cuisineId,
      cuisine_name:         cuisineRow?.name ?? null,
      recipe_name:          null,
      assigned_products:    assignedProducts,
      form_status:          visit.formStatus,
      submitted_at:         visit.submittedAt,
      decision:             visit.finalDecision ?? null,
      decision_comments:    visit.decisionComments,
      photos:               photosOut,
      history:              historyOut,
    });
  } catch (e) { next(e); }
});
