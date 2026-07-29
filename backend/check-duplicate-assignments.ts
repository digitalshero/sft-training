// Read-only diagnostic: find LpProductAssignment rows that explain the
// "same cuisine card repeated with no product name" symptom seen in SFT
// Review — either (a) the same partner assigned the same recipe more than
// once, or (b) an assignment's recipeId no longer matches any LpRecipe row
// (e.g. the recipe was deleted/recreated in Course Builder). Makes no
// writes — safe to run against production to scope the problem.
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const [assignments, recipes, cuisines, invites] = await Promise.all([
    p.lpProductAssignment.findMany(),
    p.lpRecipe.findMany({ select: { id: true, foodName: true, cuisineId: true, active: true } }),
    p.lpCuisine.findMany({ select: { id: true, name: true } }),
    p.lpPartnerInvite.findMany({ where: { revokedAt: null }, select: { userId: true, courseId: true, recipientName: true, recipientEmail: true } }),
  ]);

  const recipeMap = new Map(recipes.map(r => [r.id, r] as const));
  const cuisineMap = new Map(cuisines.map(c => [c.id, c] as const));
  const inviteByUserCourse = new Map(
    invites.filter(i => i.userId).map(i => [`${i.userId}::${i.courseId}`, i] as const),
  );

  // 1) Orphaned recipeId — the "blank product name" case.
  const orphaned = assignments.filter(a => !recipeMap.has(a.recipeId));
  console.log(`\n=== Orphaned assignments (recipeId no longer exists): ${orphaned.length} ===`);
  for (const a of orphaned) {
    const inv = inviteByUserCourse.get(`${a.userId}::${a.courseId}`);
    console.log(
      `partner=${inv?.recipientEmail ?? a.userId} course=${a.courseId} cuisine=${cuisineMap.get(a.cuisineId)?.name ?? a.cuisineId} ` +
      `assignmentId=${a.id} deadRecipeId=${a.recipeId} createdAt=${a.createdAt.toISOString()}`,
    );
  }

  // 2) Same partner + course + cuisine + recipe assigned more than once.
  const byKey = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const k = `${a.userId}::${a.courseId}::${a.cuisineId}::${a.recipeId}`;
    const arr = byKey.get(k) ?? [];
    arr.push(a);
    byKey.set(k, arr);
  }
  const trueDuplicates = [...byKey.entries()].filter(([, arr]) => arr.length > 1);
  console.log(`\n=== Exact duplicate assignments (same partner+course+cuisine+recipe): ${trueDuplicates.length} groups ===`);
  for (const [key, arr] of trueDuplicates) {
    const [userId, courseId] = key.split('::');
    const inv = inviteByUserCourse.get(`${userId}::${courseId}`);
    const recipe = recipeMap.get(arr[0].recipeId);
    console.log(
      `partner=${inv?.recipientEmail ?? userId} course=${courseId} product=${recipe?.foodName ?? '(deleted)'} ` +
      `count=${arr.length} assignmentIds=[${arr.map(a => a.id).join(', ')}]`,
    );
  }

  // 3) Per-partner-per-cuisine assignment counts, to spot cuisines with an
  //    unexpectedly high product count (e.g. more than that cuisine's
  //    configured showCount, another sign of double-assignment).
  const byPartnerCuisine = new Map<string, number>();
  for (const a of assignments) {
    const k = `${a.userId}::${a.courseId}::${a.cuisineId}`;
    byPartnerCuisine.set(k, (byPartnerCuisine.get(k) ?? 0) + 1);
  }
  const suspicious = [...byPartnerCuisine.entries()].filter(([, count]) => count > 5);
  console.log(`\n=== Partner+cuisine groups with more than 5 assigned products: ${suspicious.length} ===`);
  for (const [key, count] of suspicious) {
    const [userId, courseId, cuisineId] = key.split('::');
    const inv = inviteByUserCourse.get(`${userId}::${courseId}`);
    console.log(`partner=${inv?.recipientEmail ?? userId} cuisine=${cuisineMap.get(cuisineId)?.name ?? cuisineId} productCount=${count}`);
  }

  console.log(`\nTotals: ${assignments.length} assignment rows, ${orphaned.length} orphaned, ${trueDuplicates.length} exact-duplicate groups, ${suspicious.length} over-5 groups.`);
}

main().finally(() => p.$disconnect());
