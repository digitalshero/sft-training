import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const deckResult = await p.sftDeckSetup.updateMany({
    data: { voice: 'EXAVITQu4vr4xnSDxMaL' },
  });
  console.log('Updated decks to Bella:', deckResult.count);

  const modResult = await p.lpModule.updateMany({
    where: { type: 'slides' },
    data: { voice: 'EXAVITQu4vr4xnSDxMaL' },
  });
  console.log('Updated modules to Bella:', modResult.count);
}

main().finally(() => p.$disconnect());