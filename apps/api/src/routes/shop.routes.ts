import { Router } from 'express';
import { ShopController } from '../controllers/shop.controller';
import { StaffController } from '../controllers/staff.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireShopAccess } from '../middleware/rbac.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();
const shopRegistrationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many shop registration attempts. Please try again later.' } });

// Authenticated Shop Portal (Must be defined before public param routes like /:slug)
router.get('/qr/me', authenticate, requireShopAccess, ShopController.getShopQR);
router.get('/metrics', authenticate, requireShopAccess, ShopController.getDashboardMetrics);
router.post('/agent/pairing-code', authenticate, requireShopAccess, ShopController.generatePairingCode);
router.post('/qr/regenerate', authenticate, requireShopAccess, ShopController.regenerateQRCode);
router.patch('/qr/toggle', authenticate, requireShopAccess, ShopController.toggleQRCodeStatus);
router.patch('/branding', authenticate, requireShopAccess, ShopController.updateShopBranding);

// Public Endpoints
router.get('/public/:slug', ShopController.getShopBySlug);
router.get('/qr/:slug', ShopController.getShopQR);
router.post('/register', shopRegistrationLimiter, ShopController.registerShop);
router.post('/:shopId/resend-welcome-email', authenticate, requireShopAccess, ShopController.resendWelcomeEmail);

// Shop Staff Management
router.get('/staff', authenticate, requireShopAccess, StaffController.listStaff);
router.post('/staff', authenticate, requireShopAccess, StaffController.addStaff);
router.patch('/staff/:staffId', authenticate, requireShopAccess, StaffController.updateStaff);
router.delete('/staff/:staffId', authenticate, requireShopAccess, StaffController.removeStaff);

export default router;
