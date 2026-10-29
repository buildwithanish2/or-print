import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { WebSocketService } from '../services/socket.service';
import { getApiBaseUrl } from '@printqr/config';

export class AgentController {
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

      // Find shop by pairing code or fallback to demo shop if standard code
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

      // Update agent connection status
      const updatedAgent = await prisma.printerAgent.update({
        where: { id: agent.id },
        data: {
          status: 'CONNECTED',
          deviceName: deviceName || agent.deviceName,
          agentVersion: agentVersion || agent.agentVersion,
          lastHeartbeat: new Date(),
          expiresAt: new Date(0),
        },
        include: { shop: true },
      });

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

  /**
   * Sync Discovered Windows Printers to Shop Database
   */
  static async syncPrinters(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentToken, printers } = req.body;

      if (!Array.isArray(printers)) {
        return res.status(400).json({ success: false, message: 'Printers array is required' });
      }

      const agent = typeof agentToken === 'string'
        ? await prisma.printerAgent.findUnique({ where: { agentToken } })
        : null;
      if (!agent) {
        return res.status(401).json({ success: false, message: 'Valid agent token required' });
      }
      const targetShopId = agent.shopId;
      if (!targetShopId) {
        return res.status(404).json({ success: false, message: 'Shop not found for printer sync' });
      }

      for (const p of printers) {
        if (!p.name) continue;

        const existing = await prisma.printer.findFirst({
          where: { shopId: targetShopId, name: p.name },
        });

        if (existing) {
          await prisma.printer.update({
            where: { id: existing.id },
            data: {
              status: p.status || 'ONLINE',
              isDefault: Boolean(p.isDefault),
              supportsColor: typeof p.supportsColor === 'boolean' ? p.supportsColor : false,
              supportsDuplex: typeof p.supportsDuplex === 'boolean' ? p.supportsDuplex : false,
              supportedSizes: Array.isArray(p.supportedSizes) ? p.supportedSizes.join(',') : (typeof p.supportedSizes === 'string' ? p.supportedSizes : ''),
              lastSeenAt: new Date(),
            },
          });
        } else {
          await prisma.printer.create({
            data: {
              shopId: targetShopId,
              name: p.name,
              model: p.model || p.name,
              connectionType: 'SHARED_SPOOLER',
              status: p.status || 'ONLINE',
              isDefault: Boolean(p.isDefault),
              supportsColor: typeof p.supportsColor === 'boolean' ? p.supportsColor : false,
              supportsDuplex: typeof p.supportsDuplex === 'boolean' ? p.supportsDuplex : false,
              supportedSizes: Array.isArray(p.supportedSizes) ? p.supportedSizes.join(',') : (typeof p.supportedSizes === 'string' ? p.supportedSizes : ''),
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
      const { agentToken, status } = req.body;
      if (typeof agentToken !== 'string' || !agentToken) {
        return res.status(401).json({ success: false, message: 'Valid agent token required' });
      }
      const acceptedStatuses = ['CONNECTED', 'DISCONNECTED'];
      if (status && !acceptedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid agent status' });
      }
      const result = await prisma.printerAgent.updateMany({
        where: { agentToken },
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

      return res.status(200).json({
        success: true,
        data: {
          latestVersion: '1.0.0',
          minimumSupportedVersion: '1.0.0',
          mandatory: false,
          releaseDate: '2026-08-23',
          channel,
          releaseNotes: [
            'Official AnishNova Print multi-resolution icon branding',
            'Automatic background update checker and SHA-256 integrity verification',
            'Direct Windows Spooler driver integration with zero-latency printing',
            'Permanent shop QR code identity and secure pairing key masking'
          ],
          downloadUrl: `${getApiBaseUrl()}/api/admin/agents/download/latest`,
          sha256: '3cb0172e90e1f7051df1c750b32948625baebca72e01dfdf68b556bfa0f4e3c1',
          fileSize: 143235679,
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
      const { agentToken, status, progressPercent, errorMessage } = req.body;
      const allowedStatuses = ['DOWNLOADING', 'SENT_TO_SPOOLER', 'PRINTING', 'COMPLETED', 'FAILED'];
      if (typeof agentToken !== 'string' || !agentToken) {
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
      const agent = await prisma.printerAgent.findUnique({ where: { agentToken } });
      if (!agent || agent.shopId !== printJob.shopId) {
        return res.status(403).json({ success: false, message: 'Agent is not authorized for this print job' });
      }
      if (['COMPLETED', 'FAILED'].includes(printJob.status)) {
        return res.status(409).json({ success: false, message: 'Print job is already in a terminal state' });
      }

      const updatedJob = await prisma.printJob.update({
        where: { id: jobId },
        data: {
          status,
          progressPercent,
          errorMessage: errorMessage || null,
          completedAt: status === 'COMPLETED' ? new Date() : null,
        },
      });

      // Check if all jobs in this order are completed
      const allJobs = await prisma.printJob.findMany({
        where: { orderId: printJob.orderId },
      });

      const allCompleted = allJobs.every((j) => j.status === 'COMPLETED');
      const anyFailed = allJobs.some((j) => j.status === 'FAILED');

      const newOrderStatus = allCompleted ? 'COMPLETED' : anyFailed ? 'FAILED' : 'PRINTING';

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

