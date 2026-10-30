import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { NavigationController } from '../controllers/navigation.controller';
import { BannerController } from '../controllers/banner.controller';
import { InquiryController } from '../controllers/inquiry.controller';
import { TicketController } from '../controllers/ticket.controller';
import { DiagnosticsController } from '../controllers/diagnostics.controller';
import { LegalController } from '../controllers/legal.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';

const router = Router();

// Public agent download route - streams the actual .exe binary
router.get('/agents/download/latest', AdminController.downloadLatestAgent);
router.get('/agents/download/binary/latest', AdminController.downloadLatestAgentBinary);

// Protected Admin Routes
router.use(authenticate, requireAdmin);

router.get('/metrics', AdminController.getPlatformMetrics);
router.get('/shops', AdminController.listShops);
router.post('/shops/create', AdminController.createShop);
router.post('/shops/:shopId/impersonate', AdminController.impersonateShopLogin);
router.patch('/shops/:shopId/status', AdminController.updateShopStatus);

// Agent Releases & Fleet Monitoring
router.get('/agents/releases', AdminController.listAgentReleases);
router.get('/agents/monitoring', AdminController.getAgentMonitoringDetails);

// SaaS Plans
router.get('/plans', AdminController.listPlans);
router.post('/plans', AdminController.savePlan);

// Testimonials
router.get('/testimonials', AdminController.listTestimonials);
router.post('/testimonials', AdminController.saveTestimonial);
router.delete('/testimonials/:id', AdminController.deleteTestimonial);

// Demo Video
router.get('/demo-video', AdminController.getDemoVideo);
router.post('/demo-video', AdminController.saveDemoVideo);

// Platform Settings & Stats
router.get('/settings', AdminController.getPlatformSettings);
router.put('/settings/batch', AdminController.savePlatformSettingsBatch);
router.post('/settings', AdminController.savePlatformSetting);

// Website Navigation Manager
router.get('/navigation', NavigationController.listAll);
router.post('/navigation', NavigationController.saveItem);
router.delete('/navigation/:id', NavigationController.deleteItem);

// Homepage Banners Manager
router.get('/banners', BannerController.listAll);
router.post('/banners', BannerController.saveBanner);
router.delete('/banners/:id', BannerController.deleteBanner);

// Contact Inquiries, Partner CRM & Lead Management
router.get('/inquiries', InquiryController.listContactInquiries);
router.get('/leads', InquiryController.listContactInquiries);
router.get('/leads/:id', InquiryController.getLeadById);
router.patch('/leads/:id', InquiryController.updateLead);

router.get('/partner-applications', InquiryController.listPartnerApplications);
router.get('/partners', InquiryController.listPartnerApplications);
router.patch('/partners/:id', InquiryController.updatePartnerApplication);

router.get('/shop-leads', InquiryController.listShopRegistrationLeads);
router.get('/crm/kpis', InquiryController.getCRMStats);

// Real-time Admin Notifications
router.get('/notifications', InquiryController.listAdminNotifications);
router.patch('/notifications/:id/read', InquiryController.markNotificationRead);

// Support Tickets Management
router.get('/tickets', TicketController.listAdminTickets);
router.patch('/tickets/:id', TicketController.updateAdminTicket);

// System Health & Diagnostics Suite
router.get('/diagnostics', DiagnosticsController.runDiagnostics);

// Coupons
router.get('/coupons', AdminController.listCoupons);
router.post('/coupons', AdminController.createCoupon);

// Legal Pages Management
router.get('/legal', LegalController.listAllForAdmin);
router.get('/legal/:id', LegalController.getById);
router.post('/legal', LegalController.upsertPage);
router.patch('/legal/:id', LegalController.upsertPage);
router.patch('/legal/:id/status', LegalController.updateStatus);
router.delete('/legal/:id', LegalController.deletePage);

export default router;
