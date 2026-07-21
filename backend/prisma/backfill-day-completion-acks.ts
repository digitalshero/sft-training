// One-time data backfill for the day-completion popup fix.
//
// For every partner + day that is ALREADY fully complete (every module in
// that day has completedAt set) as of the moment this script runs, insert an
// acknowledgement row so the new backend-driven popup never fires for a day
// they finished before this fix shipped. Days completed AFTER this script
// runs have no ack row yet and will correctly show their popup once, as
// designed.
//
// Run once, immediately after applying the accompanying migration and before
// real traffic hits the new /day-popup-status endpoint:
//   npx ts-node --transpile-only prisma/backfill-day-completion-acks.ts
//
// Safe to re-run: upsert is a no-op for days that already have an ack row.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const days = await prisma.lpCourseDay.findMany({
    select: { id: true, courseId: true },
  });

  let ensured = 0;

  for (const day of days) {
    const modules = await prisma.lpModule.findMany({
      where:  { dayId: day.id },
      select: { id: true },
    });
    if (!modules.length) continue;
    const moduleIds = modules.map(m => m.id);

    const completions = await prisma.lpModuleProgress.findMany({
      where:  { moduleId: { in: moduleIds }, completedAt: { not: null } },
      select: { userId: true, moduleId: true },
    });

    const completedModulesByUser = new Map<string, Set<string>>();
    completions.forEach(c => {
      const set = completedModulesByUser.get(c.userId) ?? new Set<string>();
      set.add(c.moduleId);
      completedModulesByUser.set(c.userId, set);
    });

    for (const [userId, completedSet] of completedModulesByUser) {
      const allComplete = moduleIds.every(id => completedSet.has(id));
      if (!allComplete) continue;

      await prisma.lpDayCompletionAck.upsert({
        where:  { userId_dayId: { userId, dayId: day.id } },
        create: { userId, dayId: day.id, courseId: day.courseId },
        update: {},
      });
      ensured++;
    }
  }

  console.log(`Backfill complete. Checked ${days.length} days, ensured ${ensured} acknowledgement rows exist (already-completed days are now treated as acknowledged).`);
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
