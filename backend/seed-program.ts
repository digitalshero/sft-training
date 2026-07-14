import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const program = await prisma.lpProgram.create({
    data: {
      slug: 'shero-certified-partner',
      title: 'Shero Certified Partner Program',
      summary: 'Complete training program for Shero kitchen partners',
      published: true,
      sortOrder: 1,
    },
  });
  console.log('Created:', program.title);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());