import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

export class BannerController {
  /**
   * Public active marketing banners
   */
  static async listPublic(req: Request, res: Response, next: NextFunction) {
    try {
      const banners = await prisma.homepageBanner.findMany({
        where: { isEnabled: true },
        orderBy: { displayOrder: 'asc' },
      });
      return res.status(200).json({ success: true, data: banners });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin list all banners
   */
  static async listAll(req: Request, res: Response, next: NextFunction) {
    try {
      const banners = await prisma.homepageBanner.findMany({
        orderBy: { displayOrder: 'asc' },
      });
      return res.status(200).json({ success: true, data: banners });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin save banner
   */
  static async saveBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, title, subtitle, ctaText, ctaUrl, bgGradient, imageUrl, displayOrder, isEnabled } = req.body;

      if (!title) {
        return res.status(400).json({ success: false, message: 'Title is required' });
      }

      let banner;
      if (id) {
        banner = await prisma.homepageBanner.update({
          where: { id },
          data: {
            title,
            subtitle,
            ctaText,
            ctaUrl,
            bgGradient,
            imageUrl,
            displayOrder: Number(displayOrder || 0),
            isEnabled: typeof isEnabled === 'boolean' ? isEnabled : true,
          },
        });
      } else {
        banner = await prisma.homepageBanner.create({
          data: {
            title,
            subtitle,
            ctaText,
            ctaUrl,
            bgGradient: bgGradient || 'from-purple-900/80 via-pink-900/60 to-slate-900',
            imageUrl,
            displayOrder: Number(displayOrder || 0),
            isEnabled: typeof isEnabled === 'boolean' ? isEnabled : true,
          },
        });
      }

      return res.status(200).json({ success: true, message: 'Banner saved', data: banner });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin delete banner
   */
  static async deleteBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await prisma.homepageBanner.delete({ where: { id } });
      return res.status(200).json({ success: true, message: 'Banner deleted' });
    } catch (err) {
      next(err);
    }
  }
}
