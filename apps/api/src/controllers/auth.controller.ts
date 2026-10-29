import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { LoginSchema } from '@printqr/validation';
import { JWT_SECRET, JWT_REFRESH_SECRET } from '../config/secrets';
import { EmailService } from '../services/email.service';
import crypto from 'crypto';
import { getCustomerWebUrl, getShopWebUrl } from '@printqr/config';

const digestActionToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const getShopPortalUrl = () => (process.env.SHOP_PORTAL_URL || process.env.APP_PUBLIC_URL || getShopWebUrl()).replace(/\/$/, '');

const issueActionToken = async (userId: string, purpose: 'EMAIL_VERIFY' | 'PASSWORD_RESET', tokenHash: string) => prisma.$transaction(async (tx) => {
  const previous = await tx.authActionToken.findFirst({ where: { userId, purpose }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
  if (previous && previous.createdAt.getTime() > Date.now() - 60_000) return false;
  await tx.authActionToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } });
  await tx.authActionToken.create({ data: { userId, purpose, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
  return true;
});

const getRecoveryPortalUrl = (role: string) => {
  if (['SHOP_OWNER', 'SHOP_STAFF'].includes(role)) return getShopPortalUrl();
  return getCustomerWebUrl().replace(/\/$/, '');
};

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = LoginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
        include: {
          ownedShops: true,
          staffMembers: { include: { shop: true } },
        },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      const isMatch = await bcrypt.compare(data.password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account has been deactivated. Please contact support.',
        });
      }

      if (user.emailVerificationRequired) {
        return res.status(403).json({ success: false, code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Verify your email before signing in.' });
      }

      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        sessionVersion: user.sessionVersion,
      };

      const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
      const refreshToken = jwt.sign(tokenPayload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

      // Identify associated shop
      let shop = null;
      if (user.ownedShops && user.ownedShops.length > 0) {
        shop = user.ownedShops[0];
      } else if (user.staffMembers && user.staffMembers.length > 0) {
        shop = user.staffMembers[0].shop;
      }

      // Log login activity
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_LOGIN',
          entity: 'User',
          entityId: user.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
          },
          shop,
          accessToken,
          refreshToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async register(_req: Request, res: Response, _next: NextFunction) {
    return res.status(403).json({
      success: false,
      code: 'PUBLIC_REGISTRATION_DISABLED',
      message: 'Public account registration is disabled. Shop owners can register through shop onboarding; existing customers can sign in at checkout.',
    });
  }

  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          ownedShops: true,
          staffMembers: { include: { shop: true } },
        },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      let shop = user.ownedShops?.[0] || user.staffMembers?.[0]?.shop || null;

      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
          },
          shop,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Refresh JWT Access Token using 7-day Refresh Token
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ success: false, message: 'Refresh token is required' });
      }

      try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });

        if (!user || !user.isActive) {
          return res.status(401).json({ success: false, message: 'User not found or inactive' });
        }

        if ((decoded.sessionVersion ?? 0) !== user.sessionVersion) {
          return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
        }
        const tokenPayload = { id: user.id, email: user.email, role: user.role, sessionVersion: user.sessionVersion };
        const newAccessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
        const newRefreshToken = jwt.sign(tokenPayload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

        return res.status(200).json({
          success: true,
          data: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          },
        });
      } catch {
        return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
      }
    } catch (err) {
      next(err);
    }
  }

  /**
   * Request Password Reset Link / PIN
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!EmailService.isConfigured()) return res.status(503).json({ success: false, code: 'PASSWORD_RECOVERY_UNAVAILABLE', message: 'Password recovery is temporarily unavailable.' });
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (email.length > 254) return res.status(200).json({ success: true, message: 'If an eligible account exists, recovery instructions will be sent.' });
      const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
      if (user && user.isActive) {
        const rawToken = crypto.randomBytes(32).toString('base64url');
        const tokenHash = digestActionToken(rawToken);
        const tokenIssued = await issueActionToken(user.id, 'PASSWORD_RESET', tokenHash);
        if (tokenIssued) {
          const link = `${getRecoveryPortalUrl(user.role)}/reset-password#token=${encodeURIComponent(rawToken)}`;
          try {
            const sent = await EmailService.sendActionLink(user.email, link, 'reset');
            if (!sent) throw new Error('Email delivery is not configured.');
          } catch {
            await prisma.authActionToken.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: new Date() } });
            console.warn('Password recovery email delivery failed.');
          }
        }
      }
      return res.status(200).json({ success: true, message: 'If an eligible account exists, recovery instructions will be sent.' });
    } catch (err) { next(err); }
  }

  /**
   * Reset Password with Reset Token
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!/^[A-Za-z0-9_-]{40,60}$/.test(token) || password.length < 12 || password.length > 128) {
        return res.status(400).json({ success: false, message: 'Provide a valid reset link and a password of 12–128 characters.' });
      }
      const tokenHash = digestActionToken(token);
      const passwordHash = await bcrypt.hash(password, 12);
      const result = await prisma.$transaction(async (tx) => {
        const action = await tx.authActionToken.findUnique({ where: { tokenHash } });
        if (!action || action.purpose !== 'PASSWORD_RESET' || action.usedAt || action.expiresAt <= new Date()) return false;
        const claimed = await tx.authActionToken.updateMany({ where: { id: action.id, purpose: 'PASSWORD_RESET', usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
        if (!claimed.count) return false;
        const user = await tx.user.update({ where: { id: action.userId }, data: { passwordHash, sessionVersion: { increment: 1 } }, select: { email: true, name: true } });
        await tx.authActionToken.updateMany({ where: { userId: action.userId, purpose: 'PASSWORD_RESET', usedAt: null }, data: { usedAt: new Date() } });
        return user;
      });
      if (!result) return res.status(400).json({ success: false, message: 'This reset link is invalid or expired.' });
      try {
        const sent = await EmailService.sendPasswordChangedNotice(result.email, result.name);
        if (!sent) console.warn('Password change notification email was not delivered because SMTP is unavailable.');
      } catch {
        console.warn('Password change notification email delivery failed.');
      }
      return res.status(200).json({ success: true, message: 'Password updated. Please sign in again.' });
    } catch (err) { next(err); }
  }

  static async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return res.status(400).json({ success: false, message: 'Verification link is invalid or expired.' });
      const tokenHash = digestActionToken(token);
      const success = await prisma.$transaction(async (tx) => {
        const action = await tx.authActionToken.findUnique({ where: { tokenHash }, include: { user: true } });
        if (!action || action.purpose !== 'EMAIL_VERIFY' || action.usedAt || action.expiresAt <= new Date() || action.user.role !== 'SHOP_OWNER') return false;
        const claimed = await tx.authActionToken.updateMany({ where: { id: action.id, purpose: 'EMAIL_VERIFY', usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
        if (!claimed.count) return false;
        await tx.user.update({ where: { id: action.userId }, data: { emailVerifiedAt: new Date(), emailVerificationRequired: false, sessionVersion: { increment: 1 } } });
        await tx.shop.updateMany({ where: { ownerId: action.userId, status: 'PENDING_CONTACT_VERIFICATION' }, data: { status: 'ACTIVE' } });
        await tx.qRCodeRecord.updateMany({ where: { shop: { ownerId: action.userId } }, data: { isActive: true } });
        return true;
      });
      if (!success) return res.status(400).json({ success: false, message: 'Verification link is invalid or expired.' });
      return res.status(200).json({ success: true, message: 'Email verified. You can now sign in.' });
    } catch (err) { next(err); }
  }

  static async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      if (!EmailService.isConfigured()) return res.status(503).json({ success: false, code: 'EMAIL_DELIVERY_UNAVAILABLE', message: 'Email verification is temporarily unavailable.' });
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const user = email.length <= 254 ? await prisma.user.findUnique({ where: { email }, include: { ownedShops: true } }) : null;
      if (user && user.role === 'SHOP_OWNER' && user.emailVerificationRequired) {
        const rawToken = crypto.randomBytes(32).toString('base64url');
        const tokenHash = digestActionToken(rawToken);
        const tokenIssued = await issueActionToken(user.id, 'EMAIL_VERIFY', tokenHash);
        if (tokenIssued) {
          try {
            const sent = await EmailService.sendActionLink(user.email, `${getShopWebUrl()}/verify-email#token=${encodeURIComponent(rawToken)}`, 'verify');
            if (!sent) throw new Error('Email delivery is not configured.');
          } catch {
            await prisma.authActionToken.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: new Date() } });
            console.warn('Shop email verification delivery failed.');
          }
        }
      }
      return res.status(200).json({ success: true, message: 'If the account needs verification, instructions will be sent.' });
    } catch (err) { next(err); }
  }
}

