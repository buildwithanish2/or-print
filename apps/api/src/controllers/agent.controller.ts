import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { WebSocketService } from '../services/socket.service';
import { getApiBaseUrl } from '@printqr/config';
import { agentReleaseMetadata, canAgentReportStatus, canDispatchPrintJob } from '../services/agent-artifact.service';
import { storageService } from '../services/storage.service';
import fs from 'fs';
import { APP_CONFIG } from '@printqr/config';

export class AgentController {
  private static async authenticateAgent(req: Request) {
    const authorization = req.get('authorization') || '';
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const token = bearer || (typeof req.body?.agentToken === 'string' ? req.body.agentToken : '');
    if (!token) return null;
    return prisma.printerAgent.findUnique({ where: { agentToken: token } });
  }

  /**
   * Pair Windows Print Agent using Shop Pairing Code
   */
  static async pairAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const { pairingCode, deviceName, agentVersion } = req.body;

      if (!pairingCode) {
        return res.status(400).json({ success: false, message: 'Shop Pairing Code is required' });
      }

      const cleanCode = String(pairingCode).trim().toUpperCase();

      // Pairing codes are short-lived and consumed atomically to prevent concurrent reuse.
      const agent = await prisma.printerAgent.findFirst({
        where: {
          expiresAt: { gt: new Date() },
          OR: [
            { pairingCode: cleanCode },
            { pairingCode: cleanCode.replace(/-/g, '') },
          ],
        },
        include: { shop: true },
      });

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Invalid or expired Shop Pairing Code. Please check the code in your Shop Owner Dashboard.',
        });
      }

      const consumed = await prisma.printerAgent.updateMany({
        where: { id: agent.id, expiresAt: { gt: new Date() } },
        data: {
          status: 'CONNECTED',
          deviceName: deviceName || agent.deviceName,
          agentVersion: agentVersion || agent.agentVersion,
          lastHeartbeat: new Date(),
          expiresAt: new Date(0),
        },
      });
      if (consumed.count !== 1) return res.status(404).json({ success: false, message: 'Invalid or expired Shop Pairing Code. Please generate a new code from the dashboard.' });
      const updatedAgent = await prisma.printerAgent.findUnique({ where: { id: agent.id }, include: { shop: true } });
      if (!updatedAgent) return res.status(404).json({ success: false, message: 'Shop pairing could not be completed.' });

      return res.status(200).json({
        success: true,
        message: `Agent paired successfully with ${updatedAgent.shop.name}`,
        data: {
          agentToken: updatedAgent.agentToken,
          shopId: updatedAgent.shopId,
          shopName: updatedAgent.shop.name,
          shopSlug: updatedAgent.shop.slug,
          deviceName: updatedAgent.deviceName,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /** Authenticated, durable queue claim. Only paid/free eligible jobs for this shop are returned. */
  static async pollPrintJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const agent = await AgentController.authenticateAgent(req);
      if (!agent) return res.status(401).json({ success: false, message: 'Valid agent credential required' });
      const jobs = await prisma.printJob.findMany({
        where: {
          shopId: agent.shopId,
          status: 'QUEUED',
          attempts: { lt: 3 },
          order: { paymentStatus: { in: ['PAID', 'NOT_REQUIRED'] }, printStatus: { notIn: ['CANCELLED', 'COMPLETED'] } },
          printer: { shopId: agent.shopId, status: 'ONLINE' },
        },
        include: { order: true, orderItem: { include: { file: true } }, printer: true },
        orderBy: { createdAt: 'asc' },
        take: 5,
      });

      const claimed: any[] = [];
      for (const job of jobs) {
        if (!job.orderItem.file || job.orderItem.file.sizeBytes > APP_CONFIG.MAX_FILE_SIZE_BYTES
          || !['application/pdf', 'image/png', 'image/jpeg'].includes(job.orderItem.file.mimeType)
          || !canDispatchPrintJob({ jobStatus: job.status, paymentStatus: job.order.paymentStatus, printStatus: job.order.printStatus, printerStatus: job.printer.status })) continue;

        const result = await prisma.printJob.updateMany({
          where: {
            id: job.id, shopId: agent.shopId, status: 'QUEUED',
            attempts: { lt: 3 },
            order: { paymentStatus: { in: ['PAID', 'NOT_REQUIRED'] }, printStatus: { notIn: ['CANCELLED', 'COMPLETED'] } },
          },
          data: { status: 'DOWNLOADING', progressPercent: 5, attempts: { increment: 1 }, startedAt: new Date(), errorMessage: null },
        });
        if (result.count !== 1) continue;
        claimed.push({
          id: job.id, orderId: job.orderId, orderNumber: job.order.orderNumber, orderItemId: job.orderItemId,
          shopId: job.shopId, printerId: job.printerId, printerName: job.printer.name,
          fileUrl: `${getApiBaseUrl()}/api/agents/jobs/${encodeURIComponent(job.id)}/file`,
          fileName: job.orderItem.file.originalName, mimeType: job.orderItem.file.mimeType,
          settings: {
            colorMode: job.orderItem.colorMode, paperSize: job.orderItem.paperSize, orientation: job.orderItem.orientation,
            duplexMode: job.orderItem.duplexMode, copies: job.orderItem.copies, pageRange: job.orderItem.pageRange,
            pagesPerSheet: job.orderItem.pagesPerSheet, quality: job.orderItem.quality, selectedPagesCount: job.orderItem.selectedPagesCount,
          },
          idempotencyKey: job.idempotencyKey, status: 'DOWNLOADING', progressPercent: 5,
          attempts: job.attempts + 1, maxAttempts: job.maxAttempts, createdAt: job.createdAt.toISOString(),
        });
      }

      return res.status(200).json({ success: true, data: claimed });
    } catch (err) { next(err); }
  }

  /** Stream only the document belonging to a job claimed by this shop's paired agent. */
  static async downloadPrintJobFile(req: Request, res: Response, next: NextFunction) {
    try {
      const agent = await AgentController.authenticateAgent(req);
      if (!agent) return res.status(401).json({ success: false, message: 'Valid agent credential required' });
      const job = await prisma.printJob.findFirst({
        where: {
          id: req.params.jobId, shopId: agent.shopId, status: { in: ['DOWNLOADING', 'PRINTING', 'SENT_TO_SPOOLER'] },
          order: { paymentStatus: { in: ['PAID', 'NOT_REQUIRED'] }, printStatus: { notIn: ['CANCELLED', 'COMPLETED'] } },
        },
        include: { orderItem: { include: { file: true } } },
      });
      const file = job?.orderItem.file;
      if (!job || !file || file.sizeBytes > APP_CONFIG.MAX_FILE_SIZE_BYTES || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimeType)) {
        return res.status(404).json({ success: false, message: 'Authorized print document not found.' });
      }
      const filePath = storageService.getFilePath(file.storageKey);
      if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Authorized print document is unavailable.' });
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size !== file.sizeBytes || stat.size > APP_CONFIG.MAX_FILE_SIZE_BYTES) return res.status(404).json({ success: false, message: 'Authorized print document is unavailable.' });
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const stream = fs.createReadStream(filePath);
      stream.on('error', next);
      return stream.pipe(res);
    } catch (err) { next(err); }
  }

  /**
   * Sync Discovered Windows Printers to Shop Database
   */
  static async syncPrinters(req: Request, res: Response, next: NextFunction) {
    try {
      const { printers } = req.body;

      if (!Array.isArray(printers)) {
        return res.status(400).json({ success: false, message: 'Printers array is required' });
      }
      if (printers.length > 200) {
        return res.status(400).json({ success: false, message: 'No more than 200 printers can be synced at once' });
      }

      const agent = await AgentController.authenticateAgent(req);
      if (!agent) {
        return res.status(401).json({ success: false, message: 'Valid agent token required' });
      }
      const targetShopId = agent.shopId;
      if (!targetShopId) {
        return res.status(404).json({ success: false, message: 'Shop not found for printer sync' });
      }

      for (const p of printers) {
        if (!p || p.isVirtual === true || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 128) continue;
        const connectionType = ['USB', 'NETWORK_IP', 'SHARED_SPOOLER', 'BLUETOOTH', 'LOCAL', 'UNKNOWN'].includes(p.connectionType)
          ? p.connectionType
          : 'SHARED_SPOOLER';
        const printerStatus = ['ONLINE', 'OFFLINE', 'ERROR', 'PAUSED', 'PRINTING'].includes(p.status)
          ? p.status
          : 'OFFLINE';
        const supportedSizes = Array.isArray(p.supportedSizes)
          ? p.supportedSizes.filter((size: unknown): size is string => typeof size === 'string' && size.length <= 24).join(',').slice(0, 256)
          : typeof p.supportedSizes === 'string' ? p.supportedSizes.slice(0, 256) : '';

        const existing = await prisma.printer.findFirst({
          where: { shopId: targetShopId, name: p.name },
        });

        if (existing) {
          await prisma.printer.update({
            where: { id: existing.id },
            data: {
              status: printerStatus,
              isDefault: Boolean(p.isDefault),
              connectionType,
              supportsColor: typeof p.supportsColor === 'boolean' ? p.supportsColor : false,
              supportsDuplex: typeof p.supportsDuplex === 'boolean' ? p.supportsDuplex : false,
              supportedSizes,
              inkLevel: typeof p.inkLevel === 'number' ? p.inkLevel : null,
              paperLevel: typeof p.paperLevel === 'number' ? p.paperLevel : null,
              lastSeenAt: new Date(),
            },
          });
        } else {
          await prisma.printer.create({
            data: {
              shopId: targetShopId,
              name: p.name,
              model: typeof p.model === 'string' && p.model.length <= 128 ? p.model : p.name,
              connectionType,
              status: printerStatus,
              isDefault: Boolean(p.isDefault),
              supportsColor: typeof p.supportsColor === 'boolean' ? p.supportsColor : false,
              supportsDuplex: typeof p.supportsDuplex === 'boolean' ? p.supportsDuplex : false,
              supportedSizes,
              inkLevel: typeof p.inkLevel === 'number' ? p.inkLevel : null,
              paperLevel: typeof p.paperLevel === 'number' ? p.paperLevel : null,
              lastSeenAt: new Date(),
            },
          });
        }
      }

      const allPrinters = await prisma.printer.findMany({
        where: { shopId: targetShopId },
      });

      return res.status(200).json({
        success: true,
        message: `${printers.length} Windows printers synced successfully`,
        data: allPrinters,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Heartbeat from Windows Desktop Agent
   */
  static async agentHeartbeat(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const agent = await AgentController.authenticateAgent(req);
      if (!agent) {
        return res.status(401).json({ success: false, message: 'Valid agent token required' });
      }
      const acceptedStatuses = ['CONNECTED', 'DISCONNECTED'];
      if (status && !acceptedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid agent status' });
      }
      const result = await prisma.printerAgent.updateMany({
        where: { id: agent.id },
        data: { status: status || 'CONNECTED', lastHeartbeat: new Date() },
      });
      if (!result.count) return res.status(401).json({ success: false, message: 'Invalid agent token' });
      return res.status(200).json({ success: true, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Latest Windows Print Agent update manifest
   */
  static async getLatestUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const channel = (req.query.channel as string) || 'stable';
      const release = agentReleaseMetadata();
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      if (!release) return res.status(503).json({ success: false, message: 'Windows Print Agent update is temporarily unavailable.' });

      return res.status(200).json({
        success: true,
        data: {
          latestVersion: release.latestVersion,
          minimumSupportedVersion: release.minimumSupportedVersion,
          mandatory: release.mandatory,
          releaseDate: release.releaseDate,
          channel,
          signatureRequired: release.signatureRequired === true,
          releaseNotes: release.releaseNotes,
          downloadUrl: `${getApiBaseUrl()}/api/admin/agents/download/binary/latest`,
          sha256: release.binary.sha256,
          fileSize: release.binary.fileSize,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Report print job completion or failure from Windows desktop agent
   */
  static async updateJobStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.params;
      const { status, progressPercent, errorMessage } = req.body;
      const allowedStatuses = ['DOWNLOADING', 'SENT_TO_SPOOLER', 'PRINTING', 'FAILED'];
      const agent = await AgentController.authenticateAgent(req);
      if (!agent) {
        return res.status(401).json({ success: false, message: 'Valid agent token required' });
      }
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid print job status' });
      }
      if (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 100) {
        return res.status(400).json({ success: false, message: 'Progress must be an integer from 0 to 100' });
      }

      const printJob = await prisma.printJob.findUnique({
        where: { id: jobId },
        include: {
          order: {
            include: {
              items: { include: { file: true } },
              printJobs: true,
            },
          },
        },
      });

      if (!printJob) {
        return res.status(404).json({ success: false, message: 'Print job not found' });
      }
      if (agent.shopId !== printJob.shopId) {
        return res.status(403).json({ success: false, message: 'Agent is not authorized for this print job' });
      }
      if (!['PAID', 'NOT_REQUIRED'].includes(printJob.order.paymentStatus) || ['CANCELLED', 'COMPLETED'].includes(printJob.order.printStatus)) {
        return res.status(409).json({ success: false, message: 'This order is not currently authorized for printing.' });
      }
      if (['COMPLETED', 'FAILED'].includes(printJob.status)) {
        return res.status(409).json({ success: false, message: 'Print job is already in a terminal state' });
      }
      if (!canAgentReportStatus(printJob.status, status)) return res.status(409).json({ success: false, message: 'Print job status transition is not valid.' });

      const updatedJob = await prisma.printJob.update({
        where: { id: jobId },
        data: {
          status,
          progressPercent,
          errorMessage: errorMessage || null,
          completedAt: null,
        },
      });

      // Check if all jobs in this order are completed
      const allJobs = await prisma.printJob.findMany({
        where: { orderId: printJob.orderId },
      });

      // The current Windows agent observes only spooler acceptance, not physical completion.
      const allCompleted = allJobs.every((j) => j.status === 'COMPLETED');
      const anyFailed = allJobs.some((j) => j.status === 'FAILED');
      const allTerminal = allJobs.every((j) => ['COMPLETED', 'FAILED'].includes(j.status));

      const newOrderStatus = allCompleted ? 'COMPLETED' : allTerminal && anyFailed ? 'FAILED' : ['PRINTING', 'SENT_TO_SPOOLER'].includes(status) ? 'PRINTING' : printJob.order.printStatus;

      const updatedOrder = await prisma.order.update({
        where: { id: printJob.orderId },
        data: {
          printStatus: newOrderStatus,
          completedAt: allCompleted ? new Date() : null,
        },
        include: { items: { include: { file: true } }, printJobs: true },
      });

      // Real-time broadcast
      WebSocketService.broadcastJobStatus(updatedJob);
      WebSocketService.broadcastOrderUpdate(updatedOrder.orderNumber, updatedOrder.shopId, updatedOrder);

      return res.status(200).json({
        success: true,
        message: `Job status updated to ${status}`,
        data: { job: updatedJob, order: updatedOrder },
      });
    } catch (err) {
      next(err);
    }
  }
}

