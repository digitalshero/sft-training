import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const p = new PrismaClient();

async function main() {
  const email = 'admin@shero.in'; // change this to the email you're trying to log into
  const newPassword = 'ChangeMe#123'; // change this to whatever you want

  const hash = await bcrypt.hash(newPassword, 12);
  const result = await p.user.update({
    where: { email },
    data: { passwordHash: hash },
  });
  console.log('Password reset for:', result.email);
}

main().finally(() => p.$disconnect());