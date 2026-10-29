import { Request, Response } from 'express';
import { prisma } from '../prisma';

const DEFAULT_LEGAL_PAGES = [
  {
    slug: 'terms',
    title: 'Terms of Service',
    metaTitle: 'Terms of Service — AnishNova Print',
    metaDescription: 'Read the terms and conditions for using the AnishNova Print contactless printing platform.',
    status: 'PUBLISHED',
    content: `# Terms of Service — AnishNova Print
*Last updated: August 23, 2026*

Welcome to **AnishNova Print**, operated and owned by **AnishNova Technologies** ("we", "us", "our"). By accessing or using our website, customer print interface, shop dashboard, and Windows desktop print agents, you agree to comply with and be bound by these Terms of Service.

---

### 1. Platform Purpose & Services
AnishNova Print provides a contactless document uploading and automated printing dispatch platform connecting walk-in customers with registered independent print and xerox merchants. 

- **For Customers**: Enables instant upload of supported documents (PDF, Word, Images), color/duplex formatting selection, and direct UPI payments to shop accounts.
- **For Shop Merchants**: Enables receipt of customer print jobs, native Windows print spooler dispatch via PrintQRAgent, real-time queue management, and per-page rate configuration.

---

### 2. User Accounts & Responsibilities
- **Merchant Accounts**: Shop owners must provide accurate business credentials, valid UPI identification, and maintain physical printer hardware in operating condition.
- **Customer Privacy**: Customers are responsible for verifying that uploaded files comply with Indian intellectual property laws and copyright regulations.

---

### 3. File Privacy & Data Retention
- Documents uploaded by customers are encrypted during transit (TLS 1.3).
- Uploaded files are temporarily cached for printing dispatch and **permanently deleted** from our cloud servers after the physical print job is acknowledged by the local print spooler or after 24 hours.
- We do not read, analyze, share, or monetize customer document contents.

---

### 4. Payments & Billing
- **Direct UPI**: Customer payments go directly to the respective shopkeeper's UPI VPA. AnishNova Technologies is not an intermediary custodian of customer-to-merchant printing funds for Direct UPI transactions.
- **SaaS Subscriptions**: Merchant platform subscriptions are billed according to the chosen active plan (Monthly / Yearly).

---

### 5. Limitation of Liability
AnishNova Technologies shall not be held liable for physical printer hardware jams, ink exhaustion, customer paper selection mismatches, or power outages at individual merchant premises.

---

### 6. Contact & Grievance
For any questions regarding these Terms, reach out to **legal@anishnova.com** or **AnishNova Technologies Support Desk**.`,
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    metaTitle: 'Privacy Policy — AnishNova Print',
    metaDescription: 'Learn how AnishNova Technologies protects your data and document privacy during contactless printing.',
    status: 'PUBLISHED',
    content: `# Privacy Policy — AnishNova Print
*Last updated: August 23, 2026*

**AnishNova Technologies** is committed to protecting your privacy and ensuring your documents remain secure and confidential. This Privacy Policy describes how we handle information collected through the **AnishNova Print** platform.

---

### 1. Information We Collect
- **Customer Information**: When uploading documents for printing, we collect only the necessary print metadata (file name, page count, color preferences, duplex options) and transaction reference number.
- **Shop Merchant Information**: Business name, owner name, email address, mobile number, physical shop address, UPI VPA identifier, and connected printer device names.
- **Technical Logs**: Temporary IP address, user-agent, and spooler connection heartbeats.

---

### 2. Zero Document Storage Policy
- Customer files uploaded via QR scan are used **solely** for rendering and spooling to the shop's physical printer.
- Once printed, files are automatically purged.
- No files are ever shared with third-party advertising networks.

---

### 3. Payment Data Security
- For Direct UPI transactions, payments happen peer-to-peer between customer UPI applications and merchant UPI VPAs.
- We never store credit card numbers, UPI PINs, or sensitive banking passwords.

---

### 4. Data Security Standards
We enforce industry-standard security protocols:
- HTTPS / TLS 1.3 encryption across all public web endpoints and WebSocket spooler bridges.
- Ephemeral storage keys with time-limited signed access URLs.
- Role-based access controls (RBAC) protecting admin and shop dashboard access.

---

### 5. Updates to Policy
Any updates to this policy will be posted on this page with an updated timestamp.

---

### 6. Privacy Officer Contact
If you have privacy concerns or wish to request data erasure, contact us at **privacy@anishnova.com**.`,
  },
  {
    slug: 'refund-policy',
    title: 'Refund & Cancellation Policy',
    metaTitle: 'Refund & Cancellation Policy — AnishNova Print',
    metaDescription: 'Refund and cancellation guidelines for customer prints and SaaS subscriptions on AnishNova Print.',
    status: 'PUBLISHED',
    content: `# Refund & Cancellation Policy — AnishNova Print
*Last updated: August 23, 2026*

This Refund and Cancellation Policy outlines the conditions under which refunds are handled for customer print jobs and merchant SaaS subscriptions.

---

### 1. Customer Print Job Refunds
- **Hardware Faults**: If a print job fails due to a local physical printer failure (paper jam, out of paper, out of ink) after payment verification, the customer should inform the shop counter staff immediately. The shop owner can reprint the job directly from their dashboard or issue a spot cash/UPI refund.
- **Customer Cancellation**: Because document processing and printing dispatch happens instantaneously upon payment, print jobs cannot be cancelled once the physical printing process has commenced.

---

### 2. Merchant SaaS Plan Subscriptions
- **7-Day Satisfaction Period**: New shop owners who subscribe to an AnishNova Print SaaS tier (Starter, Pro, Premium) can request a full refund within 7 days of initial subscription if technical integration cannot be completed on their Windows PC.
- **Billing Cancellations**: Merchants can cancel recurring SaaS subscriptions at any time from their Shop Dashboard. Access will remain active until the end of the current paid billing cycle.

---

### 3. Contact Support
For refund reconciliation requests or billing questions, email **billing@anishnova.com** with your order or shop reference ID.`,
  },
  {
    slug: 'contact',
    title: 'Contact Us',
    metaTitle: 'Contact AnishNova Technologies — AnishNova Print',
    metaDescription: 'Get in touch with AnishNova Technologies for support, partnerships, and counter setup.',
    status: 'PUBLISHED',
    content: `# Contact AnishNova Technologies
*We are here to help your print shop scale.*

### Head Office
**AnishNova Technologies**  
Bangalore / Delhi NCR, India  
Email: **support@anishnova.com**  
Partnerships: **partners@anishnova.com**  
Technical Helpdesk: **help@anishnova.com**  

---

### Business Hours
- **Monday – Saturday**: 9:00 AM – 8:00 PM IST
- **Sunday**: Technical Spooler Monitoring & Emergency Helpdesk Active
- **Response Time**: We respond to all online merchant enquiries within 2 hours.`,
  },
];

export class LegalController {
  /**
   * Seed default legal pages if database table is empty
   */
  static async seedDefaultPagesIfEmpty() {
    try {
      const count = await prisma.legalPage.count();
      if (count === 0) {
        for (const p of DEFAULT_LEGAL_PAGES) {
          await prisma.legalPage.create({
            data: {
              slug: p.slug,
              title: p.title,
              content: p.content,
              metaTitle: p.metaTitle,
              metaDescription: p.metaDescription,
              status: p.status,
            },
          });
        }
        console.log('📄 Seeded default AnishNova Print legal pages');
      }
    } catch (err) {
      console.error('Failed to seed legal pages:', err);
    }
  }

  /**
   * Public: List all published legal pages for footer navigation
   */
  static async getPublishedList(req: Request, res: Response) {
    try {
      await LegalController.seedDefaultPagesIfEmpty();
      const pages = await prisma.legalPage.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          slug: true,
          title: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      return res.json({ success: true, data: pages });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Public: Get published legal page by slug
   */
  static async getPublishedPageBySlug(req: Request, res: Response) {
    try {
      await LegalController.seedDefaultPagesIfEmpty();
      const { slug } = req.params;
      const page = await prisma.legalPage.findUnique({
        where: { slug },
      });

      if (!page || page.status !== 'PUBLISHED') {
        return res.status(404).json({ success: false, error: 'Legal page not found or unpublished' });
      }

      return res.json({ success: true, data: page });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Admin: List all legal pages (Drafts and Published)
   */
  static async listAllForAdmin(req: Request, res: Response) {
    try {
      await LegalController.seedDefaultPagesIfEmpty();
      const pages = await prisma.legalPage.findMany({
        orderBy: { createdAt: 'asc' },
      });
      return res.json({ success: true, data: pages });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Admin: Get single legal page by ID
   */
  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const page = await prisma.legalPage.findUnique({ where: { id } });
      if (!page) {
        return res.status(404).json({ success: false, error: 'Page not found' });
      }
      return res.json({ success: true, data: page });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Admin: Create or Update Legal Page
   */
  static async upsertPage(req: Request, res: Response) {
    try {
      const { id, slug, title, content, metaTitle, metaDescription, status } = req.body;
      if (!slug || !title || !content) {
        return res.status(400).json({ success: false, error: 'Slug, title, and content are required' });
      }

      let page;
      if (id) {
        page = await prisma.legalPage.update({
          where: { id },
          data: {
            slug: slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-'),
            title,
            content,
            metaTitle,
            metaDescription,
            status: status || 'PUBLISHED',
          },
        });
      } else {
        page = await prisma.legalPage.upsert({
          where: { slug: slug.toLowerCase().trim() },
          update: {
            title,
            content,
            metaTitle,
            metaDescription,
            status: status || 'PUBLISHED',
          },
          create: {
            slug: slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-'),
            title,
            content,
            metaTitle,
            metaDescription,
            status: status || 'PUBLISHED',
          },
        });
      }

      return res.json({ success: true, data: page, message: 'Legal page saved successfully' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Admin: Update Legal Page Status (Toggle Publish/Draft)
   */
  static async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!['DRAFT', 'PUBLISHED'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      const page = await prisma.legalPage.update({
        where: { id },
        data: { status },
      });

      return res.json({ success: true, data: page, message: `Page status set to ${status}` });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Admin: Delete Legal Page
   */
  static async deletePage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.legalPage.delete({ where: { id } });
      return res.json({ success: true, message: 'Page deleted successfully' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
