import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

export class NavigationController {
  /**
   * Public navigation items for website navbar
   */
  static async listPublic(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await prisma.navigationItem.findMany({
        where: { isEnabled: true },
        orderBy: { displayOrder: 'asc' },
      });
      return res.status(200).json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin list all navigation items
   */
  static async listAll(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await prisma.navigationItem.findMany({
        orderBy: { displayOrder: 'asc' },
      });
      return res.status(200).json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin create or update navigation item
   */
  static async saveItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, label, path, isExternal, openInNewTab, displayOrder, isEnabled } = req.body;

      if (!label || !path) {
        return res.status(400).json({ success: false, message: 'Label and path are required' });
      }

      let item;
      if (id) {
        item = await prisma.navigationItem.update({
          where: { id },
          data: {
            label,
            path,
            isExternal: Boolean(isExternal),
            openInNewTab: Boolean(openInNewTab),
            displayOrder: Number(displayOrder || 0),
            isEnabled: typeof isEnabled === 'boolean' ? isEnabled : true,
          },
        });
      } else {
        item = await prisma.navigationItem.create({
          data: {
            label,
            path,
            isExternal: Boolean(isExternal),
            openInNewTab: Boolean(openInNewTab),
            displayOrder: Number(displayOrder || 0),
            isEnabled: typeof isEnabled === 'boolean' ? isEnabled : true,
          },
        });
      }

      return res.status(200).json({ success: true, message: 'Navigation item saved', data: item });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin delete navigation item
   */
  static async deleteItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await prisma.navigationItem.delete({ where: { id } });
      return res.status(200).json({ success: true, message: 'Navigation item deleted' });
    } catch (err) {
      next(err);
    }
  }
}
