import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();
const limiterMessage = { success: false, code: 'RATE_LIMITED', message: 'Too many attempts. Please wait before trying again.' };
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: limiterMessage });
const registrationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: limiterMessage });
const refreshLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: limiterMessage });
const recoveryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests. Try again later.' } });

router.post('/login', loginLimiter, AuthController.login);
router.post('/register', registrationLimiter, AuthController.register);
router.post('/refresh', refreshLimiter, AuthController.refreshToken);
router.post('/forgot-password', recoveryLimiter, AuthController.forgotPassword);
router.post('/reset-password', recoveryLimiter, AuthController.resetPassword);
router.post('/verify-email', recoveryLimiter, AuthController.verifyEmail);
router.post('/resend-verification', recoveryLimiter, AuthController.resendVerification);
router.get('/me', authenticate, AuthController.getMe);

export default router;
