import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireShopAccess } from '../middleware/rbac.middleware';

const router = Router();

// Customer
router.post('/create', optionalAuthenticate, OrderController.createOrder);
router.get('/track/:orderNumber', OrderController.getOrderByNumber);

// Shop / Staff Portal
router.get('/', authenticate, requireShopAccess, OrderController.getShopOrders);
router.post('/:orderId/mark-paid', authenticate, requireShopAccess, OrderController.markOrderAsPaid);
router.post('/jobs/:jobId/retry', authenticate, requireShopAccess, OrderController.retryPrintJob);

export default router;
