import { prisma } from './prisma';
import { PERMANENT_SUPER_ADMIN_EMAIL } from './constants';

// Old shared key that used to gate Invite & Certify, SFT Review, and Physical
// Visit together. Replaced with one key per page so access can be granted
// independently — expand any existing grants so nobody silently loses access.
const LEGACY_SFT_KEY = 'sft_invite_review';
const REPLACEMENT_SFT_KEYS = ['sft_invite_certify', 'sft_review', 'sft_physical_visit'];

export async function runStartupMigrations(): Promise<void> {
  await ensurePermanentSuperAdmin();
  await expandLegacySftPermission();
}

// admin@shero.in must always be super_admin, even if another super_admin
// tries to change it directly in the database or via a restored backup.
async function ensurePermanentSuperAdmin(): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: PERMANENT_SUPER_ADMIN_EMAIL } });
  if (!user) return; // created by prisma/seed.ts on first deploy

  await prisma.userRole.upsert({
    where:  { userId_role: { userId: user.id, role: 'super_admin' } },
    create: { userId: user.id, role: 'super_admin' },
    update: {},
  });
}

async function expandLegacySftPermission(): Promise<void> {
  const legacyGrants = await prisma.appPermission.findMany({ where: { permissionKey: LEGACY_SFT_KEY } });
  if (!legacyGrants.length) return;

  await prisma.appPermission.createMany({
    data: legacyGrants.flatMap(g =>
      REPLACEMENT_SFT_KEYS.map(key => ({ userId: g.userId, permissionKey: key, grantedBy: g.grantedBy })),
    ),
    skipDuplicates: true,
  });
  await prisma.appPermission.deleteMany({ where: { permissionKey: LEGACY_SFT_KEY } });
}