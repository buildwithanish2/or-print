import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { FreePrintController, collegeEvidenceUpload } from '../controllers/free-print.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireAdmin, requireShopAccess } from '../middleware/rbac.middleware';

const router = Router();
const applyLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false });
const guestApplyLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, standardHeaders: true, legacyHeaders: false });
const guestStatusLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.get('/options/:shopSlug', optionalAuthenticate, FreePrintController.options);
router.get('/verification/status', authenticate, FreePrintController.status);
router.post('/verification', authenticate, applyLimiter, collegeEvidenceUpload.single('evidence'), FreePrintController.submitVerification);
router.post('/guest-verification', guestApplyLimiter, collegeEvidenceUpload.single('evidence'), FreePrintController.submitGuestVerification);
router.get('/guest-verification/status', guestStatusLimiter, FreePrintController.guestVerificationStatus);
router.get('/verification/:id/evidence', authenticate, requireAdmin, FreePrintController.getEvidence);

router.get('/admin', authenticate, requireAdmin, FreePrintController.adminGet);
router.put('/admin/policy', authenticate, requireAdmin, FreePrintController.updatePolicy);
router.post('/admin/institutions', authenticate, requireAdmin, FreePrintController.saveInstitution);
router.put('/admin/institutions/:id', authenticate, requireAdmin, FreePrintController.saveInstitution);
router.put('/admin/institutions/:id/pricing', authenticate, requireAdmin, FreePrintController.saveInstitutionPricing);
router.put('/admin/shops/:shopId', authenticate, requireAdmin, FreePrintController.adminSetShopParticipation);
router.patch('/admin/verifications/:id', authenticate, requireAdmin, FreePrintController.reviewVerification);

router.get('/shop', authenticate, requireShopAccess, FreePrintController.shopStatus);
router.put('/shop/participation', authenticate, requireShopAccess, FreePrintController.setShopParticipation);
router.get('/shop/verifications', authenticate, requireShopAccess, FreePrintController.shopVerificationQueue);
router.get('/shop/verifications/:id/evidence', authenticate, requireShopAccess, FreePrintController.shopVerificationEvidence);
router.patch('/shop/verifications/:id', authenticate, requireShopAccess, FreePrintController.reviewGuestVerification);

export default router;
