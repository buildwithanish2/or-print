import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { JWT_SECRET } from '../config/secrets';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  shopId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        ownedShops: { select: { id: true, slug: true, name: true } },
        staffMembers: { select: { shopId: true, role: true } },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated or not found',
      });
    }
    if ((decoded.sessionVersion ?? 0) !== user.sessionVersion) {
      return res.status(401).json({ success: false, message: 'Session has expired. Please sign in again.' });
    }

    let shopId: string | null = null;
    if (user.ownedShops && user.ownedShops.length > 0) {
      shopId = user.ownedShops[0].id;
    } else if (user.staffMembers && user.staffMembers.length > 0) {
      shopId = user.staffMembers[0].shopId;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      shopId,
    };

    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && decoded.id) {
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          include: {
            ownedShops: { select: { id: true } },
            staffMembers: { select: { shopId: true } },
          },
        });
        if (user && user.isActive && (decoded.sessionVersion ?? 0) === user.sessionVersion) {
          req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            shopId: user.ownedShops?.[0]?.id || user.staffMembers?.[0]?.shopId || null,
          };
        }
      }
    }
  } catch {
    // Continue as guest
  }
  next();
};
