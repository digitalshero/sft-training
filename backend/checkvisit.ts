import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const approvedSubs = await p.lpProductSubmission.findMany({
    where: { status: 'approved' },
  });
  console.log('Approved submissions:', JSON.stringify(approvedSubs, null, 2));

  const visits = await p.lpPhysicalVisit.findMany();
  console.log('Existing visits:', JSON.stringify(visits, null, 2));

  const invites = await p.lpPartnerInvite.findMany({
    where: { revokedAt: null },
  });
  console.log('Invites:', JSON.stringify(invites.map(i => ({ userId: i.userId, courseId: i.courseId, name: i.recipientName })), null, 2));
}

main().finally(() => p.$disconnect());