import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

dotenv.config();

const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() || '';
const name = process.env.INITIAL_ADMIN_NAME?.trim() || '';
const password = process.env.INITIAL_ADMIN_PASSWORD || '';
const prisma = new PrismaClient();

async function main() {
  if (!/^\S+@\S+\.\S+$/.test(email) || name.length < 2 || password.length < 24) {
    throw new Error('Set INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_NAME, and a unique INITIAL_ADMIN_PASSWORD of at least 24 characters through the deployment secret manager.');
  }
  const adminCount = await prisma.user.count({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } } });
  if (adminCount > 0) throw new Error('An administrator already exists. This one-time provisioning command will not create or replace accounts.');
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('The requested administrator email already belongs to an account; no role was changed.');

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { email, name, passwordHash, role: 'SUPER_ADMIN', isActive: true } });
  console.log('Initial administrator provisioned. Sign in through the Admin Portal and remove the one-time provisioning secrets from the deployment environment.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Administrator provisioning failed');
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
