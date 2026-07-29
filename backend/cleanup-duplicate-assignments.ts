// One-time cleanup for the duplicate/orphaned LpProductAssignment bug (see
// check-duplicate-assignments.ts for the read-only diagnostic this builds
// on). Defaults to a dry run that only logs decisions — pass --apply to
// actually delete rows. Never touches:
//   - partners with an issued, non-revoked LpCertificate for that course
//   - any assignment referenced by a reviewed (reviewedAt != null) submission
// so approved partners and reviewed history are never modified or removed.
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const APPLY = process.argv.includes('--apply');

type Assignment = {
  id: string; userId: string; courseId: string; cuisineId: string; recipeId: string; createdAt: Date;
};

async function main() {
  const [assignments, recipes, cuisines, invites, certs, submissions, drafts] = await Promise.all([
    p.lpProductAssignment.findMany(),
    p.lpRecipe.findMany({ select: { id: true, foodName: true } }),
    p.lpCuisine.findMany({ select: { id: true, name: true } }),
    p.lpPartnerInvite.findMany({ where: { revokedAt: null }, select: { userId: true, courseId: true, recipientEmail: true } }),
    p.lpCertificate.findMany({ where: { revokedAt: null }, select: { userId: true, courseId: true } }),
    p.lpProductSubmission.findMany({ where: { reviewedAt: { not: null } }, select: { files: true } }),
    p.lpProductUploadDraft.findMany({ select: { assignmentId: true } }),
  ]);

  const recipeMap = new Map(recipes.map(r => [r.id, r] as const));
  const cuisineMap = new Map(cuisines.map(c => [c.id, c] as const));
  const inviteByUserCourse = new Map(
    invites.filter(i => i.userId).map(i => [`${i.userId}::${i.courseId}`, i] as const),
  );
  const certifiedKey = new Set(certs.map(c => `${c.userId}::${c.courseId}`));
  const draftAssignmentIds = new Set(drafts.map(d => d.assignmentId));

  // Every assignment_id a reviewed submission round has ever pointed at —
  // these must never be auto-deleted, regardless of which pass finds them.
  const reviewedAssignmentIds = new Set<string>();
  for (const s of submissions) {
    for (const f of (s.files as { assignment_id?: string }[]) ?? []) {
      if (f.assignment_id) reviewedAssignmentIds.add(f.assignment_id);
    }
  }

  const describe = (a: Assignment) => {
    const inv = inviteByUserCourse.get(`${a.userId}::${a.courseId}`);
    const recipe = recipeMap.get(a.recipeId);
    const cuisine = cuisineMap.get(a.cuisineId);
    return `partner=${inv?.recipientEmail ?? a.userId} course=${a.courseId} cuisine=${cuisine?.name ?? a.cuisineId} ` +
      `product=${recipe?.foodName ?? '(dead recipe)'} assignmentId=${a.id} createdAt=${a.createdAt.toISOString()}`;
  };

  const toDeleteAssignmentIds: string[] = [];
  const toDeleteDraftAssignmentIds: string[] = [];
  let skippedCertified = 0;
  let flagged = 0;

  // ── Pass A: orphaned assignments (recipeId no longer exists) ───────────────
  const orphaned = assignments.filter(a => !recipeMap.has(a.recipeId));
  console.log(`\n=== Pass A: orphaned assignments (${orphaned.length}) ===`);
  for (const a of orphaned) {
    const key = `${a.userId}::${a.courseId}`;
    if (certifiedKey.has(key)) { console.log(`SKIPPED: certified — ${describe(a)}`); skippedCertified++; continue; }
    if (reviewedAssignmentIds.has(a.id)) { console.log(`FLAGGED: reviewed submission references dead recipe — ${describe(a)}`); flagged++; continue; }
    console.log(`DELETE — ${describe(a)}`);
    toDeleteAssignmentIds.push(a.id);
    if (draftAssignmentIds.has(a.id)) toDeleteDraftAssignmentIds.push(a.id);
  }

  // ── Pass B: exact duplicates (same partner+course+cuisine+recipe) ──────────
  const byKey = new Map<string, Assignment[]>();
  for (const a of assignments) {
    if (!recipeMap.has(a.recipeId)) continue; // already handled by Pass A
    const k = `${a.userId}::${a.courseId}::${a.cuisineId}::${a.recipeId}`;
    const arr = byKey.get(k) ?? [];
    arr.push(a);
    byKey.set(k, arr);
  }
  const dupGroups = [...byKey.values()].filter(arr => arr.length > 1);
  console.log(`\n=== Pass B: exact-duplicate groups (${dupGroups.length}) ===`);
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
      console.log(`DELETE — ${describe(a)}`);
      toDeleteAssignmentIds.push(a.id);
      if (draftAssignmentIds.has(a.id)) toDeleteDraftAssignmentIds.push(a.id);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`${APPLY ? 'Deleting' : 'Would delete'} ${toDeleteAssignmentIds.length} assignment rows (${toDeleteDraftAssignmentIds.length} with drafts).`);
  console.log(`Skipped (certified): ${skippedCertified}. Flagged for manual review: ${flagged}.`);

  if (!APPLY) {
    console.log(`\nDry run only — no changes made. Re-run with --apply to perform these deletions.`);
    return;
  }

  // Apply per partner+course, one transaction each, so one partner's
  // surprise doesn't block everyone else's cleanup.
  const idsToDelete = new Set(toDeleteAssignmentIds);
  const byPartnerCourse = new Map<string, string[]>();
  for (const a of assignments) {
    if (!idsToDelete.has(a.id)) continue;
    const key = `${a.userId}::${a.courseId}`;
    const arr = byPartnerCourse.get(key) ?? [];
    arr.push(a.id);
    byPartnerCourse.set(key, arr);
  }
  let done = 0;
  for (const [key, ids] of byPartnerCourse) {
    try {
      await p.$transaction([
        p.lpProductUploadDraft.deleteMany({ where: { assignmentId: { in: ids.filter(id => toDeleteDraftAssignmentIds.includes(id)) } } }),
        p.lpProductAssignment.deleteMany({ where: { id: { in: ids } } }),
      ]);
      done += ids.length;
    } catch (e) {
      console.error(`FAILED to delete for ${key}:`, e);
    }
  }
  console.log(`\nApplied: deleted ${done}/${toDeleteAssignmentIds.length} assignment rows.`);
}

main().finally(() => p.$disconnect());
