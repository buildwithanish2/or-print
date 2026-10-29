import { Router } from 'express';
import { PrinterController } from '../controllers/printer.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireShopAccess } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate, requireShopAccess);

router.get('/', PrinterController.listPrinters);
router.post('/', PrinterController.addPrinter);
router.patch('/:printerId', PrinterController.updatePrinter);
router.post('/:printerId/test-print', PrinterController.triggerTestPrint);
router.delete('/:printerId', PrinterController.deletePrinter);

export default router;
