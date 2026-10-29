import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireShopAccess, requireAdmin } from '../middleware/rbac.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();
const paymentActionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many payment attempts. Please wait and try again.' } });

// Public Payment Creation, Verification & Webhook Endpoints
router.post('/subscriptions/create', paymentActionLimiter, PaymentController.createSubscriptionPaymentOrder);
router.post('/create', paymentActionLimiter, PaymentController.createPaymentOrder);
router.get('/:orderNumber/status', PaymentController.getPaymentStatus);
router.get('/methods/:shopSlug', PaymentController.getShopPaymentMethods);
router.post('/verify', paymentActionLimiter, PaymentController.verifyOnlinePayment);
router.post('/upi/submit-proof', paymentActionLimiter, PaymentController.submitUpiProof);
router.post('/razorpay/webhook', PaymentController.handleRazorpayWebhook);
router.post('/cashfree/webhook', PaymentController.handleCashfreeWebhook);
router.post('/stripe/webhook', PaymentController.handleStripeWebhook);

// Shop Owner Payment Gateway Settings
router.get('/shop/gateways', authenticate, requireShopAccess, PaymentController.getShopGateways);
router.post('/shop/gateways', authenticate, requireShopAccess, PaymentController.updateShopGateway);
router.post('/shop/gateways/test', authenticate, requireShopAccess, PaymentController.testConnection);
router.post('/shop/gateways/test-upi', authenticate, requireShopAccess, PaymentController.testUpiVpa);
router.post('/shop/verify-upi', authenticate, requireShopAccess, PaymentController.verifyShopUpiPayment);

// Super Admin Platform Gateway Settings
router.get('/platform/gateways', authenticate, requireAdmin, PaymentController.getPlatformGateways);
router.post('/platform/gateways', authenticate, requireAdmin, PaymentController.updatePlatformGateway);

export default router;
