// Cleans up the duplicate product cards created by a since-fixed bug in the
// cuisine "top-up" logic: it used to compare only by raw recipeId, so a
// recipe deactivated/recreated under a new id (same dish, new database row)
// was treated as a brand-new missing product and given a second assignment
// row alongside the partner's existing one. This groups active assignments
// by resolved product NAME (not recipeId) within the same partner+course+
// cuisine, and soft-removes (removedAt, never hard-deletes) every row in a
// group except the one to keep — using the same removedAt mechanism the
// cuisine remove/restore feature already uses, so history is preserved and
// nothing here is a permanent deletion.
//
// Defaults to a dry run that only logs decisions — pass --apply to write.
// Never touches partners with an issued, non-revoked certificate, and never
// auto-picks a keeper when more than one duplicate already has reviewed
// history (that's flagged for manual review instead of guessed at).
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const APPLY = process.argv.includes('--apply');

type Assignment = {
  id: string; userId: string; courseId: string; cuisineId: string; recipeId: string; createdAt: Date;
};

async function main() {
  const [assignments, recipes, invites, certs, reviewedSubs, drafts] = await Promise.all([
    p.lpProductAssignment.findMany({ where: { removedAt: null } }),
    p.lpRecipe.findMany({ select: { id: true, foodName: true, cuisineId: true } }),
    p.lpPartnerInvite.findMany({ where: { revokedAt: null }, select: { userId: true, courseId: true, recipientEmail: true } }),
    p.lpCertificate.findMany({ where: { revokedAt: null }, select: { userId: true, courseId: true } }),
    p.lpProductSubmission.findMany({ where: { reviewedAt: { not: null } }, select: { files: true } }),
    p.lpProductUploadDraft.findMany({ select: { assignmentId: true } }),
  ]);

  const recipeMap = new Map(recipes.map(r => [r.id, r] as const));
  const inviteByUserCourse = new Map(
    invites.filter(i => i.userId).map(i => [`${i.userId}::${i.courseId}`, i] as const),
  );
  const certifiedKey = new Set(certs.map(c => `${c.userId}::${c.courseId}`));
  const draftAssignmentIds = new Set(drafts.map(d => d.assignmentId));

  const reviewedAssignmentIds = new Set<string>();
  for (const s of reviewedSubs) {
    for (const f of (s.files as { assignment_id?: string }[]) ?? []) {
      if (f.assignment_id) reviewedAssignmentIds.add(f.assignment_id);
    }
  }

  const describe = (a: Assignment) => {
    const inv = inviteByUserCourse.get(`${a.userId}::${a.courseId}`);
    const recipe = recipeMap.get(a.recipeId);
    return `partner=${inv?.recipientEmail ?? a.userId} course=${a.courseId} cuisine=${a.cuisineId} ` +
      `product=${recipe?.foodName ?? '(unresolved recipe)'} assignmentId=${a.id} createdAt=${a.createdAt.toISOString()}`;
  };

  // Group by partner+course+cuisine+resolved product name (not recipeId).
  const byKey = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const recipe = recipeMap.get(a.recipeId);
    const foodName = (recipe?.foodName ?? '').trim().toLowerCase();
    if (!foodName) continue; // can't group an unresolvable recipe by name
    const cuisineId = recipe.cuisineId ?? a.cuisineId;
    const key = `${a.userId}::${a.courseId}::${cuisineId}::${foodName}`;
    const arr = byKey.get(key) ?? [];
    arr.push(a);
    byKey.set(key, arr);
  }
  const dupGroups = [...byKey.values()].filter(arr => arr.length > 1);

  console.log(`\n=== Duplicate-by-product-name groups: ${dupGroups.length} ===`);
  const toRemove: string[] = [];
  let skippedCertified = 0;
  let flagged = 0;

  for (const group of dupGroups) {
    const key = `${group[0].userId}::${group[0].courseId}`;
    if (certifiedKey.has(key)) {
      console.log(`SKIPPED: certified — group of ${group.length} for ${describe(group[0])}`);
      skippedCertified += group.length;
      continue;
    }
    const reviewedRows = group.filter(a => reviewedAssignmentIds.has(a.id));
    if (reviewedRows.length > 1) {
      console.log(`FLAGGED: ${reviewedRows.length} rows in this group have reviewed history — ambiguous, needs manual look. Group: ${group.map(a => a.id).join(', ')}`);
      flagged += group.length;
      continue;
    }
    let keeper: Assignment;
    if (reviewedRows.length === 1) {
      keeper = reviewedRows[0];
    } else {
      const draftRows = group.filter(a => draftAssignmentIds.has(a.id));
      const pool = draftRows.length ? draftRows : group;
      keeper = pool.reduce((earliest, a) => (a.createdAt < earliest.createdAt ? a : earliest), pool[0]);
    }
    console.log(`KEEP   — ${describe(keeper)}`);
    for (const a of group) {
      if (a.id === keeper.id) continue;
      console.log(`REMOVE — ${describe(a)}`);
      toRemove.push(a.id);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`${APPLY ? 'Soft-removing' : 'Would soft-remove'} ${toRemove.length} duplicate assignment row(s) (removedAt set, not deleted).`);
  console.log(`Skipped (certified): ${skippedCertified}. Flagged for manual review: ${flagged}.`);

  if (!APPLY) {
    console.log(`\nDry run only — no changes made. Re-run with --apply to perform this soft-removal.`);
    return;
  }

  await p.lpProductAssignment.updateMany({ where: { id: { in: toRemove } }, data: { removedAt: new Date() } });
  console.log(`\nApplied: soft-removed ${toRemove.length} duplicate assignment row(s).`);
}

main().finally(() => p.$disconnect());
