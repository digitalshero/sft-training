import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const logs = await p.emailSendLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
  console.log(JSON.stringify(logs, null, 2));
})().finally(() => p.$disconnect());
