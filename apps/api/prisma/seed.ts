import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import dotenv from 'dotenv';

dotenv.config();

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo seeding is disabled in production. Use the one-time admin provisioning command and approved production migrations.');
}
if (process.env.ALLOW_DEMO_SEED !== 'true') {
  throw new Error('Set ALLOW_DEMO_SEED=true only for an isolated development database before running the demo seed.');
}

const shopOwnerEmail = process.env.SEED_SHOP_OWNER_EMAIL?.trim().toLowerCase();
const shopOwnerPassword = process.env.SEED_SHOP_OWNER_PASSWORD;
const staffEmail = process.env.SEED_STAFF_EMAIL?.trim().toLowerCase();
const staffPassword = process.env.SEED_STAFF_PASSWORD;
if (!shopOwnerEmail || !staffEmail || !shopOwnerPassword || !staffPassword || shopOwnerPassword.length < 12 || staffPassword.length < 12) {
  throw new Error('Provide separate SEED_SHOP_OWNER_EMAIL/PASSWORD and SEED_STAFF_EMAIL/PASSWORD values (passwords must be at least 12 characters).');
}

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting AnishNova Print platform database seeding...');

  // 1. Password Hashing
  const shopPasswordHash = await bcrypt.hash(shopOwnerPassword, 12);
  const staffPasswordHash = await bcrypt.hash(staffPassword, 12);

  // Demo shop and staff accounts are created only on explicitly opted-in development databases.
  const shopOwner = await prisma.user.upsert({
    where: { email: shopOwnerEmail },
    update: {},
    create: {
      email: shopOwnerEmail,
      passwordHash: shopPasswordHash,
      name: 'Rajesh Sharma',
      phone: '9812345678',
      role: 'SHOP_OWNER',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { email: staffEmail },
    update: {},
    create: {
      email: staffEmail,
      passwordHash: staffPasswordHash,
      name: 'Amit Kumar',
      phone: '9812345679',
      role: 'SHOP_STAFF',
    },
  });

  // 5. Create SaaS Subscription Plans
  const plans = [
    {
      name: 'Demo',
      description: 'Perfect for single counter shops starting with contactless QR printing.',
      priceMonthly: 0,
      priceYearly: 0,
      maxPrinters: 1,
      maxOrdersPerMonth: 50,
      features: JSON.stringify([
        '1 Windows Printer Connection',
        'Up to 50 monthly customer orders',
        'Standard Counter QR stand flyer',
        'Direct UPI QR Payments',
        'Community Support',
      ]),
      isPopular: false,
    },
    {
      name: 'Starter',
      description: 'Designed for college campus stationery and photocopy centers.',
      priceMonthly: 649,
      priceYearly: 6490,
      maxPrinters: 2,
      maxOrdersPerMonth: 500,
      features: JSON.stringify([
        '2 Printer Connections',
        'Up to 500 monthly orders',
        'Custom Standee Flyer Designer',
        'Instant Windows Spooler Dispatch',
        'SMS & WhatsApp notifications',
        'Standard Email Support',
      ]),
      isPopular: false,
    },
    {
      name: 'Pro',
      description: 'Most popular for commercial digital print centers and busy cyber cafes.',
      priceMonthly: 799,
      priceYearly: 7990,
      maxPrinters: 5,
      maxOrdersPerMonth: 2500,
      features: JSON.stringify([
        '5 Printer Connections',
        'Up to 2,500 monthly orders',
        'Offline Queue Buffer',
        'Duplex & Color Multi-Machine Routing',
        'Staff Operator Accounts',
        'Priority Support',
      ]),
      isPopular: true,
    },
    {
      name: 'Premium',
      description: 'Enterprise grade for multi-branch printing hubs and mega xerox centers.',
      priceMonthly: 999,
      priceYearly: 9990,
      maxPrinters: 15,
      maxOrdersPerMonth: 10000,
      features: JSON.stringify([
        'Unlimited Printer Connections',
        'Unlimited monthly orders',
        'Custom Store Domain Support',
        'Dedicated Windows Background Daemon',
        'Full Revenue Analytics',
        '24/7 Dedicated Support',
      ]),
      isPopular: false,
    },
  ];

  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: p.name },
      update: p,
      create: p,
    });
  }
  console.log('✅ Created Subscription Plans');

  const proPlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'Pro' } });

  // 6. Create Demo Shop: ABC Digital Print
  const shopSlug = 'abc-digital-print';
  const qrTargetUrl = `http://localhost:5173/print/${shopSlug}`;
  const qrDataUrl = await QRCode.toDataURL(qrTargetUrl, {
    margin: 1,
    width: 400,
    color: {
      dark: '#1e293b',
      light: '#ffffff',
    },
  });

  const shop = await prisma.shop.upsert({
    where: { slug: shopSlug },
    update: {
      isOnline: true,
      status: 'ACTIVE',
    },
    create: {
      name: 'ABC Digital Print',
      slug: shopSlug,
      ownerId: shopOwner.id,
      email: shopOwnerEmail,
      phone: '9812345678',
      address: 'Shop No. 14, Galaxy Commercial Complex, Near University Metro Gate',
      city: 'Bengaluru',
      state: 'Karnataka',
      pin: '560001',
      gst: '29ABCDE1234F1Z5',
      logoUrl: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=200&auto=format&fit=crop&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=1200&auto=format&fit=crop&q=80',
      status: 'ACTIVE',
      isOnline: true,
      startingPrice: 2.0,
      businessHours: JSON.stringify({
        open: '08:30 AM',
        close: '09:30 PM',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        is24Hours: false,
      }),
    },
  });
  console.log('✅ Created Demo Shop:', shop.name, `(${shop.slug})`);

  // Link Staff with Permissions
  await prisma.shopStaff.upsert({
    where: { shopId_userId: { shopId: shop.id, userId: staffUser.id } },
    update: {},
    create: {
      shopId: shop.id,
      userId: staffUser.id,
      role: 'OPERATOR',
      permissions: 'orders.view,orders.manage,printing.view,printing.retry',
      isActive: true,
    },
  });

  // Shop Subscription
  if (proPlan) {
    const existingSub = await prisma.shopSubscription.findFirst({ where: { shopId: shop.id } });
    if (!existingSub) {
      await prisma.shopSubscription.create({
        data: {
          shopId: shop.id,
          planId: proPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  // 7. Create QR Code Record
  await prisma.qRCodeRecord.upsert({
    where: { code: 'QR-ABC-COUNTER1' },
    update: { qrDataUrl, targetUrl: qrTargetUrl },
    create: {
      code: 'QR-ABC-COUNTER1',
      shopId: shop.id,
      targetUrl: qrTargetUrl,
      label: 'Main Shop Counter QR',
      qrDataUrl,
      scanCount: 142,
    },
  });

  // 8. Create Demo Printers
  const demoPrinters = [
    {
      name: 'HP LaserJet Pro M404dn (High-Speed B&W)',
      model: 'HP LaserJet Pro M404dn',
      connectionType: 'USB',
      status: 'ONLINE',
      isDefault: true,
      supportsColor: false,
      supportsDuplex: true,
      supportedSizes: 'A4,A5,LETTER,LEGAL',
      inkLevel: 92,
      paperLevel: 80,
      totalJobsPrinted: 1240,
    },
    {
      name: 'Canon PIXMA G6070 (Color Laser & Photo)',
      model: 'Canon PIXMA G6070 Series',
      connectionType: 'NETWORK_IP',
      status: 'ONLINE',
      isDefault: false,
      supportsColor: true,
      supportsDuplex: true,
      supportedSizes: 'A4,A3,A5,LETTER',
      inkLevel: 78,
      paperLevel: 95,
      totalJobsPrinted: 654,
    },
  ];

  const createdPrinters = [];
  for (const pr of demoPrinters) {
    const existing = await prisma.printer.findFirst({
      where: { shopId: shop.id, name: pr.name },
    });
    if (!existing) {
      const created = await prisma.printer.create({
        data: { ...pr, shopId: shop.id },
      });
      createdPrinters.push(created);
    } else {
      createdPrinters.push(existing);
    }
  }

  // 9. Create Windows Printer Agent Pairing Record
  await prisma.printerAgent.upsert({
    where: { pairingCode: '123456' },
    update: {
      status: 'CONNECTED',
      lastHeartbeat: new Date(),
    },
    create: {
      shopId: shop.id,
      pairingCode: '123456',
      agentToken: 'agent_tok_demo_abc_digital_print_2026',
      deviceName: 'DESKTOP-ABC-COUNTER1',
      ipAddress: '192.168.1.105',
      osVersion: 'Microsoft Windows 11 Pro 64-bit (10.0.22631)',
      agentVersion: '1.0.0',
      status: 'CONNECTED',
    },
  });

  // 10. Create Pricing Rules (Global & Shop Specific)
  const defaultRules = [
    { paperSize: 'A4', colorMode: 'BW', singleSidePrice: 2.0, duplexPrice: 3.5, duplexDiscountPercent: 12.5, bulkMinPages: 50, bulkDiscountPercent: 10 },
    { paperSize: 'A4', colorMode: 'COLOR', singleSidePrice: 10.0, duplexPrice: 18.0, duplexDiscountPercent: 10.0, bulkMinPages: 25, bulkDiscountPercent: 15 },
    { paperSize: 'A3', colorMode: 'BW', singleSidePrice: 5.0, duplexPrice: 9.0, duplexDiscountPercent: 10.0, bulkMinPages: 20, bulkDiscountPercent: 10 },
    { paperSize: 'A3', colorMode: 'COLOR', singleSidePrice: 20.0, duplexPrice: 36.0, duplexDiscountPercent: 10.0, bulkMinPages: 20, bulkDiscountPercent: 15 },
    { paperSize: 'A5', colorMode: 'BW', singleSidePrice: 1.5, duplexPrice: 2.8, duplexDiscountPercent: 7.0, bulkMinPages: 50, bulkDiscountPercent: 10 },
    { paperSize: 'LEGAL', colorMode: 'BW', singleSidePrice: 3.0, duplexPrice: 5.5, duplexDiscountPercent: 8.0, bulkMinPages: 30, bulkDiscountPercent: 10 },
  ];

  for (const r of defaultRules) {
    const existingRule = await prisma.pricingRule.findFirst({
      where: { shopId: shop.id, paperSize: r.paperSize, colorMode: r.colorMode },
    });
    if (!existingRule) {
      await prisma.pricingRule.create({
        data: { ...r, shopId: shop.id, isDefault: true },
      });
    }
  }

  // 11. Create Catalog Services for Shop
  const services = [
    { code: 'DOC_PRINT', name: 'Document Printing', description: 'Fast black & white and color laser printouts', price: 2.0, isEnabled: true },
    { code: 'PHOTO_PRINT', name: 'Photo Printing', description: 'High-gloss photo paper prints (4x6, 5x7, A4)', price: 25.0, isEnabled: true },
    { code: 'PASSPORT_PHOTO', name: 'Passport Photos', description: 'Instant 8-in-1 standard biometric passport photos', price: 50.0, isEnabled: true },
    { code: 'RESUME_PRINT', name: 'Resume & CV Printing', description: 'Premium 100gsm bond paper printouts', price: 10.0, isEnabled: true },
    { code: 'LAMINATION', name: 'Hot Lamination', description: 'Durable waterproof pouch lamination for ID & documents', price: 20.0, isEnabled: true },
    { code: 'BINDING', name: 'Spiral & Hard Binding', description: 'Professional book and project binding', price: 40.0, isEnabled: true },
    { code: 'SCANNING', name: 'High-Res Document Scanning', description: '600 DPI PDF/Image document digitization', price: 5.0, isEnabled: true },
  ];

  for (const s of services) {
    const existingService = await prisma.serviceItem.findFirst({
      where: { shopId: shop.id, code: s.code },
    });
    if (!existingService) {
      await prisma.serviceItem.create({
        data: { ...s, shopId: shop.id },
      });
    }
  }

  // Payment gateway credentials must be configured through the authorized
  // dashboard flow. Never seed provider secrets or enable fake payment routes.

  // 13. Create Testimonials
  const testimonials = [
    {
      name: 'Rajesh Sharma',
      role: 'Store Owner',
      shopName: 'ABC Digital Print Hub',
      city: 'Bengaluru',
      review: 'AnishNova Print completely eliminated the long rush hours at our college xerox center. Students scan, pay, and pick up without sending messy WhatsApp files.',
      rating: 5,
      isApproved: true,
      isFeatured: true,
      displayOrder: 1,
    },
    {
      name: 'Pooja Verma',
      role: 'Proprietor',
      shopName: 'Pooja Photocopy Center',
      city: 'Delhi NCR',
      review: 'The Windows Desktop Agent connected to our HP LaserJet in under 2 minutes. The automatic duplex and color routing has boosted our monthly revenue by 40%.',
      rating: 5,
      isApproved: true,
      isFeatured: true,
      displayOrder: 2,
    },
    {
      name: 'Kiran Patel',
      role: 'General Manager',
      shopName: 'Campus Express Print',
      city: 'Pune',
      review: 'Super clean UI for mobile users. Customers love that they don’t have to carry pendrives or share their personal phone numbers over WhatsApp.',
      rating: 5,
      isApproved: true,
      isFeatured: true,
      displayOrder: 3,
    },
  ];

  for (const t of testimonials) {
    const existing = await prisma.testimonial.findFirst({ where: { name: t.name, shopName: t.shopName } });
    if (!existing) {
      await prisma.testimonial.create({ data: t });
    }
  }

  // 14. Create Demo Video
  await prisma.demoVideo.upsert({
    where: { id: 'demo-video-default' },
    update: {},
    create: {
      id: 'demo-video-default',
      title: 'AnishNova Print Automated Spooler Walkthrough',
      description: 'See how customer mobile print jobs dispatch instantly to Windows physical printers without shop owner intervention.',
      videoUrl: 'https://www.youtube-nocookie.com/embed/qOPE-90Um8g',
      provider: 'YOUTUBE',
      isActive: true,
    },
  });

  // 15. Create Platform Settings
  const settings = [
    { key: 'STATS_SHOPS', value: '450+' },
    { key: 'STATS_DOCS', value: '1.2M+' },
    { key: 'STATS_CUSTOMERS', value: '98%' },
    { key: 'STATS_CITIES', value: '35+' },
    { key: 'PRICE_CAP_A4_BW', value: '5.0' },
    { key: 'PRICE_CAP_A4_COLOR', value: '25.0' },
    { key: 'PLATFORM_SERVICE_FEE', value: '2.0' },
    { key: 'GST_RATE', value: '18.0' },
  ];

  for (const st of settings) {
    await prisma.platformSetting.upsert({
      where: { key: st.key },
      update: { value: st.value },
      create: st,
    });
  }

  // 17. Seed Public Navigation Items
  const navItems = [
    { label: 'Home', path: '/', isExternal: false, openInNewTab: false, displayOrder: 1, isEnabled: true },
    { label: 'Pricing', path: '#pricing', isExternal: false, openInNewTab: false, displayOrder: 2, isEnabled: true },
    { label: 'How It Works', path: '#how-it-works', isExternal: false, openInNewTab: false, displayOrder: 3, isEnabled: true },
    { label: 'Features', path: '#features', isExternal: false, openInNewTab: false, displayOrder: 4, isEnabled: true },
    { label: 'About', path: '#about', isExternal: false, openInNewTab: false, displayOrder: 5, isEnabled: true },
    { label: 'Contact Us', path: '#contact', isExternal: false, openInNewTab: false, displayOrder: 6, isEnabled: true },
    { label: 'Partner Program', path: '#partner', isExternal: false, openInNewTab: false, displayOrder: 7, isEnabled: true },
    { label: 'Declaration', path: '#declaration', isExternal: false, openInNewTab: false, displayOrder: 8, isEnabled: true },
  ];

  for (const item of navItems) {
    const existing = await prisma.navigationItem.findFirst({ where: { label: item.label } });
    if (!existing) {
      await prisma.navigationItem.create({ data: item });
    }
  }

  // 18. Seed Homepage Banners
  const existingBanner = await prisma.homepageBanner.findFirst({ where: { title: 'Launch AnishNova Print At Your Counter' } });
  if (!existingBanner) {
    await prisma.homepageBanner.create({
      data: {
        title: 'Launch AnishNova Print At Your Counter',
        subtitle: 'Connect your store’s Windows printer in under 2 minutes. Eliminate WhatsApp file queues forever.',
        ctaText: 'Your Shop — Register Now',
        ctaUrl: '/shop/register',
        displayOrder: 1,
        isEnabled: true,
      },
    });
  }

  console.log('🎉 Database seeding completed successfully for AnishNova Print!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
