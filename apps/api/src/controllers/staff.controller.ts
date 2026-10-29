import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';

export class StaffController {
  /**
   * List all staff members for the authenticated shop
   */
  static async listStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });

      const staff = await prisma.shopStaff.findMany({
        where: { shopId },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true, role: true, avatarUrl: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({ success: true, data: staff });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Add a new staff member to the shop
   */
  static async addStaff(req: Request, res: Response, next: NextFunction) {
    try {
      if (!['SHOP_OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(req.user?.role || '')) return res.status(403).json({ success: false, message: 'Only a shop owner or administrator can manage shop staff' });
      const shopId = req.user?.shopId;
      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });

      const { name, email, phone, password, role = 'OPERATOR', permissions } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
      }
      if (typeof password !== 'string' || password.length < 12 || password.length > 128) return res.status(400).json({ success: false, message: 'Staff passwords must contain 12 to 128 characters' });
      if (!['OPERATOR', 'MANAGER', 'CASHIER'].includes(String(role))) return res.status(400).json({ success: false, message: 'Choose a valid shop staff role' });
      const allowedPermissions = new Set(['orders.view', 'orders.manage', 'printing.view', 'printing.retry', 'pricing.view', 'pricing.manage', 'payments.view']);
      const requestedPermissions = typeof permissions === 'string' ? permissions.split(',').map((item: string) => item.trim()).filter(Boolean) : [];
      if (requestedPermissions.some((permission: string) => !allowedPermissions.has(permission))) return res.status(400).json({ success: false, message: 'One or more staff permissions are not supported' });
      const normalizedEmail = String(email).trim().toLowerCase();
      if (await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })) return res.status(409).json({ success: false, message: 'This email already belongs to an OR PRINT account. Use a new staff email or contact an administrator.' });
      const passwordHash = await bcrypt.hash(password, 12);
      const staff = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { name: String(name).trim(), email: normalizedEmail, phone: phone || null, passwordHash, role: 'SHOP_STAFF' } });
        return tx.shopStaff.create({
          data: { shopId, userId: user.id, role: String(role), permissions: requestedPermissions.join(',') || 'orders.view,orders.manage,printing.view,printing.retry', isActive: true },
          include: { user: true },
        });
      });

      return res.status(201).json({
        success: true,
        message: 'Staff member added successfully',
        data: staff,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update staff member permissions or role
   */
  static async updateStaff(req: Request, res: Response, next: NextFunction) {
    try {
      if (!['SHOP_OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(req.user?.role || '')) return res.status(403).json({ success: false, message: 'Only a shop owner or administrator can manage shop staff' });
      const { staffId } = req.params;
      const { role, permissions, isActive } = req.body;
      const shopId = req.user?.shopId;
      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });
      const current = await prisma.shopStaff.findFirst({ where: { id: staffId, shopId } });
      if (!current) return res.status(404).json({ success: false, message: 'Staff member not found in this shop' });
      if (role !== undefined && !['OPERATOR', 'MANAGER', 'CASHIER'].includes(String(role))) return res.status(400).json({ success: false, message: 'Choose a valid shop staff role' });
      const allowedPermissions = new Set(['orders.view', 'orders.manage', 'printing.view', 'printing.retry', 'pricing.view', 'pricing.manage', 'payments.view']);
      if (permissions !== undefined && (typeof permissions !== 'string' || permissions.split(',').map((item: string) => item.trim()).filter(Boolean).some((permission: string) => !allowedPermissions.has(permission)))) return res.status(400).json({ success: false, message: 'One or more staff permissions are not supported' });

      const staff = await prisma.shopStaff.update({
        where: { id: current.id },
        data: {
          role: role || undefined,
          permissions: permissions || undefined,
          isActive: typeof isActive === 'boolean' ? isActive : undefined,
        },
        include: { user: true },
      });

      return res.status(200).json({
        success: true,
        message: 'Staff member updated successfully',
        data: staff,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Remove staff member from shop
   */
  static async removeStaff(req: Request, res: Response, next: NextFunction) {
    try {
      if (!['SHOP_OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(req.user?.role || '')) return res.status(403).json({ success: false, message: 'Only a shop owner or administrator can manage shop staff' });
      const { staffId } = req.params;
      const shopId = req.user?.shopId;
      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });
      const staff = await prisma.shopStaff.findFirst({ where: { id: staffId, shopId }, select: { id: true } });
      if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found in this shop' });
      await prisma.shopStaff.delete({ where: { id: staff.id } });

      return res.status(200).json({
        success: true,
        message: 'Staff member removed successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}
