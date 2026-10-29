import { Router } from 'express';
import multer from 'multer';
import { FileController } from '../controllers/file.controller';
import { SUPPORTED_MIME_TYPES, APP_CONFIG } from '@printqr/config';
import rateLimit from 'express-rate-limit';
import { optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: APP_CONFIG.MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!Object.prototype.hasOwnProperty.call(SUPPORTED_MIME_TYPES, file.mimetype)) {
      callback(null, false);
      return;
    }
    callback(null, true);
  },
});

router.post('/upload', optionalAuthenticate, uploadLimiter, upload.single('file'), FileController.uploadFile);
router.get('/download/:key', FileController.downloadFile);
router.get('/:id', FileController.getFileById);

export default router;
