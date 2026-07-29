// Recovers product "slots" that lost their LpProductAssignment row (e.g. from
// cleanup-duplicate-assignments.ts deleting the wrong duplicate for a
// partner whose real upload predates assignment_id tagging and only had a
// text label). Never deletes or modifies anything — purely additive: for
// each submission file that references an assignment_id which no longer
// exists, resolves the file's label back to a current recipe, and — only if
// the partner doesn't already have a current assignment for that recipe —
// creates one new LpProductAssignment row so the product card reappears.
// Does not touch LpProductSubmission at all, so a partner's original
// uploaded photo/review status (never deleted by the cleanup script) will
// typically reattach automatically via the existing label-fallback matching
// once the assignment row exists again.
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const APPLY = process.argv.includes('--apply');

function parseLabel(label: string): { cuisineName: string; foodName: string } | null {
  const sep = ' — ';
  const idx = label.indexOf(sep);
  if (idx === -1) return null;
  return { cuisineName: label.slice(0, idx).trim(), foodName: label.slice(idx + sep.length).trim() };
}

async function main() {
  const [assignments, submissions, recipes, cuisines, invites] = await Promise.all([
    p.lpProductAssignment.findMany(),
    p.lpProductSubmission.findMany(),
    p.lpRecipe.findMany(),
    p.lpCuisine.findMany(),
    p.lpPartnerInvite.findMany({ where: { revokedAt: null }, select: { userId: true, courseId: true, recipientEmail: true } }),
  ]);

  const currentAssignmentIds = new Set(assignments.map(a => a.id));
  const hasCurrentAssignment = new Set(assignments.map(a => `${a.userId}::${a.courseId}::${a.recipeId}`));
  const inviteByUserCourse = new Map(
    invites.filter(i => i.userId).map(i => [`${i.userId}::${i.courseId}`, i] as const),
  );
  const cuisineByCourseName = new Map(cuisines.map(c => [`${c.courseId}::${c.name}`, c] as const));
  const recipeByCuisineFoodName = new Map(
    recipes.filter(r => r.cuisineId).map(r => [`${r.cuisineId}::${r.foodName}`, r] as const),
  );

  type Candidate = {
    userId: string; courseId: string; cuisineId: string; recipeId: string;
    cuisineName: string; foodName: string; decision: string | null; reviewedAt: Date | null;
  };
  const candidates = new Map<string, Candidate>();

  for (const s of submissions) {
    const files = (Array.isArray(s.files) ? s.files : []) as Array<{ assignment_id?: string; label?: string; decision?: string }>;
    for (const f of files) {
      if (f.assignment_id && currentAssignmentIds.has(f.assignment_id)) continue; // still connected, nothing to do
      if (!f.label) continue; // no way to resolve which product this was without a label
      const parsed = parseLabel(f.label);
      if (!parsed) continue;
      const cuisine = cuisineByCourseName.get(`${s.courseId}::${parsed.cuisineName}`);
      if (!cuisine) continue;
      const recipe = recipeByCuisineFoodName.get(`${cuisine.id}::${parsed.foodName}`);
      if (!recipe) continue; // product/cuisine renamed since — can't auto-resolve
      const key = `${s.userId}::${s.courseId}::${recipe.id}`;
      if (hasCurrentAssignment.has(key)) continue; // partner already has this product assigned — not missing
      if (!candidates.has(key)) {
        candidates.set(key, {
          userId: s.userId, courseId: s.courseId, cuisineId: cuisine.id, recipeId: recipe.id,
          cuisineName: cuisine.name, foodName: recipe.foodName,
          decision: f.decision ?? null, reviewedAt: s.reviewedAt,
        });
      }
    }
  }

  console.log(`Found ${candidates.size} missing product slot(s) with recoverable history:\n`);
  for (const c of candidates.values()) {
    const inv = inviteByUserCourse.get(`${c.userId}::${c.courseId}`);
    console.log(
      `${APPLY ? 'RESTORING' : 'WOULD RESTORE'} — partner=${inv?.recipientEmail ?? c.userId} course=${c.courseId} ` +
      `cuisine=${c.cuisineName} product=${c.foodName} priorDecision=${c.decision ?? 'not yet reviewed'} ` +
      `reviewedAt=${c.reviewedAt ? c.reviewedAt.toISOString() : 'unreviewed'}`,
    );
  }

  if (!APPLY) {
    console.log(`\nDry run only — no changes made. Re-run with --apply to recreate these assignment rows.`);
    return;
  }

  let created = 0;
  for (const c of candidates.values()) {
    await p.lpProductAssignment.create({
      data: { userId: c.userId, courseId: c.courseId, cuisineId: c.cuisineId, recipeId: c.recipeId },
    });
    created++;
  }
  console.log(`\nCreated ${created} assignment row(s).`);
}

main().finally(() => p.$disconnect());
