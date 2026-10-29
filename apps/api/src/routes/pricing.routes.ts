import { Router } from 'express';
import { PricingController } from '../controllers/pricing.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireShopAccess } from '../middleware/rbac.middleware';

const router = Router();

// Public calculation endpoint
router.post('/calculate', optionalAuthenticate, PricingController.calculatePrice);

// Shop Pricing Rules
router.get('/rules', authenticate, requireShopAccess, PricingController.getPricingRules);
router.post('/rules', authenticate, requireShopAccess, PricingController.savePricingRule);
router.post('/rules/reset', authenticate, requireShopAccess, PricingController.resetPricingRulesToDefault);

export default router;
