import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database…');

  // ── fc_units ──────────────────────────────────────────────────────────────
  const units = [
    // Mass
    { code: 'g',   name: 'Gram',       kind: 'mass'   },
    { code: 'kg',  name: 'Kilogram',   kind: 'mass'   },
    { code: 'mg',  name: 'Milligram',  kind: 'mass'   },
    { code: 'oz',  name: 'Ounce',      kind: 'mass'   },
    { code: 'lb',  name: 'Pound',      kind: 'mass'   },
    // Volume
    { code: 'ml',  name: 'Millilitre', kind: 'volume' },
    { code: 'l',   name: 'Litre',      kind: 'volume' },
    { code: 'tsp', name: 'Teaspoon',   kind: 'volume' },
    { code: 'tbsp',name: 'Tablespoon', kind: 'volume' },
    { code: 'cup', name: 'Cup',        kind: 'volume' },
    { code: 'fl_oz',name: 'Fluid Ounce',kind:'volume' },
    // Count
    { code: 'pcs', name: 'Pieces',     kind: 'count'  },
    { code: 'nos', name: 'Numbers',    kind: 'count'  },
    { code: 'bunch',name: 'Bunch',     kind: 'count'  },
    { code: 'sprig',name: 'Sprig',     kind: 'count'  },
    { code: 'leaf', name: 'Leaf',      kind: 'count'  },
    // Other
    { code: 'pinch',name: 'Pinch',     kind: 'other'  },
    { code: 'to_taste',name: 'To Taste',kind:'other'  },
  ];

  for (const u of units) {
    await prisma.fcUnit.upsert({
      where:  { code: u.code },
      create: u,
      update: { name: u.name, kind: u.kind },
    });
  }
  console.log(`   ✓ ${units.length} fc_units seeded`);

  // ── Default super_admin user ──────────────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@shero.in';
  const adminPass  = process.env.SEED_ADMIN_PASS;

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    if (!adminPass) {
      throw new Error(
        'SEED_ADMIN_PASS is not set — refusing to create the super_admin ' +
        'account with a guessable default password. Set SEED_ADMIN_PASS in ' +
        'your .env before running the seed.',
      );
    }
    const hash = await bcrypt.hash(adminPass, 12);
    const u = await prisma.user.create({
      data: {
        email:          adminEmail,
        passwordHash:   hash,
        emailConfirmed: true,
        profile:        { create: { displayName: 'Super Admin' } },
        userRoles:      { create: { role: 'super_admin' } },
      },
    });
    console.log(`   ✓ Super admin created: ${u.email}`);
  } else {
    console.log(`   · Super admin already exists: ${adminEmail}`);
  }

  // ── config_entries (site-wide settings) ───────────────────────────────────
  const configEntries = [
    { section: 'site',   key: 'support_email',    label: 'Support Email',   value: '"support@shero.in"' },
    { section: 'site',   key: 'whatsapp_number',  label: 'WhatsApp Number', value: '"917000000000"' },
    { section: 'sft',    key: 'pass_pct',          label: 'Default Pass %',  value: '70' },
  ];
  for (const c of configEntries) {
    await prisma.configEntry.upsert({
      where:  { section_key: { section: c.section, key: c.key } },
      create: { ...c, value: JSON.parse(c.value) },
      update: {},
    });
  }
  console.log(`   ✓ ${configEntries.length} config entries seeded`);

  console.log('✅ Seed complete');
}

main()
  .catch(e => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
