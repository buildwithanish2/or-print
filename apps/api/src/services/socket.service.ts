import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../prisma';
import { reconcileFreePrintReservation } from './free-print.service';
import { PrintJobDTO, OrderDTO } from '@printqr/types';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/secrets';

export class WebSocketService {
  private static io: SocketIOServer;
  // Map of shopId -> Set of agent socketIds
  private static activeAgents: Map<string, Set<string>> = new Map();

  static initialize(io: SocketIOServer) {
    this.io = io;

    io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') return next();
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id?: string };
        if (decoded.id) (socket as any).userId = decoded.id;
      } catch {
        return next(new Error('Invalid authentication token'));
      }
      next();
    });

    io.on('connection', (socket: Socket) => {
      console.log(`🔌 New WebSocket client connected: ${socket.id}`);

      // Client joins tracking room for a specific order
      socket.on('join:order', async (payload: { orderNumber?: string; trackingToken?: string }) => {
        if (!payload?.orderNumber || !payload.trackingToken) return;
        const order = await prisma.order.findUnique({
          where: { orderNumber: payload.orderNumber },
          select: { trackingToken: true },
        });
        if (!order || order.trackingToken !== payload.trackingToken) return;
        socket.join(`order:${payload.orderNumber}`);
      });

      // Shop dashboard joins shop room
      socket.on('join:shop', async (shopId: string) => {
        if (typeof shopId !== 'string' || !shopId) return;
        const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true } });
        if (shop) {
          const userId = (socket as any).userId;
          if (!userId) return;
          const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { ownedShops: { select: { id: true } }, staffMembers: { select: { shopId: true, isActive: true } } },
          });
          const allowed = user && (['SUPER_ADMIN', 'ADMIN'].includes(user.role)
            || user.ownedShops.some((owned) => owned.id === shopId)
            || user.staffMembers.some((staff) => staff.isActive && staff.shopId === shopId));
          if (!allowed) return;
        }
        socket.join(`shop:${shopId}`);
        console.log(`🏪 Socket ${socket.id} joined shop management room: shop:${shopId}`);
      });

      // Windows Desktop Agent Registration & Pairing
      socket.on('agent:register', async (payload: { pairingCode?: string; agentToken?: string; deviceName: string; osVersion?: string }) => {
        try {
          let agent = null;
          if (payload.agentToken) {
            agent = await prisma.printerAgent.findUnique({
              where: { agentToken: payload.agentToken },
              include: { shop: true },
            });
          }

          if (!agent) {
            socket.emit('agent:auth_failed', { message: 'Invalid pairing code or agent token' });
            return;
          }

          // Update agent status
          await prisma.printerAgent.update({
            where: { id: agent.id },
            data: {
              status: 'CONNECTED',
              deviceName: payload.deviceName || agent.deviceName,
              osVersion: payload.osVersion || agent.osVersion,
              lastHeartbeat: new Date(),
            },
          });

          // Join agent rooms
          socket.join(`agent:${agent.id}`);
          socket.join(`shop:${agent.shopId}`);

          // Track in memory
          if (!this.activeAgents.has(agent.shopId)) {
            this.activeAgents.set(agent.shopId, new Set());
          }
          this.activeAgents.get(agent.shopId)?.add(socket.id);

          (socket as any).agentId = agent.id;
          (socket as any).shopId = agent.shopId;

          socket.emit('agent:authenticated', {
            agentId: agent.id,
            shopId: agent.shopId,
            shopName: agent.shop.name,
            agentToken: agent.agentToken,
          });

          // Broadcast agent online status to shop dashboard
          this.io.to(`shop:${agent.shopId}`).emit('agent:status', {
            agentId: agent.id,
            status: 'CONNECTED',
            deviceName: payload.deviceName,
          });

          console.log(`🖥️ Windows Agent connected for shop: ${agent.shop.name} (${agent.deviceName})`);
        } catch (err) {
          console.error('Agent registration error:', err);
        }
      });

      // Windows Agent telemetry heartbeat
      socket.on('agent:heartbeat', async (payload: { printers?: any[] }) => {
        const agentId = (socket as any).agentId;
        const shopId = (socket as any).shopId;
        if (agentId && shopId) {
          await prisma.printerAgent.update({
            where: { id: agentId },
            data: { lastHeartbeat: new Date(), status: 'CONNECTED' },
          });

          // Sync discovered printers
          if (payload.printers && Array.isArray(payload.printers)) {
            for (const p of payload.printers) {
              const existing = await prisma.printer.findFirst({
                where: { shopId, name: p.name },
              });
              if (existing) {
                await prisma.printer.update({
                  where: { id: existing.id },
                  data: {
                    status: p.status || 'ONLINE',
                    inkLevel: p.inkLevel ?? existing.inkLevel,
                    paperLevel: p.paperLevel ?? existing.paperLevel,
                    lastSeenAt: new Date(),
                  },
                });
              } else if (p.name) {
                await prisma.printer.create({
                  data: {
                    shopId,
                    name: p.name,
                    model: p.model || p.name,
                    connectionType: 'SHARED_SPOOLER',
                    status: p.status || 'ONLINE',
                    supportsColor: p.supportsColor ?? true,
                    supportsDuplex: p.supportsDuplex ?? true,
                  },
                });
              }
            }

            const updatedPrinters = await prisma.printer.findMany({ where: { shopId } });
            this.io.to(`shop:${shopId}`).emit('printer:discovered', updatedPrinters);
          }
        }
      });

      // Windows Agent job progress & completion updates
      socket.on('agent:job_update', async (payload: { jobId: string; status: string; progress: number; errorMessage?: string }) => {
        try {
          const agentId = (socket as any).agentId;
          const shopId = (socket as any).shopId;
          if (!agentId || !shopId) return;
          // This agent can report successful spooler submission but cannot confirm paper output.
          if (!['DOWNLOADING', 'SENT_TO_SPOOLER', 'PRINTING', 'FAILED'].includes(payload.status)) return;
          if (!Number.isInteger(payload.progress) || payload.progress < 0 || payload.progress > 100) return;
          const job = await prisma.printJob.findUnique({
            where: { id: payload.jobId },
            include: { order: true },
          });

          if (!job || job.shopId !== shopId || ['COMPLETED', 'FAILED'].includes(job.status)) return;

          const updatedJob = await prisma.printJob.update({
            where: { id: payload.jobId },
            data: {
              status: payload.status,
              progressPercent: payload.progress,
              errorMessage: payload.errorMessage,
              startedAt: payload.status === 'PRINTING' && !job.startedAt ? new Date() : job.startedAt,
              completedAt: payload.status === 'COMPLETED' ? new Date() : job.completedAt,
            },
          });

          // Check if all jobs for the order are complete
          if (payload.status === 'COMPLETED') {
            const pendingJobs = await prisma.printJob.count({
              where: {
                orderId: job.orderId,
                status: { not: 'COMPLETED' },
              },
            });

            if (pendingJobs === 0) {
              await prisma.order.update({
                where: { id: job.orderId },
                data: { printStatus: 'COMPLETED', completedAt: new Date() },
              });
            }
          } else if (payload.status === 'PRINTING') {
            await prisma.order.update({
              where: { id: job.orderId },
              data: { printStatus: 'PRINTING' },
            });
          }

          if (payload.status === 'FAILED') {
            const nonTerminal = await prisma.printJob.count({ where: { orderId: job.orderId, status: { notIn: ['COMPLETED', 'FAILED'] } } });
            if (nonTerminal === 0) {
              const jobs = await prisma.printJob.findMany({ where: { orderId: job.orderId }, select: { status: true } });
              const anyCompleted = jobs.some((entry) => entry.status === 'COMPLETED');
              await prisma.order.updateMany({ where: { id: job.orderId, printStatus: { not: 'COMPLETED' } }, data: { printStatus: 'FAILED' } });
              // If an order is only partially complete, consume the full reservation
              // conservatively; never credit pages based on an unverified estimate.
              await reconcileFreePrintReservation(job.orderId, anyCompleted ? 'COMPLETED' : 'RELEASED');
            }
          } else if (payload.status === 'COMPLETED') {
            const nonTerminal = await prisma.printJob.count({ where: { orderId: job.orderId, status: { not: 'COMPLETED' } } });
            if (nonTerminal === 0) await reconcileFreePrintReservation(job.orderId, 'COMPLETED');
          }

          // Emit to customer tracking room and shop queue room
          this.io.to(`order:${job.order.orderNumber}`).emit('job:status', updatedJob);
          this.io.to(`shop:${job.shopId}`).emit('job:status', updatedJob);
        } catch (err) {
          console.error('Job update processing error:', err);
        }
      });

      socket.on('disconnect', async () => {
        const agentId = (socket as any).agentId;
        const shopId = (socket as any).shopId;
        if (agentId && shopId) {
          this.activeAgents.get(shopId)?.delete(socket.id);
          if ((this.activeAgents.get(shopId)?.size || 0) === 0) {
            await prisma.printerAgent.update({
              where: { id: agentId },
              data: { status: 'DISCONNECTED' },
            });
            this.io.to(`shop:${shopId}`).emit('agent:status', {
              agentId,
              status: 'DISCONNECTED',
            });
          }
        }
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Dispatches a print job to the shop's connected Windows Agent
   */
  static async dispatchPrintJob(job: PrintJobDTO): Promise<boolean> {
    if (!this.io) return false;

    // Send to agent room
    this.io.to(`shop:${job.shopId}`).emit('agent:print_job', job);
    this.io.to(`order:${job.orderNumber}`).emit('job:status', job);
    return true;
  }

  /**
   * Broadcasts order status update to customer tracking view
   */
  static broadcastOrderUpdate(orderNumber: string, shopId: string, orderData: any) {
    if (!this.io) return;
    this.io.to(`order:${orderNumber}`).emit('order:updated', orderData);
    this.io.to(`shop:${shopId}`).emit('order:updated', orderData);
  }

  /**
   * Broadcasts shop metadata or status changes to customer viewing rooms
   */
  static broadcastShopUpdate(shopSlug: string, data: any) {
    if (!this.io) return;
    this.io.to(`shop:${shopSlug}`).emit('shop:updated', data);
  }

  /**
   * Broadcasts customer UPI UTR / payment proof submission to Shop Owner dashboard
   */
  static broadcastUpiPaymentSubmitted(shopId: string, data: any) {
    if (!this.io) return;
    this.io.to(`shop:${shopId}`).emit('payment:upi_submitted', data);
  }

  /**
   * Broadcasts verified payment event to customer tracking view and shop dashboard
   */
  static broadcastPaymentVerified(orderNumber: string, shopId: string, paymentData: any) {
    if (!this.io) return;
    this.io.to(`order:${orderNumber}`).emit('payment:verified', paymentData);
    this.io.to(`shop:${shopId}`).emit('payment:verified', paymentData);
  }

  /**
   * Broadcasts job progress or completion status to customer and shop rooms
   */
  static broadcastJobStatus(job: any) {
    if (!this.io) return;
    if (job.order?.orderNumber) {
      this.io.to(`order:${job.order.orderNumber}`).emit('job:status', job);
    }
    this.io.to(`shop:${job.shopId || job.order?.shopId}`).emit('job:status', job);
  }

  static getIO(): SocketIOServer | undefined {
    return this.io;
  }
}
