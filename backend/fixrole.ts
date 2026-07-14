import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const user = await p.user.findUnique({
    where: { email: 'admin@shero.in' },
    include: { userRoles: true },
  });

  if (!user) { console.log('User not found'); return; }

  console.log('Current roles:', user.userRoles.map(r => r.role));

  const hasRole = user.userRoles.some(r => r.role === 'super_admin');
  if (hasRole) { console.log('Already has super_admin role'); return; }

  await p.userRole.create({ data: { userId: user.id, role: 'super_admin' } });
  console.log('super_admin role added to', user.email);
}

main().finally(() => p.$disconnect());
