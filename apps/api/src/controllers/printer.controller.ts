import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { DocumentProcessingService } from '../services/pdf.service';
import { storageService } from '../services/storage.service';
import { WebSocketService } from '../services/socket.service';
import { getApiBaseUrl } from '@printqr/config';
import crypto from 'crypto';

export class PrinterController {
  static async listPrinters(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId || req.query.shopId as string;
      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });

      const printers = await prisma.printer.findMany({
        where: { shopId },
        orderBy: { isDefault: 'desc' },
        include: {
          _count: { select: { printJobs: true } },
        },
      });

      return res.status(200).json({ success: true, data: printers });
    } catch (err) {
      next(err);
    }
  }

  static async addPrinter(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) return res.status(400).json({ success: false, message: 'Shop ID required' });

      const { name, model, connectionType, supportsColor, supportsDuplex, supportedSizes, isDefault } = req.body;

      if (isDefault) {
        // Reset previous default
        await prisma.printer.updateMany({
          where: { shopId },
          data: { isDefault: false },
        });
      }

      const printer = await prisma.printer.create({
        data: {
          shopId,
          name,
          model: model || name,
          connectionType: connectionType || 'USB',
          status: 'ONLINE',
          supportsColor: supportsColor ?? true,
          supportsDuplex: supportsDuplex ?? true,
          supportedSizes: Array.isArray(supportedSizes) ? supportedSizes.join(',') : (typeof supportedSizes === 'string' ? supportedSizes : ''),
          isDefault: !!isDefault,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Printer added successfully',
        data: printer,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updatePrinter(req: Request, res: Response, next: NextFunction) {
    try {
      const { printerId } = req.params;
      const { name, isDefault, status, supportsColor, supportsDuplex } = req.body;

      const existing = await prisma.printer.findUnique({ where: { id: printerId } });
      if (!existing) return res.status(404).json({ success: false, message: 'Printer not found' });

      if (isDefault) {
        await prisma.printer.updateMany({
          where: { shopId: existing.shopId },
          data: { isDefault: false },
        });
      }

      const updated = await prisma.printer.update({
        where: { id: printerId },
        data: {
          name: name ?? existing.name,
          isDefault: isDefault ?? existing.isDefault,
          status: status ?? existing.status,
          supportsColor: supportsColor ?? existing.supportsColor,
          supportsDuplex: supportsDuplex ?? existing.supportsDuplex,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Printer updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Generates a test print job and dispatches to Windows Agent
   */
  static async triggerTestPrint(req: Request, res: Response, next: NextFunction) {
    try {
      const { printerId } = req.params;
      const printer = await prisma.printer.findUnique({
        where: { id: printerId },
        include: { shop: true },
      });

      if (!printer) return res.status(404).json({ success: false, message: 'Printer not found' });

      const testId = `TEST-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const testPdfBuffer = await DocumentProcessingService.generateTestPdf(
        printer.name,
        printer.shop.name,
        testId
      );

      const { key, url } = await storageService.saveFile(testPdfBuffer, `test_page_${testId}.pdf`, 'application/pdf');

      const fileRecord = await prisma.fileRecord.create({
        data: {
          shopId: printer.shopId,
          originalName: `Diagnostic_Test_Print_${testId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: testPdfBuffer.length,
          pageCount: 1,
          category: 'PDF',
          storageKey: key,
          url,
          previewUrl: url,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        },
      });

      // Dispatch directly to Windows Agent
      WebSocketService.dispatchPrintJob({
        id: `test_job_${testId}`,
        orderId: `test_order_${testId}`,
        orderNumber: testId,
        orderItemId: fileRecord.id,
        shopId: printer.shopId,
        printerId: printer.id,
        fileUrl: `${getApiBaseUrl()}${url}`,
        fileName: fileRecord.originalName,
        mimeType: 'application/pdf',
        settings: {
          colorMode: 'COLOR',
          paperSize: 'A4',
          orientation: 'PORTRAIT',
          duplexMode: 'SIMPLEX',
          copies: 1,
          pageRange: 'ALL',
          pagesPerSheet: 1,
          quality: 'HIGH',
          selectedPagesCount: 1,
        },
        idempotencyKey: `test_idemp_${testId}`,
        status: 'QUEUED',
        progressPercent: 0,
        attempts: 1,
        maxAttempts: 1,
        createdAt: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        message: `Diagnostic test print (${testId}) dispatched to ${printer.name}`,
        data: { testId, downloadUrl: url },
      });
    } catch (err) {
      next(err);
    }
  }

  static async deletePrinter(req: Request, res: Response, next: NextFunction) {
    try {
      const { printerId } = req.params;
      await prisma.printer.delete({ where: { id: printerId } });
      return res.status(200).json({ success: true, message: 'Printer removed successfully' });
    } catch (err) {
      next(err);
    }
  }
}
