import { Router } from 'express';
import authRoutes from './auth.routes';
import shopRoutes from './shop.routes';
import fileRoutes from './file.routes';
import pricingRoutes from './pricing.routes';
import orderRoutes from './order.routes';
import printerRoutes from './printer.routes';
import adminRoutes from './admin.routes';
import paymentRoutes from './payment.routes';
import freePrintRoutes from './free-print.routes';
import agentRoutes from './agent.routes';
import legalRoutes from './legal.routes';
import { NavigationController } from '../controllers/navigation.controller';
import { BannerController } from '../controllers/banner.controller';
import { InquiryController } from '../controllers/inquiry.controller';
import { TicketController } from '../controllers/ticket.controller';
import { prisma } from '../prisma';

const router = Router();

router.use('/auth', authRoutes);
router.use('/shops', shopRoutes);
router.use('/files', fileRoutes);
router.use('/pricing', pricingRoutes);
router.use('/orders', orderRoutes);
router.use('/printers', printerRoutes);
router.use('/admin', adminRoutes);
router.use('/payments', paymentRoutes);
router.use('/free-print', freePrintRoutes);
router.use('/agents', agentRoutes);
router.use('/legal', legalRoutes);

// Public dynamic website navigation & banners
router.get('/navigation/public', NavigationController.listPublic);
router.get('/banners/public', BannerController.listPublic);

// Public contact inquiry, partner application & abandoned lead tracking
router.post('/inquiries/contact', InquiryController.submitContactInquiry);
router.post('/inquiries/partner', InquiryController.submitPartnerApplication);
router.post('/inquiries/shop-lead', InquiryController.trackShopRegistrationLead);

// Support ticket endpoints
router.post('/tickets', TicketController.createTicket);
router.get('/tickets/shop', TicketController.listShopTickets);

// Public dynamic website content endpoints
router.get('/plans/public', async (req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        name: { notIn: ['Demo', 'demo', 'DEMO'] },
      },
      orderBy: { priceMonthly: 'asc' },
    });
    const parsed = plans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.name.toLowerCase().replace(/\s+/g, '-'),
      description: p.description,
      price: p.priceMonthly ?? 0,
      priceMonthly: p.priceMonthly ?? 0,
      priceYearly: p.priceYearly ?? 0,
      currency: 'INR',
      billingType: 'Monthly',
      duration: 'Per Month',
      maxPrinters: p.maxPrinters,
      maxOrdersPerMonth: p.maxOrdersPerMonth,
      features: typeof p.features === 'string' ? JSON.parse(p.features) : (Array.isArray(p.features) ? p.features : []),
      isPopular: Boolean(p.isPopular),
      isBestValue: p.name.toLowerCase().includes('premium') || p.name.toLowerCase().includes('pro'),
      isActive: true,
    }));
    res.status(200).json({ success: true, data: parsed, plans: parsed });
  } catch {
    res.status(200).json({ success: true, data: [], plans: [] });
  }
});

router.get('/testimonials/public', async (req, res) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isApproved: true },
      orderBy: { displayOrder: 'asc' },
    });
    res.status(200).json({ success: true, data: testimonials });
  } catch {
    res.status(200).json({ success: true, data: [] });
  }
});

router.get('/demo-video/public', async (req, res) => {
  try {
    const video = await prisma.demoVideo.findFirst({ where: { isActive: true } });
    res.status(200).json({ success: true, data: video });
  } catch {
    res.status(200).json({ success: true, data: null });
  }
});

router.get('/statistics/public', async (req, res) => {
  try {
    const settings = await prisma.platformSetting.findMany();
    const map: Record<string, string> = {
      STATS_SHOPS: '450+',
      STATS_DOCS: '1.2M+',
      STATS_CUSTOMERS: '98%',
      STATS_CITIES: '35+',
    };
    settings.forEach((s) => {
      map[s.key] = s.value;
    });
    res.status(200).json({ success: true, data: map });
  } catch {
    res.status(200).json({ success: true, data: {} });
  }
});

// Health check endpoint
router.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return res.status(503).json({ success: false, status: 'unhealthy', service: 'AnishNova Print API Engine' });
  }
  return res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'AnishNova Print API Engine',
    version: '1.0.0',
    developedBy: 'AnishNova Technologies',
  });
});

// Dynamic XML Sitemap for SEO Indexing
router.get('/sitemap.xml', async (req, res) => {
  try {
    const legalPages = await prisma.legalPage.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
    });

    const publicUrls = [
      { loc: '/', changefreq: 'daily', priority: '1.0' },
      { loc: '/#pricing', changefreq: 'weekly', priority: '0.8' },
      { loc: '/#features', changefreq: 'weekly', priority: '0.8' },
      { loc: '/#how-it-works', changefreq: 'weekly', priority: '0.8' },
      { loc: '/#windows-agent', changefreq: 'monthly', priority: '0.7' },
      { loc: '/shop/register', changefreq: 'monthly', priority: '0.9' },
    ];

    legalPages.forEach((p) => {
      publicUrls.push({
        loc: `/${p.slug}`,
        changefreq: 'monthly',
        priority: '0.5',
      });
    });

    const host = (req.get('host') || 'localhost:5000').includes('localhost') ? 'https://anishnovaprint.com' : `https://${req.get('host')}`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    publicUrls.forEach((u) => {
      xml += `  <url>\n`;
      xml += `    <loc>${host}${u.loc}</loc>\n`;
      xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
      xml += `    <priority>${u.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    return res.status(200).send(xml);
  } catch (err) {
    return res.status(500).send('<error>Failed to generate sitemap</error>');
  }
});

export default router;
