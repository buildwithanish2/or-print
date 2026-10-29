import { prisma } from '../prisma';
import crypto from 'crypto';
import { COLLEGE_ID_HASH_SECRET } from '../config/secrets';

export class FreePrintEligibilityError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}

export const isFreePrintPolicyActive = <T extends { enabled: boolean; startsAt: Date | null; expiresAt: Date | null }>(
  policy: T | null | undefined,
  now = new Date(),
): policy is T => Boolean(policy?.enabled && (!policy.startsAt || policy.startsAt <= now) && (!policy.expiresAt || policy.expiresAt > now));

export const kolkataPeriodKeys = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).reduce<Record<string, string>>((out, part) => {
    if (part.type !== 'literal') out[part.type] = part.value;
    return out;
  }, {});
  return { dayKey: `${parts.year}-${parts.month}-${parts.day}`, monthKey: `${parts.year}-${parts.month}` };
};

export const canReserveFreePrintAllowance = (input: {
  requestedPages: number; requestedCopies: number;
  completedPages: number; reservedPages: number; pageLimit: number;
  completedCopies: number; reservedCopies: number; copyLimit: number;
}) => input.requestedPages > 0 && input.requestedCopies > 0
  && input.requestedPages + input.completedPages + input.reservedPages <= input.pageLimit
  && input.requestedCopies + input.completedCopies + input.reservedCopies <= input.copyLimit;

export async function getFreePrintEligibility(userId: string, shopId: string, colorModes: string[]) {
  const [user, policy, shopSettings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { verification: { include: { institution: true } } } }),
    prisma.freePrintPolicy.findUnique({ where: { id: 'global' } }),
    prisma.freePrintShopSetting.findUnique({ where: { shopId } }),
  ]);
  if (!user || !user.isActive) throw new FreePrintEligibilityError('Sign in with an active account to check free-print eligibility.', 'AUTH_REQUIRED');
  if (!isFreePrintPolicyActive(policy)) {
    throw new FreePrintEligibilityError('College free printing is not currently active.', 'POLICY_INACTIVE');
  }
  if (!shopSettings?.participating) throw new FreePrintEligibilityError('This shop is not participating in college free printing.', 'SHOP_NOT_PARTICIPATING');
  const verification = user.verification;
  if (!['STUDENT', 'TEACHER'].includes(user.role) || !verification || !verification.active || verification.status !== 'APPROVED' || !verification.institution.isActive || !verification.institution.isEligible) {
    throw new FreePrintEligibilityError('Your account does not have an active approved student or teacher verification.', 'NOT_VERIFIED');
  }
  const role = user.role as 'STUDENT' | 'TEACHER';
  if (colorModes.includes('COLOR') && !policy.allowColor) throw new FreePrintEligibilityError('Color mode is not allowed by the current college policy.', 'COLOR_NOT_ALLOWED');
  if (colorModes.includes('BW') && !policy.allowBlackWhite) throw new FreePrintEligibilityError('Black and white mode is not allowed by the current college policy.', 'BW_NOT_ALLOWED');
  const { dayKey, monthKey } = kolkataPeriodKeys();
  const [day, month] = await Promise.all([
    prisma.freePrintUsage.findUnique({ where: { userId_periodType_periodKey: { userId, periodType: 'DAY', periodKey: dayKey } } }),
    prisma.freePrintUsage.findUnique({ where: { userId_periodType_periodKey: { userId, periodType: 'MONTH', periodKey: monthKey } } }),
  ]);
  const dailyPageLimit = role === 'STUDENT' ? policy.studentDailyPages : policy.teacherDailyPages;
  const monthlyPageLimit = role === 'STUDENT' ? policy.studentMonthlyPages : policy.teacherMonthlyPages;
  const dailyCopyLimit = role === 'STUDENT' ? policy.studentDailyCopies : policy.teacherDailyCopies;
  const monthlyCopyLimit = role === 'STUDENT' ? policy.studentMonthlyCopies : policy.teacherMonthlyCopies;
  return {
    policy, role, institution: verification.institution,
    dayKey, monthKey,
    remainingDailyPages: Math.max(0, dailyPageLimit - (day?.completedPages || 0) - (day?.reservedPages || 0)),
    remainingMonthlyPages: Math.max(0, monthlyPageLimit - (month?.completedPages || 0) - (month?.reservedPages || 0)),
    remainingDailyCopies: Math.max(0, dailyCopyLimit - (day?.completedCopies || 0) - (day?.reservedCopies || 0)),
    remainingMonthlyCopies: Math.max(0, monthlyCopyLimit - (month?.completedCopies || 0) - (month?.reservedCopies || 0)),
  };
}

export const hashGuestAccessToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
export const hashCollegeIdNumber = (institutionId: string, idNumber: string) => crypto.createHmac('sha256', COLLEGE_ID_HASH_SECRET)
  .update(`${institutionId}:${idNumber.normalize('NFKC').replace(/[\s-]/g, '').toUpperCase()}`).digest('hex');
export const canShopOwnerReviewGuestId = (role: string, actorShopId: string | null | undefined, requestShopId: string) => role === 'SHOP_OWNER' && Boolean(actorShopId) && actorShopId === requestShopId;

export async function getGuestVerificationByToken(token: string) {
  if (!token || token.length < 32 || token.length > 256) return null;
  return prisma.guestInstitutionVerification.findUnique({ where: { accessTokenHash: hashGuestAccessToken(token) } });
}

export async function getGuestFreePrintEligibility(token: string, shopId: string, colorModes: string[]) {
  const verification = await getGuestVerificationByToken(token);
  if (!verification || verification.shopId !== shopId || verification.status !== 'APPROVED' || !verification.active || !verification.identityHash) {
    throw new FreePrintEligibilityError('A shop owner must approve your institution ID before free printing.', 'NOT_VERIFIED');
  }
  const [institution, policy, shopSettings] = await Promise.all([
    prisma.institution.findUnique({ where: { id: verification.institutionId } }),
    prisma.freePrintPolicy.findUnique({ where: { id: 'global' } }),
    prisma.freePrintShopSetting.findUnique({ where: { shopId } }),
  ]);
  const now = new Date();
  if (!institution?.isActive || !institution.isEligible) throw new FreePrintEligibilityError('This institution is not currently eligible.', 'INSTITUTION_INACTIVE');
  if (!isFreePrintPolicyActive(policy, now)) throw new FreePrintEligibilityError('College free printing is not currently active.', 'POLICY_INACTIVE');
  if (!shopSettings?.participating) throw new FreePrintEligibilityError('This shop is not participating in college free printing.', 'SHOP_NOT_PARTICIPATING');
  if (colorModes.includes('COLOR') && !policy.allowColor) throw new FreePrintEligibilityError('Color mode is not allowed by the current college policy.', 'COLOR_NOT_ALLOWED');
  if (colorModes.includes('BW') && !policy.allowBlackWhite) throw new FreePrintEligibilityError('Black and white mode is not allowed by the current college policy.', 'BW_NOT_ALLOWED');
  const { dayKey, monthKey } = kolkataPeriodKeys();
  const [day, month] = await Promise.all([
    prisma.freePrintUsage.findUnique({ where: { guestIdentityHash_periodType_periodKey: { guestIdentityHash: verification.identityHash, periodType: 'DAY', periodKey: dayKey } } }),
    prisma.freePrintUsage.findUnique({ where: { guestIdentityHash_periodType_periodKey: { guestIdentityHash: verification.identityHash, periodType: 'MONTH', periodKey: monthKey } } }),
  ]);
  const role = verification.requestedRole as 'STUDENT' | 'TEACHER';
  const dailyPageLimit = role === 'STUDENT' ? policy.studentDailyPages : policy.teacherDailyPages;
  const monthlyPageLimit = role === 'STUDENT' ? policy.studentMonthlyPages : policy.teacherMonthlyPages;
  const dailyCopyLimit = role === 'STUDENT' ? policy.studentDailyCopies : policy.teacherDailyCopies;
  const monthlyCopyLimit = role === 'STUDENT' ? policy.studentMonthlyCopies : policy.teacherMonthlyCopies;
  return {
    policy, role, institution, identityHash: verification.identityHash, verificationId: verification.id,
    dayKey, monthKey,
    remainingDailyPages: Math.max(0, dailyPageLimit - (day?.completedPages || 0) - (day?.reservedPages || 0)),
    remainingMonthlyPages: Math.max(0, monthlyPageLimit - (month?.completedPages || 0) - (month?.reservedPages || 0)),
    remainingDailyCopies: Math.max(0, dailyCopyLimit - (day?.completedCopies || 0) - (day?.reservedCopies || 0)),
    remainingMonthlyCopies: Math.max(0, monthlyCopyLimit - (month?.completedCopies || 0) - (month?.reservedCopies || 0)),
  };
}

export async function reserveFreePrintAllowance(tx: any, args: {
  orderId: string; userId?: string | null; guestIdentityHash?: string | null; guestVerificationId?: string | null; pages: number; copies: number;
  dayKey: string; monthKey: string; policySnapshot: unknown;
  shopId: string; printerId: string; options: Array<{ colorMode: string; duplexMode: string; paperSize: string }>;
}) {
  const now = new Date();
  const [policy, user, guestVerification, shopSetting, printer] = await Promise.all([
    tx.freePrintPolicy.findUnique({ where: { id: 'global' } }),
    args.userId ? tx.user.findUnique({ where: { id: args.userId }, include: { verification: { include: { institution: true } } } }) : null,
    args.guestVerificationId ? tx.guestInstitutionVerification.findUnique({ where: { id: args.guestVerificationId }, include: { institution: true } }) : null,
    tx.freePrintShopSetting.findUnique({ where: { shopId: args.shopId } }),
    tx.printer.findFirst({ where: { id: args.printerId, shopId: args.shopId, status: 'ONLINE' } }),
  ]);
  if (!isFreePrintPolicyActive(policy, now)) throw new FreePrintEligibilityError('College free printing is not currently active.', 'POLICY_INACTIVE');
  const requestedInstitutionId = (args.policySnapshot as { institutionId?: string }).institutionId;
  const isGuest = Boolean(args.guestIdentityHash && args.guestVerificationId);
  const role = isGuest ? guestVerification?.requestedRole : user?.role;
  const eligibleIdentity = isGuest
    ? guestVerification?.identityHash === args.guestIdentityHash && guestVerification?.status === 'APPROVED' && guestVerification?.active && guestVerification?.shopId === args.shopId && guestVerification?.institutionId === requestedInstitutionId && guestVerification?.institution.isActive && guestVerification?.institution.isEligible
    : Boolean(user?.isActive && ['STUDENT', 'TEACHER'].includes(user.role) && user.role === (args.policySnapshot as { role?: string }).role && user.verification?.active && user.verification.status === 'APPROVED' && user.verification.institutionId === requestedInstitutionId && user.verification.institution.isActive && user.verification.institution.isEligible);
  if (!eligibleIdentity || !['STUDENT', 'TEACHER'].includes(role || '')) throw new FreePrintEligibilityError('Your approved institution verification is no longer active.', 'NOT_VERIFIED');
  if (!shopSetting?.participating) throw new FreePrintEligibilityError('This shop is no longer participating in college free printing.', 'SHOP_NOT_PARTICIPATING');
  if (!printer) throw new FreePrintEligibilityError('The selected printer is no longer online.', 'PRINTER_UNAVAILABLE');
  const supportedSizes = printer.supportedSizes.split(',').map((size: string) => size.trim().toUpperCase()).filter(Boolean);
  for (const option of args.options) {
    if (option.colorMode === 'COLOR' && (!policy.allowColor || !printer.supportsColor)) throw new FreePrintEligibilityError('Color mode is no longer allowed by policy or this printer.', 'COLOR_NOT_ALLOWED');
    if (option.colorMode === 'BW' && !policy.allowBlackWhite) throw new FreePrintEligibilityError('Black and white mode is not allowed by policy.', 'BW_NOT_ALLOWED');
    if (option.duplexMode !== 'SIMPLEX' && !printer.supportsDuplex) throw new FreePrintEligibilityError('Duplex mode is no longer supported by this printer.', 'PRINTER_MODE_UNSUPPORTED');
    if (supportedSizes.length && !supportedSizes.includes(option.paperSize.toUpperCase())) throw new FreePrintEligibilityError('Selected paper size is no longer supported by this printer.', 'PRINTER_MODE_UNSUPPORTED');
  }
  const roleValue = role as 'STUDENT' | 'TEACHER';
  const dailyPageLimit = roleValue === 'STUDENT' ? policy.studentDailyPages : policy.teacherDailyPages;
  const monthlyPageLimit = roleValue === 'STUDENT' ? policy.studentMonthlyPages : policy.teacherMonthlyPages;
  const dailyCopyLimit = roleValue === 'STUDENT' ? policy.studentDailyCopies : policy.teacherDailyCopies;
  const monthlyCopyLimit = roleValue === 'STUDENT' ? policy.studentMonthlyCopies : policy.teacherMonthlyCopies;
  const policySnapshot = { ...(args.policySnapshot as object), policyId: policy.id, role: roleValue, dailyPageLimit, monthlyPageLimit, dailyCopyLimit, monthlyCopyLimit };
  for (const [periodType, periodKey] of [['DAY', args.dayKey], ['MONTH', args.monthKey]] as const) {
    const usageWhere = args.userId
      ? { userId_periodType_periodKey: { userId: args.userId, periodType, periodKey } }
      : { guestIdentityHash_periodType_periodKey: { guestIdentityHash: args.guestIdentityHash!, periodType, periodKey } };
    await tx.freePrintUsage.upsert({ where: usageWhere, create: { userId: args.userId || null, guestIdentityHash: args.guestIdentityHash || null, periodType, periodKey }, update: {} });
    const pageLimit = periodType === 'DAY' ? dailyPageLimit : monthlyPageLimit;
    const copyLimit = periodType === 'DAY' ? dailyCopyLimit : monthlyCopyLimit;
    const changed = args.userId ? await tx.$executeRaw`
      UPDATE "FreePrintUsage"
      SET "reservedPages" = "reservedPages" + ${args.pages},
          "reservedCopies" = "reservedCopies" + ${args.copies},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${args.userId} AND "periodType" = ${periodType} AND "periodKey" = ${periodKey}
        AND "reservedPages" + "completedPages" + ${args.pages} <= ${pageLimit}
        AND "reservedCopies" + "completedCopies" + ${args.copies} <= ${copyLimit}` : await tx.$executeRaw`
      UPDATE "FreePrintUsage"
      SET "reservedPages" = "reservedPages" + ${args.pages},
          "reservedCopies" = "reservedCopies" + ${args.copies},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "guestIdentityHash" = ${args.guestIdentityHash} AND "periodType" = ${periodType} AND "periodKey" = ${periodKey}
        AND "reservedPages" + "completedPages" + ${args.pages} <= ${pageLimit}
        AND "reservedCopies" + "completedCopies" + ${args.copies} <= ${copyLimit}`;
    if (Number(changed) !== 1) throw new FreePrintEligibilityError(`Your ${periodType === 'DAY' ? 'daily' : 'monthly'} free-print allowance is insufficient.`, `${periodType}_LIMIT_EXCEEDED`);
  }
  return tx.freePrintReservation.create({
    data: {
      orderId: args.orderId, userId: args.userId || null, guestIdentityHash: args.guestIdentityHash || null, guestVerificationId: args.guestVerificationId || null, pages: args.pages, copies: args.copies,
      dayKey: args.dayKey, monthKey: args.monthKey, policySnapshot: JSON.stringify(policySnapshot),
    },
  });
}

export async function reconcileFreePrintReservation(orderId: string, outcome: 'COMPLETED' | 'RELEASED') {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.freePrintReservation.findUnique({ where: { orderId } });
    if (!reservation || reservation.status !== 'RESERVED') return false;
    const claimed = await tx.freePrintReservation.updateMany({ where: { id: reservation.id, status: 'RESERVED' }, data: { status: outcome, completedAt: outcome === 'COMPLETED' ? new Date() : null, releasedAt: outcome === 'RELEASED' ? new Date() : null } });
    if (!claimed.count) return false;
    for (const periodKey of [reservation.dayKey, reservation.monthKey]) {
      const periodType = periodKey.length === 10 ? 'DAY' : 'MONTH';
      await tx.freePrintUsage.update({
        where: reservation.userId
          ? { userId_periodType_periodKey: { userId: reservation.userId, periodType, periodKey } }
          : { guestIdentityHash_periodType_periodKey: { guestIdentityHash: reservation.guestIdentityHash!, periodType, periodKey } },
        data: outcome === 'COMPLETED'
          ? { reservedPages: { decrement: reservation.pages }, completedPages: { increment: reservation.pages }, reservedCopies: { decrement: reservation.copies }, completedCopies: { increment: reservation.copies } }
          : { reservedPages: { decrement: reservation.pages }, reservedCopies: { decrement: reservation.copies } },
      });
    }
    return true;
  });
}
