import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { WebSocketService } from '../services/socket.service';

export class TicketController {
  private static async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.supportTicket.count();
    const seq = String(count + 1).padStart(6, '0');
    return `TICKET-${year}-${seq}`;
  }

  /**
   * Shop Owner / User - Create Support Ticket
   */
  static async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { category = 'OTHER', subject, description, priority = 'MEDIUM', shopId, attachments } = req.body;
      const userId = (req as any).user?.id || null;

      if (!subject || !description) {
        return res.status(400).json({ success: false, message: 'Subject and description are required' });
      }

      const ticketNumber = await TicketController.generateTicketNumber();
      const ticket = await prisma.supportTicket.create({
        data: {
          ticketNumber,
          category: String(category).toUpperCase(),
          subject: subject.trim(),
          description: description.trim(),
          priority: String(priority).toUpperCase(),
          status: 'OPEN',
          shopId: shopId || null,
          userId: userId || null,
          attachments: attachments ? JSON.stringify(attachments) : null,
          notes: JSON.stringify([
            {
              action: 'TICKET_CREATED',
              details: `Ticket opened by ${((req as any).user?.name) || 'Shop Owner'}`,
              author: ((req as any).user?.name) || 'User',
              date: new Date().toISOString(),
            },
          ]),
        },
        include: {
          shop: { select: { id: true, name: true, phone: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // Create Admin Notification
      await prisma.adminNotification.create({
        data: {
          type: 'SUPPORT',
          title: `Support Ticket: ${subject}`,
          message: `${ticket.shop?.name || 'Shop'}: ${category} issue (${priority})`,
          referenceId: ticket.id,
          link: '/admin/tickets',
        },
      }).catch(() => {});

      try {
        WebSocketService.getIO()?.emit('admin:notification', {
          type: 'SUPPORT',
          title: `Support Ticket: ${subject}`,
          ticketNumber,
          createdAt: new Date().toISOString(),
        });
      } catch {}

      return res.status(201).json({
        success: true,
        message: 'Support ticket submitted successfully',
        ticketNumber: ticket.ticketNumber,
        data: ticket,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Shop Owner - List My Support Tickets
   */
  static async listShopTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const { shopId } = req.query;
      const userId = (req as any).user?.id;

      const whereClause: any = {};
      if (shopId) {
        whereClause.shopId = String(shopId);
      } else if (userId) {
        whereClause.userId = String(userId);
      }

      const tickets = await prisma.supportTicket.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({ success: true, data: tickets });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin - List All Support Tickets with Filters
   */
  static async listAdminTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, category, status, priority } = req.query;
      const whereClause: any = {};

      if (category && category !== 'ALL') whereClause.category = String(category);
      if (status && status !== 'ALL') whereClause.status = String(status);
      if (priority && priority !== 'ALL') whereClause.priority = String(priority);

      if (search) {
        const query = String(search).trim();
        whereClause.OR = [
          { subject: { contains: query } },
          { description: { contains: query } },
          { ticketNumber: { contains: query } },
          { shop: { name: { contains: query } } },
        ];
      }

      const tickets = await prisma.supportTicket.findMany({
        where: whereClause,
        include: {
          shop: { select: { id: true, name: true, phone: true, email: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({ success: true, data: tickets });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin - Update Support Ticket (Reply, Status, Priority, AssignedTo)
   */
  static async updateAdminTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, priority, assignedTo, replyText } = req.body;

      const existing = await prisma.supportTicket.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Ticket not found' });
      }

      let currentNotes = [];
      try {
        currentNotes = existing.notes ? JSON.parse(existing.notes) : [];
      } catch {
        currentNotes = [];
      }

      if (replyText) {
        currentNotes.unshift({
          action: 'STAFF_REPLY',
          details: replyText,
          author: (req as any).user?.name || 'Support Specialist',
          date: new Date().toISOString(),
        });
      } else if (status && status !== existing.status) {
        currentNotes.unshift({
          action: 'STATUS_CHANGED',
          details: `Ticket status marked as ${status}`,
          author: (req as any).user?.name || 'Admin',
          date: new Date().toISOString(),
        });
      }

      const updated = await prisma.supportTicket.update({
        where: { id },
        data: {
          status: status || existing.status,
          priority: priority || existing.priority,
          assignedTo: assignedTo !== undefined ? assignedTo : existing.assignedTo,
          notes: JSON.stringify(currentNotes),
        },
        include: {
          shop: { select: { id: true, name: true, phone: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return res.status(200).json({ success: true, message: 'Ticket updated successfully', data: updated });
    } catch (err) {
      next(err);
    }
  }
}
