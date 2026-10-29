import { Router } from 'express';
import { LegalController } from '../controllers/legal.controller';

const router = Router();

// Public routes
router.get('/list/published', LegalController.getPublishedList);
router.get('/:slug', LegalController.getPublishedPageBySlug);

export default router;
