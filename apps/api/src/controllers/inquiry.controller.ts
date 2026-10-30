import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { WebSocketService } from '../services/socket.service';

export class InquiryController {
  /**
   * Helper to generate unique sequential formatted reference IDs
   */
  private static async generateLeadNumber(prefix: string = 'LEAD'): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.contactInquiry.count();
    const seq = String(count + 1).padStart(6, '0');
    return `${prefix}-${year}-${seq}`;
  }

  private static async generatePartnerNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.partnerApplication.count();
    const seq = String(count + 1).padStart(6, '0');
    return `PARTNER-${year}-${seq}`;
  }

  private static async generateShopLeadNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.shopRegistrationLead.count();
    const seq = String(count + 1).padStart(6, '0');
    return `SHOP-${year}-${seq}`;
  }

  /**
   * Public Contact Us Form Submission
   */
  static async submitContactInquiry(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        name,
        email,
        phone,
        shopName,
        city,
        subject,
        message,
        type = 'CONTACT',
        priority = 'MEDIUM',
        source = 'Website Contact Form',
        utmSource,
        utmMedium,
        utmCampaign,
      } = req.body;

      if (!name || !email || !message) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and message are required',
        });
      }

      // Duplicate prevention: check if same email and message submitted in the last 2 minutes
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const existing = await prisma.contactInquiry.findFirst({
        where: {
          email: email.toLowerCase(),
          message,
          createdAt: { gte: twoMinutesAgo },
        },
      });

      if (existing) {
        return res.status(200).json({
          success: true,
          message: 'Your inquiry has already been received! Our team is reviewing it.',
          leadNumber: existing.leadNumber,
          data: existing,
        });
      }

      const leadNumber = await InquiryController.generateLeadNumber('LEAD');
      const initialTimeline = [
        {
          action: 'LEAD_CREATED',
          details: `Enquiry submitted via ${source}`,
          author: 'System',
          date: new Date().toISOString(),
        },
      ];

      const inquiry = await prisma.contactInquiry.create({
        data: {
          leadNumber,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone ? String(phone).trim() : null,
          shopName: shopName ? String(shopName).trim() : null,
          city: city ? String(city).trim() : null,
          subject: subject ? String(subject).trim() : 'Website Enquiry',
          message: message.trim(),
          type: String(type).toUpperCase(),
          priority: String(priority).toUpperCase(),
          status: 'NEW',
          source,
          utmSource: utmSource || null,
          utmMedium: utmMedium || null,
          utmCampaign: utmCampaign || null,
          notes: JSON.stringify(initialTimeline),
        },
      });

      // Create Admin Notification
      await prisma.adminNotification.create({
        data: {
          type: 'LEAD',
          title: `New Lead: ${name}`,
          message: `${subject || 'Enquiry'} from ${email} (${city || 'India'})`,
          referenceId: inquiry.id,
          link: '/admin/leads',
        },
      }).catch(() => {});

      // Broadcast live event to Super Admin dashboard if socket is available
      try {
        WebSocketService.getIO()?.emit('admin:notification', {
          type: 'LEAD',
          title: `New Lead: ${name}`,
          leadNumber,
          createdAt: new Date().toISOString(),
        });
      } catch {}

      return res.status(201).json({
        success: true,
        message: 'Thank you for reaching out! Your inquiry has been registered.',
        leadNumber: inquiry.leadNumber,
        data: inquiry,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public Partner Program Application Submission
   */
  static async submitPartnerApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        name,
        email,
        phone,
        city,
        state,
        businessName,
        businessType = 'XEROX_CHAIN',
        printerCount = 2,
        monthlyVolume = '500-2000',
        message,
      } = req.body;

      if (!name || !email || !phone || !city) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, phone, and city are required for partner registration',
        });
      }

      const partnerNumber = await InquiryController.generatePartnerNumber();
      const initialTimeline = [
        {
          action: 'PARTNER_APPLIED',
          details: `Partner application submitted for ${businessName || name} in ${city}`,
          author: 'System',
          date: new Date().toISOString(),
        },
      ];

      const application = await prisma.partnerApplication.create({
        data: {
          partnerNumber,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: String(phone).trim(),
          city: String(city).trim(),
          state: state ? String(state).trim() : null,
          businessName: businessName ? String(businessName).trim() : null,
          businessType: String(businessType),
          printerCount: Number(printerCount) || 2,
          monthlyVolume: String(monthlyVolume),
          message: message ? String(message).trim() : null,
          status: 'NEW',
          priority: 'HIGH',
          notes: JSON.stringify(initialTimeline),
        },
      });

      // Create Admin Notification
      await prisma.adminNotification.create({
        data: {
          type: 'PARTNER',
          title: `Partner Application: ${businessName || name}`,
          message: `${city}, ${state || 'India'} • ${phone}`,
          referenceId: application.id,
          link: '/admin/partners',
        },
      }).catch(() => {});

      try {
        WebSocketService.getIO()?.emit('admin:notification', {
          type: 'PARTNER',
          title: `New Partner: ${businessName || name}`,
          partnerNumber,
          createdAt: new Date().toISOString(),
        });
      } catch {}

      return res.status(201).json({
        success: true,
        message: 'Partner program application submitted! Our franchise director will connect with you.',
        partnerNumber: application.partnerNumber,
        data: application,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Track Incomplete / Abandoned Shop Registration
   */
  static async trackShopRegistrationLead(req: Request, res: Response, next: NextFunction) {
    try {
      const { shopName, ownerName, email, phone, city, selectedPlan, step = 'STARTED' } = req.body;

      if (!email && !phone && !shopName) {
        return res.status(400).json({ success: false, message: 'At least one contact identifier is required' });
      }

      // Check if lead already exists by email/phone
      let lead = null;
      if (email) {
        lead = await prisma.shopRegistrationLead.findFirst({
          where: { email: email.toLowerCase() },
        });
      }

      if (lead) {
        lead = await prisma.shopRegistrationLead.update({
          where: { id: lead.id },
          data: {
            shopName: shopName || lead.shopName,
            ownerName: ownerName || lead.ownerName,
            phone: phone || lead.phone,
            city: city || lead.city,
            selectedPlan: selectedPlan || lead.selectedPlan,
            step,
            status: step === 'COMPLETED' ? 'CONVERTED' : 'NEW',
          },
        });
      } else {
        const leadNumber = await InquiryController.generateShopLeadNumber();
        lead = await prisma.shopRegistrationLead.create({
          data: {
            leadNumber,
            shopName: shopName || null,
            ownerName: ownerName || null,
            email: email ? email.toLowerCase() : null,
            phone: phone || null,
            city: city || null,
            selectedPlan: selectedPlan || 'Starter',
            step,
            status: step === 'COMPLETED' ? 'CONVERTED' : 'NEW',
          },
        });
      }

      return res.status(200).json({ success: true, leadNumber: lead.leadNumber, data: lead });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin - List All Leads with Search, Filters, and Pagination
   */
  static async listContactInquiries(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status, type, priority, page = '1', limit = '50' } = req.query;

      const whereClause: any = {};

      if (status && status !== 'ALL') {
        whereClause.status = String(status);
      }
      if (type && type !== 'ALL') {
        whereClause.type = String(type);
      }
      if (priority && priority !== 'ALL') {
        whereClause.priority = String(priority);
      }
      if (search) {
        const query = String(search).trim();
        whereClause.OR = [
          { name: { contains: query } },
          { email: { contains: query } },
          { phone: { contains: query } },
          { shopName: { contains: query } },
          { city: { contains: query } },
          { leadNumber: { contains: query } },
          { subject: { contains: query } },
        ];
      }

      const pageNum = Math.max(1, parseInt(String(page)) || 1);
      const takeLimit = Math.max(1, parseInt(String(limit)) || 50);
      const skipCount = (pageNum - 1) * takeLimit;

      const [leads, totalCount] = await Promise.all([
        prisma.contactInquiry.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip: skipCount,
          take: takeLimit,
        }),
        prisma.contactInquiry.count({ where: whereClause }),
      ]);

      return res.status(200).json({
        success: true,
        data: leads,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: takeLimit,
          pages: Math.ceil(totalCount / takeLimit),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin - Get Lead Details
   */
  static async getLeadById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const lead = await prisma.contactInquiry.findUnique({ where: { id } });
      if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      let parsedNotes = [];
      try {
        parsedNotes = lead.notes ? JSON.parse(lead.notes) : [];
      } catch {
        parsedNotes = [];
      }

      return res.status(200).json({
        success: true,
        data: {
          ...lead,
          activityTimeline: parsedNotes,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin - Update Lead (Status, Priority, AssignedTo, Append Note)
   */
  static async updateLead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, priority, assignedTo, noteText, noteAction = 'NOTE_ADDED' } = req.body;

      const existing = await prisma.contactInquiry.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      let currentNotes = [];
      try {
        currentNotes = existing.notes ? JSON.parse(existing.notes) : [];
      } catch {
        currentNotes = [];
      }

      if (noteText || status !== existing.status || priority !== existing.priority) {
        currentNotes.unshift({
          action: noteAction,
          details: noteText || `Status updated from ${existing.status} to ${status}`,
          author: (req as any).user?.name || 'Admin',
          date: new Date().toISOString(),
        });
      }

      const updated = await prisma.contactInquiry.update({
        where: { id },
        data: {
          status: status || existing.status,
          priority: priority || existing.priority,
          assignedTo: assignedTo !== undefined ? assignedTo : existing.assignedTo,
          notes: JSON.stringify(currentNotes),
        },
      });

      return res.status(200).json({ success: true, message: 'Lead updated successfully', data: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin - List Partner Applications
   */
  static async listPartnerApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status } = req.query;
      const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '50'), 10) || 50));
      const whereClause: any = {};

      if (status && status !== 'ALL') {
        whereClause.status = String(status);
      }
      if (search) {
        const query = String(search).trim();
        whereClause.OR = [
          { name: { contains: query } },
          { email: { contains: query } },
          { phone: { contains: query } },
          { businessName: { contains: query } },
          { city: { contains: query } },
          { partnerNumber: { contains: query } },
        ];
      }

      const [applications, total] = await Promise.all([
        prisma.partnerApplication.findMany({ where: whereClause, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.partnerApplication.count({ where: whereClause }),
      ]);
      return res.status(200).json({ success: true, data: applications, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin - Update Partner Application
   */
  static async updatePartnerApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, assignedTo, noteText } = req.body;

      const existing = await prisma.partnerApplication.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Partner application not found' });
      }

      let currentNotes = [];
      try {
        currentNotes = existing.notes ? JSON.parse(existing.notes) : [];
      } catch {
        currentNotes = [];
      }

      if (noteText || status !== existing.status) {
        currentNotes.unshift({
          action: 'STATUS_CHANGED',
          details: noteText || `Partner status updated to ${status}`,
          author: (req as any).user?.name || 'Admin',
          date: new Date().toISOString(),
        });
      }

      const updated = await prisma.partnerApplication.update({
        where: { id },
        data: {
          status: status || existing.status,
          assignedTo: assignedTo !== undefined ? assignedTo : existing.assignedTo,
          notes: JSON.stringify(currentNotes),
        },
      });

      return res.status(200).json({ success: true, message: 'Partner status updated', data: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin - List Incomplete Shop Leads
   */
  static async listShopRegistrationLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const leads = await prisma.shopRegistrationLead.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json({ success: true, data: leads });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin - Real KPI Dashboard Analytics
   */
  static async getCRMStats(req: Request, res: Response, next: NextFunction) {
    try {
      const [
        totalLeads,
        newLeads,
        inProgressLeads,
        convertedLeads,
        totalPartners,
        newPartners,
        totalShopLeads,
        abandonedShopLeads,
        openTickets,
        resolvedTickets,
        unreadNotifications,
      ] = await Promise.all([
        prisma.contactInquiry.count(),
        prisma.contactInquiry.count({ where: { status: 'NEW' } }),
        prisma.contactInquiry.count({ where: { status: { in: ['CONTACTED', 'IN_PROGRESS', 'FOLLOW_UP'] } } }),
        prisma.contactInquiry.count({ where: { status: 'CONVERTED' } }),
        prisma.partnerApplication.count(),
        prisma.partnerApplication.count({ where: { status: 'NEW' } }),
        prisma.shopRegistrationLead.count(),
        prisma.shopRegistrationLead.count({ where: { status: 'ABANDONED' } }),
        prisma.supportTicket.count({ where: { status: 'OPEN' } }),
        prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
        prisma.adminNotification.count({ where: { isRead: false } }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          totalLeads,
          newLeads,
          inProgressLeads,
          convertedLeads,
          totalPartners,
          newPartners,
          totalShopLeads,
          abandonedShopLeads,
          openTickets,
          resolvedTickets,
          unreadNotifications,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin - List Notifications
   */
  static async listAdminNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const notifications = await prisma.adminNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      const unreadCount = await prisma.adminNotification.count({ where: { isRead: false } });

      return res.status(200).json({
        success: true,
        data: notifications,
        unreadCount,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Super Admin - Mark Notification as Read
   */
  static async markNotificationRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (id === 'all') {
        await prisma.adminNotification.updateMany({
          where: { isRead: false },
          data: { isRead: true },
        });
      } else {
        await prisma.adminNotification.update({
          where: { id },
          data: { isRead: true },
        });
      }

      return res.status(200).json({ success: true, message: 'Notification marked as read' });
    } catch (err) {
      next(err);
    }
  }
}
