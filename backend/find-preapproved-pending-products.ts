// Read-only diagnostic: finds products currently sitting in a partner's
// active (unreviewed) submission round that were ALREADY approved or
// redo'd before, under a now-gone assignment record — the "already
// approved product shows up needing review again" symptom. For each
// currently-pending product, checks whether this partner+course ever had
// an earlier REVIEWED round whose file matches the same resolved product
// name (cuisine + food name), even if that file's assignment_id no longer
// points at anything. Makes no changes — just reports what it finds so the
// real scope (how many partners/products) is known before deciding what
// to do about each one.
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

type SubFile = { assignment_id?: string; label?: string; decision?: string; path?: string };

function resolveLabel(cuisineName: string, foodName: string) {
  return `${cuisineName} — ${foodName}`.trim();
}

async function main() {
  const [assignments, recipes, cuisines, invites, submissions] = await Promise.all([
    p.lpProductAssignment.findMany({ where: { removedAt: null } }),
    p.lpRecipe.findMany({ select: { id: true, foodName: true, cuisineId: true } }),
    p.lpCuisine.findMany({ select: { id: true, name: true } }),
    p.lpPartnerInvite.findMany({ where: { revokedAt: null }, select: { userId: true, courseId: true, recipientEmail: true } }),
    p.lpProductSubmission.findMany({ orderBy: { submittedAt: 'desc' } }),
  ]);

  const recipeMap = new Map(recipes.map(r => [r.id, r] as const));
  const cuisineMap = new Map(cuisines.map(c => [c.id, c] as const));
  const inviteByUserCourse = new Map<string, (typeof invites)[number]>(
    invites.filter(i => i.userId).map(i => [`${i.userId}::${i.courseId}`, i]),
  );

  // Group this partner+course's submissions once, newest first.
  const subsByUserCourse = new Map<string, typeof submissions>();
  for (const s of submissions) {
    const key = `${s.userId}::${s.courseId}`;
    const arr = subsByUserCourse.get(key) ?? [];
    arr.push(s);
    subsByUserCourse.set(key, arr);
  }

  let found = 0;

  for (const a of assignments) {
    const recipe = recipeMap.get(a.recipeId);
    if (!recipe) continue;
    const cuisineId = recipe.cuisineId ?? a.cuisineId;
    const cuisine = cuisineMap.get(cuisineId ?? '');
    const label = resolveLabel(cuisine?.name ?? '', recipe.foodName);

    const key = `${a.userId}::${a.courseId}`;
    const subs = subsByUserCourse.get(key) ?? [];

    // Does this assignment id currently have a PENDING (unreviewed) file?
    let hasPendingOwnFile = false;
    for (const s of subs) {
      if (s.reviewedAt !== null) continue; // only the active round matters here
      const files = (Array.isArray(s.files) ? s.files : []) as SubFile[];
      if (files.some(f => f.assignment_id === a.id)) { hasPendingOwnFile = true; break; }
    }
    if (!hasPendingOwnFile) continue;

    // Was this same product (by label) ever already decided in an EARLIER
    // reviewed round, under any assignment_id (including a now-gone one)?
    let priorDecision: { decision?: string; reviewedAt: Date | null } | null = null;
    for (const s of subs) {
      if (s.reviewedAt === null) continue; // skip the current active round
      const files = (Array.isArray(s.files) ? s.files : []) as SubFile[];
      const match = files.find(f => f.label === label || f.assignment_id === a.id);
      if (match) { priorDecision = { decision: match.decision, reviewedAt: s.reviewedAt }; break; }
    }
    if (!priorDecision) continue;

    found++;
    const inv = inviteByUserCourse.get(key);
    console.log(
      `partner=${inv?.recipientEmail ?? a.userId} course=${a.courseId} product=${label} ` +
      `assignmentId=${a.id} priorDecision=${priorDecision.decision ?? '(unknown)'} ` +
      `priorReviewedAt=${priorDecision.reviewedAt?.toISOString() ?? '?'}`,
    );
  }

  console.log(`\nTotal: ${found} pending product(s) that appear to have already been decided once before.`);
}

main().finally(() => p.$disconnect());
