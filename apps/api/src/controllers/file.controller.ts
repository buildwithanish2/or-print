import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { storageService } from '../services/storage.service';
import { DocumentProcessingService } from '../services/pdf.service';
import { SUPPORTED_MIME_TYPES } from '@printqr/config';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { getGuestVerificationByToken } from '../services/free-print.service';

export class FileController {
  static async uploadFile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file was uploaded',
        });
      }

      const { originalname, mimetype, buffer, size } = req.file;
      const isValidSignature = (() => {
        if (mimetype === 'application/pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
        if (mimetype === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        if (mimetype === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
        if (mimetype.startsWith('image/')) return false;
        // Office Open XML is ZIP; legacy Office files use the OLE compound-file signature.
        if (mimetype.includes('openxmlformats')) return buffer[0] === 0x50 && buffer[1] === 0x4b;
        if (['application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint'].includes(mimetype)) {
          return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
        }
        return false;
      })();
      if (!isValidSignature) {
        return res.status(400).json({ success: false, message: 'File contents do not match the selected document type' });
      }
      const shopSlug = req.body.shopSlug;

      let shopId: string | null = null;
      if (shopSlug) {
        const shop = await prisma.shop.findUnique({ where: { slug: shopSlug } });
        if (shop) shopId = shop.id;
      }

      const freePrintToken = String(req.get('X-Free-Print-Token') || '');
      const guestVerification = freePrintToken ? await getGuestVerificationByToken(freePrintToken) : null;
      if (freePrintToken && (!guestVerification || guestVerification.shopId !== shopId)) return res.status(403).json({ success: false, message: 'This upload session is not valid for the selected shop' });

      // Analyze page count and orientation
      const docInfo = await DocumentProcessingService.analyzeDocument(buffer, mimetype);

      // Save file to storage abstraction
      const { key, url } = await storageService.saveFile(buffer, originalname, mimetype);

      // Determine category
      const mimeMeta = (SUPPORTED_MIME_TYPES as any)[mimetype];
      const category = mimeMeta ? mimeMeta.category : 'DOCUMENT';

      // Save record in database
      const fileRecord = await prisma.$transaction(async (tx) => {
        const record = await tx.fileRecord.create({ data: {
          shopId, originalName: originalname, mimeType: mimetype, sizeBytes: size,
          pageCount: docInfo.pageCount, category, storageKey: key, url, previewUrl: url,
          expiresAt: new Date(Date.now() + Number(process.env.FILE_RETENTION_HOURS || 24) * 60 * 60 * 1000),
          guestVerificationId: guestVerification?.id,
        } });
        if (req.user?.id) await tx.$executeRaw`INSERT INTO "FileOwnership" ("id", "fileId", "userId", "createdAt") VALUES (${randomUUID()}, ${record.id}, ${req.user.id}, CURRENT_TIMESTAMP)`;
        return record;
      });

      return res.status(201).json({
        success: true,
        message: 'File uploaded and parsed successfully',
        data: {
          id: fileRecord.id,
          originalName: fileRecord.originalName,
          mimeType: fileRecord.mimeType,
          sizeBytes: fileRecord.sizeBytes,
          pageCount: fileRecord.pageCount,
          category: fileRecord.category,
          url: fileRecord.url,
          isLandscape: docInfo.isLandscape,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async downloadFile(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const fileRecord = await prisma.fileRecord.findFirst({
        where: { storageKey: key },
      });

      const filePath = storageService.getFilePath(key);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'File not found on server storage' });
      }

      const mimeType = fileRecord?.mimeType || 'application/octet-stream';
      const fileName = fileRecord?.originalName || key;

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  static async getFileById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const file = await prisma.fileRecord.findUnique({
        where: { id },
      });

      if (!file) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }

      return res.status(200).json({ success: true, data: file });
    } catch (err) {
      next(err);
    }
  }
}
