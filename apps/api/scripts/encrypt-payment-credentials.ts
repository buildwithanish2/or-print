import path from 'path';
import dotenv from 'dotenv';
import { prisma } from '../src/prisma';
import { decryptPaymentCredentialWithKey, encryptPaymentCredentialWithKey } from '../src/services/payment.service';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const apply = process.argv.includes('--apply');
const rotate = process.argv.includes('--rotate');
const newKey = process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY || '';
const oldKey = rotate ? process.env.PAYMENT_CREDENTIALS_OLD_KEY || '' : '';

const isValidKey = (key: string) => /^[a-f\d]{64}$/i.test(key);

async function main() {
  if (!isValidKey(newKey)) throw new Error('Set PAYMENT_CREDENTIALS_ENCRYPTION_KEY to a 64-character hex key before running this utility');
  if (rotate && !isValidKey(oldKey)) throw new Error('Set PAYMENT_CREDENTIALS_OLD_KEY to the current 64-character hex key when rotating encrypted values');

  const rows = await prisma.paymentGatewayConfig.findMany({
    select: { id: true, apiSecret: true, webhookSecret: true },
  });
  const updates = rows.flatMap((row) => {
    const data: { apiSecret?: string; webhookSecret?: string } = {};
    for (const field of ['apiSecret', 'webhookSecret'] as const) {
      const value = row[field];
      if (!value) continue;
      if (rotate) {
        if (!value.startsWith('enc:v1:')) continue;
        data[field] = encryptPaymentCredentialWithKey(decryptPaymentCredentialWithKey(value, oldKey), newKey);
      } else {
        if (value.startsWith('enc:v1:')) continue;
        data[field] = encryptPaymentCredentialWithKey(value, newKey);
      }
    }
    return Object.keys(data).length ? [{ id: row.id, data }] : [];
  });

  console.log(`Credential fields selected: ${updates.length ? updates.reduce((n, item) => n + Object.keys(item.data).length, 0) : 0}`);
  console.log(`Mode: ${rotate ? 'ciphertext key rotation' : 'legacy plaintext conversion'}; apply: ${apply}`);
  if (!apply) {
    console.log('Dry run only. No database records were changed. Add --apply only after taking and verifying a database backup.');
    return;
  }
  await prisma.$transaction(async (tx) => {
    for (const update of updates) await tx.paymentGatewayConfig.update({ where: { id: update.id }, data: update.data });
  });
  console.log('Credential encryption update committed. No credential values were displayed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Payment credential maintenance failed');
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
