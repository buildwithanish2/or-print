import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../prisma';
import { InstitutionPricingRuleSchema } from '@printqr/validation';
import { isInstitutionPricingTableUnavailable } from '../services/pricing.service';
import { canShopOwnerReviewGuestId, getFreePrintEligibility, getGuestFreePrintEligibility, getGuestVerificationByToken, hashCollegeIdNumber, hashGuestAccessToken, isFreePrintPolicyActive, kolkataPeriodKeys } from '../services/free-print.service';

const evidenceDir = path.resolve(process.env.COLLEGE_EVIDENCE_DIR || path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'), '..', 'private-college-evidence'));
export const collegeEvidenceUpload = multer({
  storage: multer.memoryStorage(), limits: { files: 1, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)),
});

export class FreePrintController {
  static async options(req: Request, res: Response, next: NextFunction) {
    try {
      const shop = await prisma.shop.findUnique({ where: { slug: req.params.shopSlug }, select: { id: true } });
      if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
      const policy = await prisma.freePrintPolicy.findUnique({ where: { id: 'global' } });
      const now = new Date();
      const globalEnabled = isFreePrintPolicyActive(policy, now);
      const participating = Boolean((await prisma.freePrintShopSetting.findUnique({ where: { shopId: shop.id } }))?.participating);
      const institutions = await prisma.institution.findMany({ where: { isActive: true, isEligible: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
      let verification: any = null;
      let allowance: any = null;
      if (req.user) {
        const record = await prisma.institutionVerification.findUnique({ where: { userId: req.user.id }, include: { institution: { select: { name: true } } } });
        verification = record ? { status: record.status, requestedRole: record.requestedRole, role: req.user.role, institutionName: record.institution.name, rejectionReason: record.rejectionReason } : null;
        if (record?.active && record.status === 'APPROVED' && ['STUDENT', 'TEACHER'].includes(req.user.role)) {
          try {
            const eligibility = await getFreePrintEligibility(req.user.id, shop.id, []);
            allowance = {
              role: eligibility.role, institutionName: eligibility.institution.name,
              remainingDailyPages: eligibility.remainingDailyPages,
              remainingMonthlyPages: eligibility.remainingMonthlyPages,
              remainingDailyCopies: eligibility.remainingDailyCopies,
              remainingMonthlyCopies: eligibility.remainingMonthlyCopies,
            };
          } catch {
            allowance = null;
          }
        }
      }
      const guestToken = String(req.get('X-Free-Print-Token') || '');
      const guest = guestToken ? await getGuestVerificationByToken(guestToken) : null;
      let guestVerification: any = guest && guest.shopId === shop.id ? { status: guest.status, requestedRole: guest.requestedRole, rejectionReason: guest.rejectionReason, active: guest.active } : null;
      if (guest?.shopId === shop.id && guest.status === 'APPROVED' && guest.active) {
        try {
          const eligibility = await getGuestFreePrintEligibility(guestToken, shop.id, []);
          allowance = { role: eligibility.role, institutionName: eligibility.institution.name, remainingDailyPages: eligibility.remainingDailyPages, remainingMonthlyPages: eligibility.remainingMonthlyPages, remainingDailyCopies: eligibility.remainingDailyCopies, remainingMonthlyCopies: eligibility.remainingMonthlyCopies };
        } catch { allowance = null; }
      }
      return res.json({ success: true, data: { enabled: Boolean(globalEnabled && participating), globalEnabled, participating, allowBlackWhite: Boolean(policy?.allowBlackWhite), allowColor: Boolean(policy?.allowColor), institutions, verification, guestVerification, allowance } });
    } catch (err) { next(err); }
  }

  static async submitGuestVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const requestedRole = String(req.body.requestedRole || '').toUpperCase();
      const institutionId = String(req.body.institutionId || '');
      const shopSlug = String(req.body.shopSlug || '').trim().toLowerCase();
      if (!['STUDENT', 'TEACHER'].includes(requestedRole)) return res.status(400).json({ success: false, message: 'Choose Student or Teacher' });
      if (!req.file || !['image/jpeg', 'image/png'].includes(req.file.mimetype)) return res.status(400).json({ success: false, message: 'Take or choose a clear college ID photo (JPG or PNG, up to 5 MB)' });
      const file = req.file;
      const signatureValid = file.mimetype === 'image/jpeg'
        ? file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        : file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      if (!signatureValid) return res.status(400).json({ success: false, message: 'The photo contents do not match the selected image type' });
      const [shop, institution, policy] = await Promise.all([
        prisma.shop.findUnique({ where: { slug: shopSlug }, select: { id: true, status: true } }),
        prisma.institution.findFirst({ where: { id: institutionId, isActive: true, isEligible: true } }),
        prisma.freePrintPolicy.findUnique({ where: { id: 'global' } }),
      ]);
      if (!shop || shop.status !== 'ACTIVE') return res.status(404).json({ success: false, message: 'This print shop is not available' });
      if (!institution) return res.status(400).json({ success: false, message: 'Choose an eligible active institution' });
      const participating = await prisma.freePrintShopSetting.findUnique({ where: { shopId: shop.id } });
      const policyActive = isFreePrintPolicyActive(policy);
      if (!policyActive || !participating?.participating) return res.status(409).json({ success: false, message: 'College free printing is not currently available at this shop' });
      const token = crypto.randomBytes(32).toString('base64url');
      const accessTokenHash = hashGuestAccessToken(token);
      const evidenceStorageKey = `${crypto.randomBytes(24).toString('hex')}${path.extname(file.originalname).toLowerCase()}`;
      await fs.mkdir(evidenceDir, { recursive: true, mode: 0o700 });
      await fs.writeFile(path.join(evidenceDir, evidenceStorageKey), file.buffer, { mode: 0o600, flag: 'wx' });
      try {
        const record = await prisma.$transaction(async (tx) => {
          const created = await tx.guestInstitutionVerification.create({ data: { shopId: shop.id, institutionId, requestedRole, applicantName: 'College ID applicant', status: 'PENDING', evidenceStorageKey, evidenceMimeType: file.mimetype, evidenceSizeBytes: file.size, accessTokenHash } });
          await tx.guestInstitutionVerificationEvent.create({ data: { verificationId: created.id, action: 'SUBMITTED' } });
          return created;
        });
        return res.status(201).json({ success: true, data: { status: record.status, accessToken: token }, message: 'ID photo sent to the shop for review. You can continue with paid printing while you wait.' });
      } catch (error) {
        await fs.rm(path.join(evidenceDir, evidenceStorageKey), { force: true });
        throw error;
      }
    } catch (err) { next(err); }
  }

  static async guestVerificationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const verification = await getGuestVerificationByToken(String(req.get('X-Free-Print-Token') || ''));
      if (!verification) return res.status(404).json({ success: false, message: 'Verification request not found' });
      return res.json({ success: true, data: { status: verification.status, requestedRole: verification.requestedRole, rejectionReason: verification.rejectionReason, active: verification.active } });
    } catch (err) { next(err); }
  }

  static async shopVerificationQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId;
      if (req.user?.role !== 'SHOP_OWNER' || !shopId) return res.status(403).json({ success: false, message: 'Only this shop owner can review ID photos' });
      const verifications = await prisma.guestInstitutionVerification.findMany({ where: { shopId, status: 'PENDING' }, include: { institution: { select: { name: true } } }, orderBy: { submittedAt: 'asc' }, take: 100 });
      return res.json({ success: true, data: verifications.map(({ evidenceStorageKey: _key, accessTokenHash: _token, identityHash: _identity, ...item }) => item) });
    } catch (err) { next(err); }
  }

  static async shopVerificationEvidence(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId;
      if (req.user?.role !== 'SHOP_OWNER' || !shopId) return res.status(403).json({ success: false, message: 'Only this shop owner can review ID photos' });
      const record = await prisma.guestInstitutionVerification.findFirst({ where: { id: req.params.id, shopId } });
      if (!record) return res.status(404).json({ success: false, message: 'ID photo request was not found for this shop' });
      if (!canShopOwnerReviewGuestId(req.user?.role || '', shopId, record.shopId)) return res.status(403).json({ success: false, message: 'Only the owner of this shop can review its ID photos' });
      if (!record.evidenceStorageKey) return res.status(410).json({ success: false, message: 'ID photo was deleted after review' });
      res.setHeader('Content-Type', record.evidenceMimeType);
      res.setHeader('Content-Disposition', 'inline; filename="college-id-photo"');
      res.setHeader('Cache-Control', 'no-store');
      return res.sendFile(path.join(evidenceDir, path.basename(record.evidenceStorageKey)));
    } catch (err) { next(err); }
  }

  static async reviewGuestVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId;
      if (req.user?.role !== 'SHOP_OWNER' || !shopId) return res.status(403).json({ success: false, message: 'Only this shop owner can approve ID photos' });
      const action = String(req.body.action || '').toUpperCase();
      if (!['APPROVE', 'REJECT'].includes(action)) return res.status(400).json({ success: false, message: 'Choose approve or reject' });
      const record = await prisma.guestInstitutionVerification.findFirst({ where: { id: req.params.id, shopId } });
      if (!record || record.status !== 'PENDING') return res.status(404).json({ success: false, message: 'Pending ID photo request not found for this shop' });
      if (!canShopOwnerReviewGuestId(req.user?.role || '', shopId, record.shopId)) return res.status(403).json({ success: false, message: 'Only the owner of this shop can approve its ID photos' });
      const reason = String(req.body.reason || '').trim().slice(0, 500);
      if (action === 'REJECT' && reason.length < 4) return res.status(400).json({ success: false, message: 'Enter a short reason for rejecting this request' });
      let identityHash: string | null = null;
      if (action === 'APPROVE') {
        const idNumber = String(req.body.idNumber || '').trim().toUpperCase();
        if (idNumber.replace(/[\s-]/g, '').length < 3 || idNumber.length > 64 || !/^[A-Z0-9\s/-]+$/.test(idNumber)) return res.status(400).json({ success: false, message: 'Enter the ID number shown on the photo to prevent duplicate approvals' });
        identityHash = hashCollegeIdNumber(record.institutionId, idNumber);
        const duplicate = await prisma.guestInstitutionVerification.findFirst({ where: { identityHash, active: true } });
        if (duplicate && duplicate.shopId === shopId) return res.status(409).json({ success: false, message: 'This college ID is already approved at this shop' });
        if (duplicate && duplicate.requestedRole !== record.requestedRole) return res.status(409).json({ success: false, message: 'This college ID is already verified with a different role' });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const saved = await tx.guestInstitutionVerification.update({ where: { id: record.id }, data: { status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED', active: action === 'APPROVE', identityHash, reviewedByUserId: req.user!.id, reviewerShopId: shopId, reviewedAt: new Date(), rejectionReason: action === 'REJECT' ? reason : null, evidenceStorageKey: '' } });
        await tx.guestInstitutionVerificationEvent.create({ data: { verificationId: record.id, actorUserId: req.user!.id, action, reason: action === 'REJECT' ? reason : null } });
        await tx.freePrintPolicyAudit.create({ data: { actorUserId: req.user!.id, scope: 'GUEST_VERIFICATION', scopeId: record.id, action: `SHOP_${action}` } });
        return saved;
      });
      await fs.rm(path.join(evidenceDir, path.basename(record.evidenceStorageKey)), { force: true }).catch(() => undefined);
      return res.json({ success: true, data: { id: updated.id, status: updated.status, active: updated.active }, message: action === 'APPROVE' ? 'ID verified. This person can now use the approved free-print allowance.' : 'Request rejected.' });
    } catch (err: any) {
      if (err?.code === 'P2002') return res.status(409).json({ success: false, message: 'This college ID is already approved at this shop' });
      next(err);
    }
  }

  static async status(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await prisma.institutionVerification.findUnique({ where: { userId: req.user!.id }, include: { institution: { select: { name: true } }, history: { orderBy: { createdAt: 'desc' } } } });
      return res.json({ success: true, data: record ? { id: record.id, institutionName: record.institution.name, requestedRole: record.requestedRole, status: record.status, rejectionReason: record.rejectionReason, active: record.active, submittedAt: record.submittedAt, reviewedAt: record.reviewedAt, history: record.history.map(({ action, reason, createdAt }) => ({ action, reason, createdAt })) } : null });
    } catch (err) { next(err); }
  }

  static async submitVerification(req: Request, res: Response, next: NextFunction) {
    try {
      if (!['CUSTOMER', 'STUDENT', 'TEACHER'].includes(req.user!.role)) return res.status(403).json({ success: false, message: 'Only customer accounts may request student or teacher verification' });
      const requestedRole = String(req.body.requestedRole || '').toUpperCase();
      const institutionId = String(req.body.institutionId || '');
      if (!['STUDENT', 'TEACHER'].includes(requestedRole)) return res.status(400).json({ success: false, message: 'Choose Student or Teacher' });
      if (!req.file) return res.status(400).json({ success: false, message: 'Attach an institution identity document (PDF, JPG, or PNG, up to 5 MB)' });
      const file = req.file;
      const validSignature = file.mimetype === 'application/pdf' ? file.buffer.subarray(0, 5).toString() === '%PDF-'
        : file.mimetype === 'image/jpeg' ? file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
          : file.mimetype === 'image/png' && file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      if (!validSignature) return res.status(400).json({ success: false, message: 'The evidence contents do not match the selected file type' });
      const institution = await prisma.institution.findFirst({ where: { id: institutionId, isActive: true, isEligible: true } });
      if (!institution) return res.status(400).json({ success: false, message: 'Choose an eligible active institution' });
      const existing = await prisma.institutionVerification.findUnique({ where: { userId: req.user!.id } });
      if (existing?.status === 'PENDING' || existing?.status === 'APPROVED' && existing.active) return res.status(409).json({ success: false, message: 'A pending or active verification already exists' });
      const oldEvidenceStorageKey = existing?.evidenceStorageKey;

      const evidenceStorageKey = `${crypto.randomBytes(24).toString('hex')}${path.extname(file.originalname).toLowerCase()}`;
      await fs.mkdir(evidenceDir, { recursive: true, mode: 0o700 });
      await fs.writeFile(path.join(evidenceDir, evidenceStorageKey), file.buffer, { mode: 0o600, flag: 'wx' });
      try {
        const record = await prisma.$transaction(async (tx) => {
          const data = { institutionId, requestedRole, status: 'PENDING', evidenceStorageKey, evidenceMimeType: file.mimetype, evidenceSizeBytes: file.size, submittedAt: new Date(), reviewedByUserId: null, reviewedAt: null, rejectionReason: null, active: false };
          const result = existing
            ? await tx.institutionVerification.update({ where: { id: existing.id }, data })
            : await tx.institutionVerification.create({ data: { ...data, userId: req.user!.id } });
          await tx.institutionVerificationEvent.create({ data: { verificationId: result.id, actorUserId: req.user!.id, action: 'SUBMITTED' } });
          return result;
        });
        if (oldEvidenceStorageKey) await fs.rm(path.join(evidenceDir, path.basename(oldEvidenceStorageKey)), { force: true }).catch(() => undefined);
        return res.status(201).json({ success: true, message: 'Verification submitted for administrator review', data: { id: record.id, status: record.status } });
      } catch (error) {
        await fs.rm(path.join(evidenceDir, evidenceStorageKey), { force: true });
        throw error;
      }
    } catch (err) { next(err); }
  }

  static async getEvidence(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await prisma.institutionVerification.findUnique({ where: { id: req.params.id } });
      if (!record) return res.status(404).json({ success: false, message: 'Evidence not found' });
      const reviewer = ['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role);
      if (!reviewer) return res.status(403).json({ success: false, message: 'Only authorized administrators may review identity evidence' });
      if (!record.evidenceStorageKey) return res.status(410).json({ success: false, message: 'Identity evidence was securely deleted after the verification decision' });
      const evidencePath = path.join(evidenceDir, path.basename(record.evidenceStorageKey));
      res.setHeader('Content-Type', record.evidenceMimeType);
      res.setHeader('Content-Disposition', 'attachment; filename="institution-evidence"');
      res.setHeader('Cache-Control', 'no-store');
      return res.sendFile(evidencePath);
    } catch (err) { next(err); }
  }

  static async adminGet(req: Request, res: Response, next: NextFunction) {
    try {
      let collegePricingAvailable = true;
      const institutionQuery = prisma.institution.findMany({ include: { pricingRules: { orderBy: [{ paperSize: 'asc' }, { colorMode: 'asc' }] } }, orderBy: { name: 'asc' } })
        .catch(async (error) => {
          if (!isInstitutionPricingTableUnavailable(error)) throw error;
          collegePricingAvailable = false;
          return prisma.institution.findMany({ orderBy: { name: 'asc' } });
        });
      const [policy, institutions, verifications, shops, audits, usage] = await Promise.all([
        prisma.freePrintPolicy.findUnique({ where: { id: 'global' } }),
        institutionQuery,
        prisma.institutionVerification.findMany({ where: { status: { in: ['PENDING', 'APPROVED'] } }, include: { user: { select: { id: true, name: true, email: true } }, institution: { select: { id: true, name: true } } }, orderBy: { submittedAt: 'asc' }, take: 200 }),
        prisma.shop.findMany({ select: { id: true, name: true, slug: true, freePrintSettings: true }, orderBy: { name: 'asc' } }),
        prisma.freePrintPolicyAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
        prisma.freePrintUsage.findMany({ orderBy: { updatedAt: 'desc' }, take: 200, include: { user: { select: { name: true, email: true, role: true } } } }),
      ]);
      return res.json({ success: true, data: { policy, institutions, collegePricingAvailable, verifications: verifications.map(({ evidenceStorageKey: _key, ...v }) => v), shops, audits, usage } });
    } catch (err) { next(err); }
  }

  static async updatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body || {};
      const bools = ['enabled', 'allowBlackWhite', 'allowColor'];
      const limits = ['studentDailyPages', 'studentMonthlyPages', 'teacherDailyPages', 'teacherMonthlyPages', 'studentDailyCopies', 'studentMonthlyCopies', 'teacherDailyCopies', 'teacherMonthlyCopies'];
      for (const key of bools) if (typeof body[key] !== 'boolean') return res.status(400).json({ success: false, message: `${key} must be a boolean` });
      for (const key of limits) if (!Number.isSafeInteger(body[key]) || body[key] < 0 || body[key] > 100000) return res.status(400).json({ success: false, message: `${key} must be an integer from 0 to 100000` });
      const before = await prisma.freePrintPolicy.findUnique({ where: { id: 'global' } });
      const startsAt = body.startsAt ? new Date(body.startsAt) : null;
      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      if ((startsAt && !Number.isFinite(startsAt.getTime())) || (expiresAt && !Number.isFinite(expiresAt.getTime())) || (startsAt && expiresAt && expiresAt <= startsAt)) return res.status(400).json({ success: false, message: 'Policy dates must be valid and expiration must be after the start date' });
      const policy = await prisma.$transaction(async (tx) => {
        const saved = await tx.freePrintPolicy.upsert({ where: { id: 'global' }, create: { id: 'global', ...Object.fromEntries([...bools, ...limits].map((k) => [k, body[k]])), updatedByUserId: req.user!.id, startsAt, expiresAt }, update: { ...Object.fromEntries([...bools, ...limits].map((k) => [k, body[k]])), updatedByUserId: req.user!.id, startsAt, expiresAt } });
        await tx.freePrintPolicyAudit.create({ data: { actorUserId: req.user!.id, scope: 'GLOBAL_POLICY', action: 'UPDATED', beforeJson: JSON.stringify(before), afterJson: JSON.stringify(saved) } });
        return saved;
      });
      return res.json({ success: true, data: policy });
    } catch (err) { next(err); }
  }

  static async saveInstitution(req: Request, res: Response, next: NextFunction) {
    try {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (name.length < 2 || name.length > 160) return res.status(400).json({ success: false, message: 'Institution name must be between 2 and 160 characters' });
      const id = typeof req.body.id === 'string' ? req.body.id : undefined;
      const data = { name, domain: typeof req.body.domain === 'string' ? req.body.domain.trim().toLowerCase() || null : null, isEligible: Boolean(req.body.isEligible), isActive: Boolean(req.body.isActive) };
      const record = await prisma.$transaction(async (tx) => {
        const saved = id ? await tx.institution.update({ where: { id }, data }) : await tx.institution.create({ data });
        await tx.freePrintPolicyAudit.create({ data: { actorUserId: req.user!.id, scope: 'INSTITUTION', scopeId: saved.id, action: id ? 'UPDATED' : 'CREATED', afterJson: JSON.stringify(data) } });
        return saved;
      });
      return res.json({ success: true, data: record });
    } catch (err) { next(err); }
  }

  static async saveInstitutionPricing(req: Request, res: Response, next: NextFunction) {
    try {
      const data = InstitutionPricingRuleSchema.parse(req.body);
      const institutionId = String(req.params.id || '');
      const institution = await prisma.institution.findUnique({ where: { id: institutionId }, select: { id: true, name: true } });
      if (!institution) return res.status(404).json({ success: false, message: 'Institution not found' });

      const uniqueKey = { institutionId_paperSize_colorMode: { institutionId, paperSize: data.paperSize, colorMode: data.colorMode } };
      const saved = await prisma.$transaction(async (tx) => {
        const before = await tx.institutionPricingRule.findUnique({ where: uniqueKey });
        const rule = await tx.institutionPricingRule.upsert({
          where: uniqueKey,
          create: { institutionId, ...data },
          update: { ...data },
        });
        await tx.freePrintPolicyAudit.create({ data: {
          actorUserId: req.user!.id,
          scope: 'INSTITUTION_PRICING',
          scopeId: institutionId,
          action: before ? 'UPDATED' : 'CREATED',
          beforeJson: before ? JSON.stringify(before) : null,
          afterJson: JSON.stringify(rule),
        } });
        return rule;
      });
      return res.json({ success: true, data: { institution, rule: saved } });
    } catch (err) {
      if (isInstitutionPricingTableUnavailable(err)) return res.status(503).json({ success: false, message: 'College pricing storage is not ready. Apply the additive pricing migration, then retry.' });
      next(err);
    }
  }

  static async reviewVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const action = String(req.body.action || '').toUpperCase();
      if (!['APPROVE', 'REJECT', 'REVOKE'].includes(action)) return res.status(400).json({ success: false, message: 'Action must be APPROVE, REJECT, or REVOKE' });
      const record = await prisma.institutionVerification.findUnique({ where: { id: req.params.id }, include: { user: true } });
      if (!record) return res.status(404).json({ success: false, message: 'Verification not found' });
      if (action === 'REJECT' && String(req.body.reason || '').trim().length < 4) return res.status(400).json({ success: false, message: 'Provide a rejection reason' });
      const updated = await prisma.$transaction(async (tx) => {
        const verification = await tx.institutionVerification.update({ where: { id: record.id }, data: { status: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'REVOKED', active: action === 'APPROVE', reviewedByUserId: req.user!.id, reviewedAt: new Date(), rejectionReason: action === 'REJECT' ? String(req.body.reason).trim().slice(0, 500) : null, evidenceStorageKey: '' } });
        await tx.institutionVerificationEvent.create({ data: { verificationId: record.id, actorUserId: req.user!.id, action, reason: action === 'REJECT' || action === 'REVOKE' ? String(req.body.reason || '').trim().slice(0, 500) || null : null } });
        if (action === 'APPROVE') await tx.user.update({ where: { id: record.userId }, data: { role: record.requestedRole } });
        else if (record.user.role === 'STUDENT' || record.user.role === 'TEACHER') await tx.user.update({ where: { id: record.userId }, data: { role: 'CUSTOMER' } });
        return verification;
      });
      if (record.evidenceStorageKey) await fs.rm(path.join(evidenceDir, path.basename(record.evidenceStorageKey)), { force: true }).catch(() => undefined);
      return res.json({ success: true, data: { id: updated.id, status: updated.status, active: updated.active } });
    } catch (err) { next(err); }
  }

  static async shopStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId || (await prisma.shop.findFirst({ where: { ownerId: req.user!.id }, select: { id: true } }))?.id;
      if (!shopId) return res.status(403).json({ success: false, message: 'Shop access required' });
      const { dayKey, monthKey } = kolkataPeriodKeys();
      const monthStart = new Date(`${monthKey}-01T00:00:00+05:30`);
      const dayStart = new Date(`${dayKey}T00:00:00+05:30`);
      const [setting, policy, shop, queuedJobs, completedJobs, requestedToday, requestedMonth, completedMonth, jobStatuses] = await Promise.all([
        prisma.freePrintShopSetting.findUnique({ where: { shopId } }),
        prisma.freePrintPolicy.findUnique({ where: { id: 'global' } }),
        prisma.shop.findUnique({ where: { id: shopId }, include: { printers: { where: { status: 'ONLINE' } } } }),
        prisma.printJob.count({ where: { shopId, order: { freePrintReservation: { isNot: null } }, status: 'QUEUED' } }),
        prisma.printJob.count({ where: { shopId, order: { freePrintReservation: { isNot: null } }, status: 'COMPLETED', completedAt: { gte: monthStart } } }),
        prisma.order.aggregate({ where: { shopId, createdAt: { gte: dayStart }, freePrintReservation: { isNot: null } }, _sum: { totalPages: true } }),
        prisma.order.aggregate({ where: { shopId, createdAt: { gte: monthStart }, freePrintReservation: { isNot: null } }, _sum: { totalPages: true } }),
        prisma.order.aggregate({ where: { shopId, createdAt: { gte: monthStart }, printStatus: 'COMPLETED', freePrintReservation: { isNot: null } }, _sum: { totalPages: true } }),
        prisma.printJob.groupBy({ by: ['status'], where: { shopId, order: { freePrintReservation: { isNot: null } } }, _count: { _all: true } }),
      ]);
      return res.json({ success: true, data: { globalEnabled: Boolean(policy?.enabled), participating: Boolean(setting?.participating), policy, printers: shop?.printers, queuedJobs, completedJobs, jobStatuses: Object.fromEntries(jobStatuses.map((entry) => [entry.status, entry._count._all])), requestedImpressionsToday: requestedToday._sum.totalPages || 0, requestedImpressionsMonth: requestedMonth._sum.totalPages || 0, agentCompletedImpressionsMonth: completedMonth._sum.totalPages || 0 } });
    } catch (err) { next(err); }
  }

  static async setShopParticipation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!['SHOP_OWNER', 'SUPER_ADMIN', 'ADMIN'].includes(req.user!.role)) return res.status(403).json({ success: false, message: 'Only the shop owner or an administrator can change participation' });
      if (typeof req.body.participating !== 'boolean') return res.status(400).json({ success: false, message: 'participating must be a boolean' });
      const shopId = req.user?.shopId || (await prisma.shop.findFirst({ where: { ownerId: req.user!.id }, select: { id: true } }))?.id;
      if (!shopId) return res.status(403).json({ success: false, message: 'Shop access required' });
      const setting = await prisma.$transaction(async (tx) => {
        const saved = await tx.freePrintShopSetting.upsert({ where: { shopId }, create: { shopId, participating: req.body.participating, updatedByUserId: req.user!.id }, update: { participating: req.body.participating, updatedByUserId: req.user!.id } });
        await tx.freePrintPolicyAudit.create({ data: { actorUserId: req.user!.id, scope: 'SHOP', scopeId: shopId, action: saved.participating ? 'PARTICIPATION_ENABLED' : 'PARTICIPATION_DISABLED' } });
        return saved;
      });
      return res.json({ success: true, data: setting });
    } catch (err) { next(err); }
  }

  static async adminSetShopParticipation(req: Request, res: Response, next: NextFunction) {
    try {
      if (typeof req.body.participating !== 'boolean') return res.status(400).json({ success: false, message: 'participating must be a boolean' });
      const shop = await prisma.shop.findUnique({ where: { id: req.params.shopId }, select: { id: true } });
      if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
      const setting = await prisma.$transaction(async (tx) => {
        const saved = await tx.freePrintShopSetting.upsert({ where: { shopId: shop.id }, create: { shopId: shop.id, participating: req.body.participating, updatedByUserId: req.user!.id }, update: { participating: req.body.participating, updatedByUserId: req.user!.id } });
        await tx.freePrintPolicyAudit.create({ data: { actorUserId: req.user!.id, scope: 'SHOP', scopeId: shop.id, action: saved.participating ? 'ADMIN_PARTICIPATION_ENABLED' : 'ADMIN_PARTICIPATION_DISABLED' } });
        return saved;
      });
      return res.json({ success: true, data: setting });
    } catch (err) { next(err); }
  }
}
