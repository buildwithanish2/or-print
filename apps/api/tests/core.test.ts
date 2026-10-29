import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PricingEngineService } from '../src/services/pricing.service';
import { CreateOrderSchema, LoginSchema, ShopRegistrationSchema } from '../../../packages/validation/src/index';
import crypto from 'crypto';
import { canCollectCashPayment, canManageShopPayment, canReviewManualUpiPayment, decryptPaymentCredentialWithKey, encryptPaymentCredentialWithKey, isValidUpiVpa, PaymentGatewayService, verifyRazorpaySignature, verifyRazorpayWebhookSignature } from '../src/services/payment.service';
import { canReserveFreePrintAllowance, canShopOwnerReviewGuestId, hashCollegeIdNumber, hashGuestAccessToken, isFreePrintPolicyActive, kolkataPeriodKeys } from '../src/services/free-print.service';
import { AuthController } from '../src/controllers/auth.controller';
import { OrderController } from '../src/controllers/order.controller';
import { PaymentController } from '../src/controllers/payment.controller';
import { ShopController } from '../src/controllers/shop.controller';
import { AgentController } from '../src/controllers/agent.controller';
import { prisma } from '../src/prisma';
import { EmailService } from '../src/services/email.service';
import { requireAdmin } from '../src/middleware/rbac.middleware';
import { errorHandler } from '../src/middleware/error.middleware';
import { agentArtifactDownloadHeaders, agentReleaseMetadata, resolveAgentArtifact, canAgentReportStatus, canDispatchPrintJob } from '../src/services/agent-artifact.service';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { getAdminWebUrl, getApiBaseUrl, getCustomerWebUrl, getShopWebUrl } from '@printqr/config';

test('customer portal URL uses production domain when missing or set to localhost in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCustomerPortalUrl = process.env.CUSTOMER_PORTAL_URL;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.CUSTOMER_PORTAL_URL;
    assert.equal(getCustomerWebUrl(), 'https://customer-web-six-livid.vercel.app');
    process.env.CUSTOMER_PORTAL_URL = 'http://localhost:5173';
    assert.equal(getCustomerWebUrl(), 'https://customer-web-six-livid.vercel.app');
    process.env.CUSTOMER_PORTAL_URL = 'https://customer.example.test/';
    assert.equal(getCustomerWebUrl(), 'https://customer.example.test');
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalCustomerPortalUrl === undefined) delete process.env.CUSTOMER_PORTAL_URL;
    else process.env.CUSTOMER_PORTAL_URL = originalCustomerPortalUrl;
  }
});

test('server-generated production portal and API URLs never fall back to localhost', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiPublicUrl = process.env.API_PUBLIC_URL;
  const originalPublicApiUrl = process.env.PUBLIC_API_URL;
  const originalShopPortalUrl = process.env.SHOP_PORTAL_URL;
  const originalAppPublicUrl = process.env.APP_PUBLIC_URL;
  const originalAdminPortalUrl = process.env.ADMIN_PORTAL_URL;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.API_PUBLIC_URL;
    delete process.env.PUBLIC_API_URL;
    delete process.env.SHOP_PORTAL_URL;
    delete process.env.APP_PUBLIC_URL;
    delete process.env.ADMIN_PORTAL_URL;
    assert.equal(getApiBaseUrl(), 'https://api.anishnova.com');
    assert.equal(getShopWebUrl(), 'https://shop-dashboard-one-eosin.vercel.app');
    assert.equal(getAdminWebUrl(), 'https://or-print.vercel.app');
    process.env.SHOP_PORTAL_URL = 'http://localhost:5174';
    assert.equal(getShopWebUrl(), 'https://shop-dashboard-one-eosin.vercel.app');
    process.env.ADMIN_PORTAL_URL = 'http://localhost:5175';
    assert.equal(getAdminWebUrl(), 'https://or-print.vercel.app');
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalNodeEnv;
    if (originalApiPublicUrl === undefined) delete process.env.API_PUBLIC_URL; else process.env.API_PUBLIC_URL = originalApiPublicUrl;
    if (originalPublicApiUrl === undefined) delete process.env.PUBLIC_API_URL; else process.env.PUBLIC_API_URL = originalPublicApiUrl;
    if (originalShopPortalUrl === undefined) delete process.env.SHOP_PORTAL_URL; else process.env.SHOP_PORTAL_URL = originalShopPortalUrl;
    if (originalAppPublicUrl === undefined) delete process.env.APP_PUBLIC_URL; else process.env.APP_PUBLIC_URL = originalAppPublicUrl;
    if (originalAdminPortalUrl === undefined) delete process.env.ADMIN_PORTAL_URL; else process.env.ADMIN_PORTAL_URL = originalAdminPortalUrl;
  }
});

test('free-print order creation returns identifiers that the tracking endpoint resolves', async () => {
  const fileId = '20000000-0000-4000-8000-000000000001';
  const guestToken = `test-${'a'.repeat(48)}`;
  const verification: any = {
    id: 'verification-1', shopId: 'shop-1', institutionId: 'institution-1', requestedRole: 'STUDENT',
    status: 'APPROVED', active: true, identityHash: 'identity-hash',
    institution: { id: 'institution-1', name: 'Test College', isActive: true, isEligible: true },
  };
  const policy: any = {
    id: 'global', enabled: true, startsAt: null, expiresAt: null, allowBlackWhite: true, allowColor: true,
    studentDailyPages: 100, studentMonthlyPages: 1000, studentDailyCopies: 10, studentMonthlyCopies: 100,
    teacherDailyPages: 100, teacherMonthlyPages: 1000, teacherDailyCopies: 10, teacherMonthlyCopies: 100,
  };
  const printer: any = { id: 'printer-1', isDefault: true, status: 'ONLINE', supportsColor: true, supportsDuplex: true, supportedSizes: 'A4' };
  const file: any = {
    id: fileId, expiresAt: new Date(Date.now() + 60_000), shopId: 'shop-1', guestVerificationId: verification.id,
    originalName: 'college-notes.pdf', pageCount: 4, mimeType: 'application/pdf', sizeBytes: 4096,
    url: '/files/test-pdf', category: 'DOCUMENT',
  };
  const stored: any = { items: [], printJobs: [], payments: [] };
  const db = prisma as any;
  const original = {
    orderFindUnique: db.order.findUnique,
    shopFindUnique: db.shop.findUnique,
    fileFindUnique: db.fileRecord.findUnique,
    pricingRuleFindFirst: db.pricingRule.findFirst,
    verificationFindUnique: db.guestInstitutionVerification.findUnique,
    policyFindUnique: db.freePrintPolicy.findUnique,
    shopSettingFindUnique: db.freePrintShopSetting.findUnique,
    institutionFindUnique: db.institution.findUnique,
    usageFindUnique: db.freePrintUsage.findUnique,
    transaction: db.$transaction,
  };
  const tx: any = {
    order: { create: async ({ data }: any) => Object.assign(stored, data, { id: 'order-1' }) },
    orderItem: { create: async ({ data }: any) => { const item = { ...data, id: 'item-1', file }; stored.items.push(item); return item; } },
    printJob: { create: async ({ data }: any) => { const job = { ...data, id: 'job-1', attempts: 0, maxAttempts: 3, createdAt: new Date() }; stored.printJobs.push(job); return job; } },
    freePrintPolicy: { findUnique: async () => policy },
    guestInstitutionVerification: { findUnique: async () => verification },
    freePrintShopSetting: { findUnique: async () => ({ participating: true }) },
    printer: { findFirst: async () => printer },
    freePrintUsage: { upsert: async () => ({} ) },
    $executeRaw: async () => 1,
    freePrintReservation: { create: async () => ({ id: 'reservation-1' }) },
  };

  try {
    db.order.findUnique = async ({ where }: any) => {
      if (where.idempotencyKey) return null;
      if (where.id === stored.id || where.orderNumber === stored.orderNumber) return stored.id ? { ...stored, shop: { id: 'shop-1', name: 'Test Shop', slug: 'test-shop', phone: null, address: null, logoUrl: null } } : null;
      return null;
    };
    db.shop.findUnique = async () => ({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', status: 'ACTIVE', isOnline: true, printers: [printer] });
    db.fileRecord.findUnique = async () => file;
    db.pricingRule.findFirst = async () => null;
    db.guestInstitutionVerification.findUnique = async () => verification;
    db.freePrintPolicy.findUnique = async () => policy;
    db.freePrintShopSetting.findUnique = async () => ({ participating: true });
    db.institution.findUnique = async () => verification.institution;
    db.freePrintUsage.findUnique = async () => null;
    db.$transaction = async (callback: (transaction: any) => unknown) => callback(tx);

    const requestBody: any = {
      shopSlug: 'test-shop', idempotencyKey: 'order-key-for-free-print-001', freePrintRequested: true,
      paymentMethod: 'PAY_AT_COUNTER', items: [{ fileId, settings: { colorMode: 'BW', paperSize: 'A4', orientation: 'PORTRAIT', duplexMode: 'SIMPLEX', copies: 1, pageRange: 'ALL', pagesPerSheet: 1, quality: 'NORMAL' } }],
    };
    const makeResponse = () => ({ statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } });
    const createResponse = makeResponse();
    let createError: unknown;
    await OrderController.createOrder({ body: requestBody, get: (header: string) => header === 'X-Free-Print-Token' ? guestToken : undefined } as any, createResponse as any, (error: unknown) => { createError = error; });
    assert.equal(createError, undefined);
    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.body.success, true);
    assert.equal(createResponse.body.data.totalAmount, 0);
    assert.equal(createResponse.body.data.freePrint.eligible, true);
    assert.equal(stored.orderNumber, createResponse.body.data.orderNumber);
    assert.equal(stored.trackingToken, createResponse.body.data.trackingToken);

    const track = async (orderNumber: string, token: string) => {
      const response = makeResponse();
      let error: unknown;
      await OrderController.getOrderByNumber({ params: { orderNumber }, query: { token } } as any, response as any, (caught: unknown) => { error = caught; });
      assert.equal(error, undefined);
      return response;
    };
    const tracked = await track(stored.orderNumber, stored.trackingToken);
    assert.equal(tracked.statusCode, 200);
    assert.equal(tracked.body.data.orderNumber, createResponse.body.data.orderNumber);
    assert.equal(tracked.body.data.trackingToken, undefined);
    assert.equal((await track('ANP-000000', stored.trackingToken)).statusCode, 404);
    assert.equal((await track(stored.orderNumber, `${stored.trackingToken}-invalid`)).statusCode, 404);
  } finally {
    db.order.findUnique = original.orderFindUnique;
    db.shop.findUnique = original.shopFindUnique;
    db.fileRecord.findUnique = original.fileFindUnique;
    db.pricingRule.findFirst = original.pricingRuleFindFirst;
    db.guestInstitutionVerification.findUnique = original.verificationFindUnique;
    db.freePrintPolicy.findUnique = original.policyFindUnique;
    db.freePrintShopSetting.findUnique = original.shopSettingFindUnique;
    db.institution.findUnique = original.institutionFindUnique;
    db.freePrintUsage.findUnique = original.usageFindUnique;
    db.$transaction = original.transaction;
  }
});

test('manual UPI checkout persists a pending order that tracks with returned identifiers', async () => {
  const fileId = '30000000-0000-4000-8000-000000000001';
  const file: any = { id: fileId, expiresAt: new Date(Date.now() + 60_000), shopId: 'shop-upi', originalName: 'notes.pdf', pageCount: 4, mimeType: 'application/pdf', sizeBytes: 4096, url: '/files/notes.pdf', category: 'DOCUMENT' };
  const printer: any = { id: 'printer-upi', isDefault: true, status: 'ONLINE', supportsColor: false, supportsDuplex: false, supportedSizes: 'A4' };
  const stored: any = { items: [], printJobs: [], payments: [] };
  const db = prisma as any;
  const originals = {
    orderFindUnique: db.order.findUnique,
    shopFindUnique: db.shop.findUnique,
    fileFindUnique: db.fileRecord.findUnique,
    gatewayFindFirst: db.paymentGatewayConfig.findFirst,
    transaction: db.$transaction,
    itemPrice: PricingEngineService.calculateItemPrice,
    orderTotal: PricingEngineService.calculateOrderTotal,
    paymentInit: PaymentGatewayService.initializeOrderPayment,
  };
  const tx: any = {
    order: { create: async ({ data }: any) => Object.assign(stored, data, { id: 'order-upi-1' }) },
    orderItem: { create: async ({ data }: any) => { const item = { ...data, id: 'item-upi-1', file }; stored.items.push(item); return item; } },
    printJob: { create: async ({ data }: any) => { const job = { ...data, id: 'job-upi-1', attempts: 0, maxAttempts: 3, createdAt: new Date() }; stored.printJobs.push(job); return job; } },
  };
  const makeResponse = () => ({ statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } });

  try {
    db.order.findUnique = async ({ where }: any) => {
      if (where.idempotencyKey) return null;
      if (where.orderNumber === stored.orderNumber) return { ...stored, shop: { id: 'shop-upi', name: 'UPI Test Shop', slug: 'upi-test-shop', phone: null, address: null, logoUrl: null }, items: stored.items, printJobs: stored.printJobs, payments: [] };
      return null;
    };
    db.shop.findUnique = async () => ({ id: 'shop-upi', name: 'UPI Test Shop', slug: 'upi-test-shop', status: 'ACTIVE', isOnline: true, printers: [printer] });
    db.fileRecord.findUnique = async () => file;
    db.paymentGatewayConfig.findFirst = async () => ({ isEnabled: true, upiVpa: 'shop@upi' });
    db.$transaction = async (callback: (transaction: any) => unknown) => callback(tx);
    PricingEngineService.calculateItemPrice = async () => ({ fileId, fileName: file.originalName, pageCount: 4, selectedPages: 4, copies: 1, effectiveSheets: 4, unitPricePerPage: 2.5, basePrice: 10, duplexDiscount: 0, bulkDiscount: 0, itemTotal: 10 });
    PricingEngineService.calculateOrderTotal = async (items: any[]) => ({ items, subtotal: 10, totalDiscount: 0, serviceFee: 1, gstRatePercent: 0, gstAmount: 0, finalTotal: 11 });
    PaymentGatewayService.initializeOrderPayment = async (_id: string, _number: string, amount: number, method: string) => {
      assert.equal(method, 'UPI');
      return { gateway: 'UPI_DIRECT', paymentId: 'pending-upi-payment', amount, currency: 'INR', status: 'PENDING' } as any;
    };

    const requestBody: any = { shopSlug: 'upi-test-shop', idempotencyKey: 'manual-upi-checkout-test-key', paymentMethod: 'UPI', items: [{ fileId, settings: { colorMode: 'BW', paperSize: 'A4', orientation: 'PORTRAIT', duplexMode: 'SIMPLEX', copies: 1, pageRange: 'ALL', pagesPerSheet: 1, quality: 'NORMAL' } }] };
    const createResponse = makeResponse();
    let createError: unknown;
    await OrderController.createOrder({ body: requestBody, get: () => undefined } as any, createResponse as any, (error: unknown) => { createError = error; });
    assert.equal(createError, undefined);
    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.body.data.payment.status, 'PENDING');
    assert.equal(stored.paymentStatus, 'PENDING');
    assert.equal(stored.totalAmount, 11);
    assert.ok(stored.orderNumber);
    assert.ok(stored.trackingToken);
    assert.equal(createResponse.body.data.trackingUrl, `/track/${encodeURIComponent(stored.orderNumber)}?token=${encodeURIComponent(stored.trackingToken)}`);

    const trackResponse = makeResponse();
    let trackError: unknown;
    await OrderController.getOrderByNumber({ params: { orderNumber: createResponse.body.data.orderNumber }, query: { token: createResponse.body.data.trackingToken } } as any, trackResponse as any, (error: unknown) => { trackError = error; });
    assert.equal(trackError, undefined);
    assert.equal(trackResponse.statusCode, 200);
    assert.equal(trackResponse.body.data.orderNumber, createResponse.body.data.orderNumber);
    assert.equal(trackResponse.body.data.paymentStatus, 'PENDING');
  } finally {
    db.order.findUnique = originals.orderFindUnique;
    db.shop.findUnique = originals.shopFindUnique;
    db.fileRecord.findUnique = originals.fileFindUnique;
    db.paymentGatewayConfig.findFirst = originals.gatewayFindFirst;
    db.$transaction = originals.transaction;
    PricingEngineService.calculateItemPrice = originals.itemPrice;
    PricingEngineService.calculateOrderTotal = originals.orderTotal;
    PaymentGatewayService.initializeOrderPayment = originals.paymentInit;
  }
});

test('manual UPI status remains pending after customer proof and becomes verified only after shop approval', async () => {
  const db = prisma as any;
  const originalFindUnique = db.order.findUnique;
  const order: any = {
    orderNumber: 'ANP-TESTUPI', trackingToken: 'tracking-token-for-test', totalAmount: 11.44,
    paymentMethod: 'UPI', paymentStatus: 'PAYMENT_SUBMITTED', printStatus: 'RECEIVED',
    updatedAt: new Date(), shop: { name: 'Test Shop', logoUrl: null },
    payments: [{ id: 'payment-test', amount: 11.44, transactionRef: 'UTR-TEST-1234' }],
  };
  const getStatus = async () => {
    const response: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
    let error: unknown;
    await PaymentController.getPaymentStatus({ params: { orderNumber: order.orderNumber }, query: { token: order.trackingToken } } as any, response, (caught: unknown) => { error = caught; });
    assert.equal(error, undefined);
    return response;
  };

  try {
    db.order.findUnique = async () => order;
    const pending = await getStatus();
    assert.equal(pending.statusCode, 200);
    assert.equal(pending.body.data.paymentStatus, 'PAYMENT_SUBMITTED');
    assert.equal(pending.body.data.isVerified, false);

    order.paymentStatus = 'PAID';
    order.printStatus = 'QUEUED';
    order.payments[0].status = 'PAID';
    const verified = await getStatus();
    assert.equal(verified.statusCode, 200);
    assert.equal(verified.body.data.paymentStatus, 'PAID');
    assert.equal(verified.body.data.isVerified, true);
  } finally {
    db.order.findUnique = originalFindUnique;
  }
});

test('manual UPI proof rejects an invalid short payment reference', async () => {
  const response: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
  let error: unknown;
  await PaymentController.submitUpiProof({ body: { orderNumber: 'ANP-TESTUPI', trackingToken: 'not-logged', utrReference: 'x' } } as any, response, (caught: unknown) => { error = caught; });
  assert.equal(error, undefined);
  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /valid UPI UTR/i);
});

test('internal server errors do not expose Prisma/database details to clients', () => {
  let status = 0;
  let body: any;
  const req: any = { method: 'GET', path: '/free-print/admin', originalUrl: '/free-print/admin?token=private' };
  const res: any = {
    status(code: number) { status = code; return this; },
    json(value: any) { body = value; return this; },
  };
  const originalError = console.error;
  console.error = () => undefined;
  try {
    errorHandler(new Error('The table `main.Institution` does not exist'), req, res, (() => undefined) as any);
  } finally {
    console.error = originalError;
  }
  assert.equal(status, 500);
  assert.equal(body.message, 'Something went wrong. Please try again.');
  assert.doesNotMatch(JSON.stringify(body), /Institution|main\./);
  assert.equal(body.error, undefined);
});

test('agent release readiness requires real-sized PE artifacts matching the manifest', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'print-agent-release-'));
  try {
    assert.equal(agentReleaseMetadata(directory), null);
    const installer = Buffer.alloc(1024 * 1024);
    installer[0] = 0x4d; installer[1] = 0x5a;
    const binary = Buffer.from(installer);
    binary[100] = 42;
    fs.writeFileSync(path.join(directory, 'AnishNovaPrintAgent-Setup.exe'), installer);
    fs.writeFileSync(path.join(directory, 'PrintQRAgent.exe'), binary);
    const artifactMeta = (fileName: string, bytes: Buffer) => ({
      fileName,
      fileSize: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    const manifest = {
      latestVersion: '1.2.3', minimumSupportedVersion: '1.2.3', mandatory: false,
      releaseDate: '2026-10-29', channel: 'stable', releaseNotes: [],
      installer: artifactMeta('AnishNovaPrintAgent-Setup.exe', installer),
      binary: artifactMeta('PrintQRAgent.exe', binary),
    };
    fs.writeFileSync(path.join(directory, 'agent-release.json'), JSON.stringify(manifest));

    assert.equal(agentReleaseMetadata(directory)?.latestVersion, '1.2.3');
    assert.equal(resolveAgentArtifact('installer', directory)?.fileSize, installer.length);

    fs.appendFileSync(path.join(directory, 'PrintQRAgent.exe'), Buffer.from([1]));
    assert.equal(resolveAgentArtifact('binary', directory), null);
    assert.equal(agentReleaseMetadata(directory), null);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('agent downloads use executable attachment headers with verified byte length', () => {
  assert.deepEqual(agentArtifactDownloadHeaders(1234567, 'AnishNovaPrintAgent-Setup.exe'), {
    'Content-Disposition': 'attachment; filename="AnishNovaPrintAgent-Setup.exe"',
    'Content-Type': 'application/vnd.microsoft.portable-executable',
    'Content-Length': 1234567,
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  });
});

test('agent queue dispatch requires a queued job, paid/free order, active print state, and online printer', () => {
  const base = { jobStatus: 'QUEUED', paymentStatus: 'PAID', printStatus: 'QUEUED', printerStatus: 'ONLINE' };
  assert.equal(canDispatchPrintJob(base), true);
  assert.equal(canDispatchPrintJob({ ...base, paymentStatus: 'PAYMENT_SUBMITTED' }), false);
  assert.equal(canDispatchPrintJob({ ...base, paymentStatus: 'CASH_ON_COUNTER' }), false);
  assert.equal(canDispatchPrintJob({ ...base, printStatus: 'CANCELLED' }), false);
  assert.equal(canDispatchPrintJob({ ...base, printerStatus: 'OFFLINE' }), false);
  assert.equal(canDispatchPrintJob({ ...base, jobStatus: 'PRINTING' }), false);
});

test('agent status transitions stop at spooler acceptance until physical completion can be verified', () => {
  assert.equal(canAgentReportStatus('DOWNLOADING', 'PRINTING'), true);
  assert.equal(canAgentReportStatus('PRINTING', 'SENT_TO_SPOOLER'), true);
  assert.equal(canAgentReportStatus('SENT_TO_SPOOLER', 'COMPLETED'), false);
  assert.equal(canAgentReportStatus('SENT_TO_SPOOLER', 'FAILED'), true);
  assert.equal(canAgentReportStatus('FAILED', 'PRINTING'), false);
});

test('page range parser counts ALL pages', () => {
  assert.equal(PricingEngineService.parseSelectedPagesCount('ALL', 12), 12);
});

test('page range parser supports lists, ranges, duplicates, and document boundaries', () => {
  assert.equal(PricingEngineService.parseSelectedPagesCount('1-3, 3, 8, 10-14', 12), 7);
});

test('server page-range validation rejects malformed and out-of-document ranges', () => {
  assert.deepEqual(PricingEngineService.validatePageRange('1-3, 3, 8', 10), { valid: true, count: 4 });
  assert.equal(PricingEngineService.validatePageRange('0,2', 10).valid, false);
  assert.equal(PricingEngineService.validatePageRange('1-11', 10).valid, false);
  assert.equal(PricingEngineService.validatePageRange('1,,3', 10).valid, false);
  assert.equal(PricingEngineService.validatePageRange('ALL', 10).count, 10);
});

test('order validation ignores a client-supplied selected page count', () => {
  const result = CreateOrderSchema.safeParse({
    shopSlug: 'sample-shop',
    paymentMethod: 'UPI',
    items: [{
      fileId: '8a5c1b7c-cbe7-45dc-8c60-735c70ee8c12',
      settings: { pageRange: '2-4', selectedPagesCount: 999 },
    }],
  });
  assert.equal(result.success, true);
  if (result.success) assert.equal('selectedPagesCount' in result.data.items[0].settings, false);
});

test('order validation rejects unsupported print options and invalid copy counts', () => {
  const result = CreateOrderSchema.safeParse({
    shopSlug: 'sample-shop',
    paymentMethod: 'UPI',
    items: [{
      fileId: '8a5c1b7c-cbe7-45dc-8c60-735c70ee8c12',
      settings: { colorMode: 'ULTRAVIOLET', copies: 0 },
    }],
  });
  assert.equal(result.success, false);
});

test('Razorpay callback signature is tied to the server order ID and payment ID', () => {
  const secret = 'unit-test-secret';
  const orderId = 'order_test_123';
  const paymentId = 'pay_test_456';
  const signature = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  assert.equal(verifyRazorpaySignature(orderId, paymentId, signature, secret), true);
  assert.equal(verifyRazorpaySignature('order_other', paymentId, signature, secret), false);
  assert.equal(verifyRazorpaySignature(orderId, paymentId, 'tampered', secret), false);
});

test('Razorpay webhook signature validates the exact raw bytes', () => {
  const secret = 'webhook-unit-test-secret';
  const raw = Buffer.from('{"event":"payment.captured"}');
  const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  assert.equal(verifyRazorpayWebhookSignature(raw, signature, secret), true);
  assert.equal(verifyRazorpayWebhookSignature(Buffer.from('{ "event":"payment.captured"}'), signature, secret), false);
});

test('cash collection is allowed only for an unpaid cash order that is queued', () => {
  assert.equal(canCollectCashPayment('PAY_AT_COUNTER', 'CASH_ON_COUNTER', 'QUEUED'), true);
  assert.equal(canCollectCashPayment('PAY_AT_COUNTER', 'PAID', 'QUEUED'), false);
  assert.equal(canCollectCashPayment('UPI', 'CASH_ON_COUNTER', 'QUEUED'), false);
  assert.equal(canCollectCashPayment('PAY_AT_COUNTER', 'CASH_ON_COUNTER', 'CANCELLED'), false);
});

test('cash collection authorization is limited to the owning shop or administrators', () => {
  assert.equal(canManageShopPayment('SHOP_OWNER', 'shop-a', 'shop-a'), true);
  assert.equal(canManageShopPayment('SHOP_STAFF', 'shop-a', 'shop-a'), true);
  assert.equal(canManageShopPayment('SHOP_OWNER', 'shop-a', 'shop-b'), false);
  assert.equal(canManageShopPayment('SHOP_OWNER', null, 'shop-a'), false);
  assert.equal(canManageShopPayment('ADMIN', null, 'shop-a'), true);
});

test('manual UPI proof remains unverified until a matching shop-side review', () => {
  assert.equal(canReviewManualUpiPayment('UPI', 'PAYMENT_SUBMITTED', 'UPI', 'UTR123456', 42.5, 42.5), true);
  assert.equal(canReviewManualUpiPayment('UPI', 'PAYMENT_SUBMITTED', 'UPI', 'UTR123456', 42.49, 42.5), false);
  assert.equal(canReviewManualUpiPayment('UPI', 'PAID', 'UPI', 'UTR123456', 42.5, 42.5), false);
  assert.equal(canReviewManualUpiPayment('PAY_AT_COUNTER', 'PAYMENT_SUBMITTED', 'UPI', 'UTR123456', 42.5, 42.5), false);
});

test('credential encryption supports authenticated storage and key rotation without exposing values', () => {
  const oldKey = 'a'.repeat(64);
  const newKey = 'b'.repeat(64);
  const encrypted = encryptPaymentCredentialWithKey('sandbox-only-test-secret', oldKey);
  assert.match(encrypted, /^enc:v1:/);
  assert.equal(decryptPaymentCredentialWithKey(encrypted, oldKey), 'sandbox-only-test-secret');
  const rotated = encryptPaymentCredentialWithKey(decryptPaymentCredentialWithKey(encrypted, oldKey), newKey);
  assert.equal(decryptPaymentCredentialWithKey(rotated, newKey), 'sandbox-only-test-secret');
  assert.throws(() => decryptPaymentCredentialWithKey(encrypted, newKey));
});

test('UPI VPA format validation is strict and does not imply ownership', () => {
  assert.equal(isValidUpiVpa('shop.name@okbank'), true);
  assert.equal(isValidUpiVpa('not-a-vpa'), false);
  assert.equal(isValidUpiVpa('name@@bank'), false);
});

test('order idempotency keys must be sufficiently unpredictable', () => {
  const base = {
    shopSlug: 'sample-shop', paymentMethod: 'PAY_AT_COUNTER',
    idempotencyKey: 'short',
    items: [{ fileId: '8a5c1b7c-cbe7-45dc-8c60-735c70ee8c12', settings: {} }],
  };
  assert.equal(CreateOrderSchema.safeParse(base).success, false);
  assert.equal(CreateOrderSchema.safeParse({ ...base, idempotencyKey: '12345678901234567890' }).success, true);
});

test('public auth registration is rejected for customer, student, teacher, and admin role payloads', async () => {
  for (const role of ['CUSTOMER', 'STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN']) {
    let statusCode = 0;
    let responseBody: any;
    const response = { status(code: number) { statusCode = code; return this; }, json(body: unknown) { responseBody = body; return this; } };
    await AuthController.register({ body: { name: 'Test User', email: 'test@example.com', password: 'long-password', role } } as any, response as any, (() => { throw new Error('Unexpected error path'); }) as any);
    assert.equal(statusCode, 403);
    assert.equal(responseBody.code, 'PUBLIC_REGISTRATION_DISABLED');
  }
});

test('password recovery stays unavailable without delivery configuration and invalid reset input is rejected', async () => {
  const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL', 'SMTP_FROM'];
  const previousSmtpValues = new Map(smtpKeys.map((key) => [key, process.env[key]]));
  smtpKeys.forEach((key) => { delete process.env[key]; });
  let forgotStatus = 0;
  let forgotBody: any;
  const forgotResponse = { status(code: number) { forgotStatus = code; return this; }, json(body: unknown) { forgotBody = body; return this; } };
  await AuthController.forgotPassword({ body: { email: 'existing@example.com' } } as any, forgotResponse as any, (() => { throw new Error('Unexpected error path'); }) as any);
  assert.equal(forgotStatus, 503);
  assert.equal(forgotBody.code, 'PASSWORD_RECOVERY_UNAVAILABLE');
  assert.equal('data' in forgotBody, false);

  let resetStatus = 0;
  let resetBody: any;
  const resetResponse = { status(code: number) { resetStatus = code; return this; }, json(body: unknown) { resetBody = body; return this; } };
  await AuthController.resetPassword({ body: { token: 'invalid', password: 'long-password-value' } } as any, resetResponse as any, (() => { throw new Error('Unexpected error path'); }) as any);
  assert.equal(resetStatus, 400);
  assert.equal('data' in resetBody, false);
  previousSmtpValues.forEach((value, key) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; });
});

test('SMTP configuration validates TLS, sender fields, and never requires frontend configuration', () => {
  const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME', 'SMTP_FROM'];
  const previousSmtpValues = new Map(smtpKeys.map((key) => [key, process.env[key]]));
  try {
    smtpKeys.forEach((key) => { delete process.env[key]; });
    assert.equal(EmailService.isConfigured(), false);
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'mailer@example.test';
    process.env.SMTP_PASS = 'test-only-password';
    process.env.SMTP_FROM_EMAIL = 'no-reply@example.test';
    process.env.SMTP_FROM_NAME = 'AnishNova Print';
    assert.equal(EmailService.isConfigured(), true);
    process.env.SMTP_PORT = 'bad-port';
    assert.equal(EmailService.isConfigured(), false);
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'sometimes';
    assert.equal(EmailService.isConfigured(), false);
    process.env.SMTP_SECURE = 'false';
    assert.equal(EmailService.isConfigured(), true);
  } finally {
    previousSmtpValues.forEach((value, key) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  }
});

test('verification, reset, and welcome messages use mocked SMTP with plain text and escaped HTML', async () => {
  const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME', 'SMTP_FROM'];
  const previousSmtpValues = new Map(smtpKeys.map((key) => [key, process.env[key]]));
  const messages: any[] = [];
  const transportConfigurations: any[] = [];
  try {
    smtpKeys.forEach((key) => { delete process.env[key]; });
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'mailer@example.test';
    process.env.SMTP_PASS = 'test-only-password';
    process.env.SMTP_FROM_EMAIL = 'no-reply@example.test';
    process.env.SMTP_FROM_NAME = 'AnishNova Print';
    EmailService.setTransporterFactoryForTests((configuration) => {
      transportConfigurations.push(configuration);
      return { sendMail: async (message: any) => { messages.push(message); return {}; }, close: () => undefined } as any;
    });

    assert.equal(await EmailService.sendActionLink('owner@example.test', 'https://shop.example.test/verify-email#token=opaque-token', 'verify'), true);
    assert.equal(await EmailService.sendActionLink('owner@example.test', 'https://shop.example.test/reset-password#token=opaque-token', 'reset'), true);
    assert.equal(await EmailService.sendWelcomeEmail({
      to: 'owner@example.test', ownerName: '<Owner>', shopName: 'A&B Print', planName: 'Starter',
      shopUrl: 'https://shop.example.test', customerUrl: 'https://customer.example.test/print/a-b',
    }), true);

    assert.equal(messages.length, 3);
    assert.equal(transportConfigurations[0].secure, false);
    assert.equal(messages[0].from.address, 'no-reply@example.test');
    assert.match(messages[0].text, /verify-email#token=opaque-token/);
    assert.match(messages[1].subject, /Reset/);
    assert.match(messages[1].text, /reset-password#token=opaque-token/);
    assert.match(messages[2].html, /&lt;Owner&gt;/);
    assert.match(messages[2].html, /A&amp;B Print/);
    assert.match(messages[2].text, /https:\/\/shop.example.test\/login/);
    assert.doesNotMatch(messages[2].html, /pairing PIN|pairing code/i);

    EmailService.setTransporterFactoryForTests(() => ({
      sendMail: async () => { throw new Error('mock SMTP rejection'); },
      close: () => undefined,
    } as any));
    await assert.rejects(() => EmailService.sendActionLink('owner@example.test', 'https://shop.example.test/reset-password#token=opaque-token', 'reset'), /mock SMTP rejection/);
  } finally {
    EmailService.setTransporterFactoryForTests(null);
    previousSmtpValues.forEach((value, key) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  }
});

test('shop registration emails happen after account creation, duplicates do not resend, and SMTP failures stay pending', async () => {
  const envKeys = ['NODE_ENV', 'SHOP_PORTAL_URL', 'CUSTOMER_PORTAL_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME', 'SMTP_FROM'];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const db = prisma as any;
  const original = {
    userFindUnique: db.user.findUnique,
    userUpdateMany: db.user.updateMany,
    shopFindUnique: db.shop.findUnique,
    planFindUnique: db.subscriptionPlan.findUnique,
    tokenCreate: db.authActionToken.create,
    tokenUpdateMany: db.authActionToken.updateMany,
    transaction: db.$transaction,
  };
  let existingUser: any = null;
  let createdUserCount = 0;
  const messages: any[] = [];
  let shouldFailDelivery = false;
  const tx = {
    user: { create: async ({ data }: any) => { createdUserCount += 1; return { ...data, id: `user-${createdUserCount}` }; } },
    shop: { create: async ({ data }: any) => ({ ...data, id: `shop-${createdUserCount}` }) },
    shopSubscription: { create: async () => ({}) },
    subscriptionPaymentAttempt: { updateMany: async () => ({ count: 1 }) },
    qRCodeRecord: { create: async () => ({}) },
    pricingRule: { create: async () => ({}) },
    printer: { create: async () => ({}) },
    printerAgent: { create: async () => ({}) },
  };

  try {
    process.env.NODE_ENV = 'test';
    process.env.SHOP_PORTAL_URL = 'https://shop.example.test';
    process.env.CUSTOMER_PORTAL_URL = 'https://customer.example.test';
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'mailer@example.test';
    process.env.SMTP_PASS = 'test-only-password';
    process.env.SMTP_FROM_EMAIL = 'no-reply@example.test';
    process.env.SMTP_FROM_NAME = 'AnishNova Print';
    db.user.findUnique = async () => existingUser;
    db.user.updateMany = async () => ({ count: 1 });
    db.shop.findUnique = async () => null;
    db.subscriptionPlan.findUnique = async () => ({ id: 'plan-free', name: 'Free', priceMonthly: 0 });
    db.authActionToken.create = async () => ({});
    db.authActionToken.updateMany = async () => ({ count: 1 });
    db.$transaction = async (callback: (transaction: any) => unknown) => callback(tx);
    EmailService.setTransporterFactoryForTests(() => ({
      sendMail: async (message: any) => {
        assert.ok(createdUserCount > 0, 'registration email must be sent only after the account transaction');
        if (shouldFailDelivery) throw new Error('mock SMTP rejection');
        messages.push(message);
        return { accepted: [message.to], rejected: [] };
      },
      close: () => undefined,
    } as any));

    const invokeRegistration = async () => {
      let statusCode = 0;
      let body: any;
      const response = { status(code: number) { statusCode = code; return this; }, json(value: any) { body = value; return this; } };
      let passedError: unknown;
      await ShopController.registerShop({ body: {
        shopName: 'Example Print', ownerName: 'Shop Owner', email: 'owner@example.test', phone: '9876543210',
        password: 'correct-horse-battery-9', planId: 'plan-free', address: 'Market Road', city: 'Bengaluru',
        state: 'Karnataka', pin: '560001',
      } } as any, response as any, ((error: unknown) => { passedError = error; }) as any);
      if (passedError) throw passedError;
      return { statusCode, body };
    };

    const first = await invokeRegistration();
    assert.equal(first.statusCode, 201);
    assert.equal(first.body.data.emailSent, true);
    assert.equal(first.body.data.welcomeEmailSent, true);
    assert.equal(messages.length, 2);
    assert.match(messages[0].text, /verify-email#token=/);
    assert.match(messages[1].text, /Shop Dashboard: https:\/\/shop.example.test\/login/);

    existingUser = { id: 'user-1', email: 'owner@example.test' };
    const duplicate = await invokeRegistration();
    assert.equal(duplicate.statusCode, 409);
    assert.equal(messages.length, 2);

    existingUser = null;
    shouldFailDelivery = true;
    const unavailable = await invokeRegistration();
    assert.equal(unavailable.statusCode, 201);
    assert.equal(unavailable.body.data.emailSent, false);
    assert.equal(unavailable.body.data.welcomeEmailSent, false);
    assert.equal('token' in unavailable.body.data, false);
  } finally {
    EmailService.setTransporterFactoryForTests(null);
    db.user.findUnique = original.userFindUnique;
    db.user.updateMany = original.userUpdateMany;
    db.shop.findUnique = original.shopFindUnique;
    db.subscriptionPlan.findUnique = original.planFindUnique;
    db.authActionToken.create = original.tokenCreate;
    db.authActionToken.updateMany = original.tokenUpdateMany;
    db.$transaction = original.transaction;
    previousEnv.forEach((value, key) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  }
});

test('password recovery is generic, cooldown-limited, hash-only, single-use, and revokes existing sessions', async () => {
  const envKeys = ['NODE_ENV', 'SHOP_PORTAL_URL', 'CUSTOMER_PORTAL_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME', 'SMTP_FROM'];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const db = prisma as any;
  const original = {
    userFindUnique: db.user.findUnique,
    userUpdate: db.user.update,
    auditCreate: db.auditLog.create,
    transaction: db.$transaction,
  };
  const user: any = { id: 'owner-1', email: 'owner@example.test', name: 'Owner', role: 'SHOP_OWNER', isActive: true, sessionVersion: 0, passwordHash: 'old-hash' };
  let accountExists = true;
  let action: any = null;
  const messages: any[] = [];
  const tx = {
    authActionToken: {
      findFirst: async () => action ? { createdAt: action.createdAt } : null,
      findUnique: async ({ where }: any) => action?.tokenHash === where.tokenHash ? action : null,
      create: async ({ data }: any) => { action = { ...data, id: 'action-1', userId: user.id, createdAt: new Date(), usedAt: null }; return action; },
      updateMany: async ({ where, data }: any) => {
        if (!action || (where.id && where.id !== action.id) || (where.tokenHash && where.tokenHash !== action.tokenHash)) return { count: 0 };
        if (where.usedAt === null && action.usedAt) return { count: 0 };
        if (where.expiresAt?.gt && action.expiresAt <= where.expiresAt.gt) return { count: 0 };
        action = { ...action, ...data };
        return { count: 1 };
      },
    },
    user: {
      update: async ({ data }: any) => {
        user.passwordHash = data.passwordHash;
        user.sessionVersion += data.sessionVersion.increment;
        return { email: user.email, name: user.name };
      },
    },
  };

  try {
    process.env.NODE_ENV = 'test';
    process.env.SHOP_PORTAL_URL = 'https://shop.example.test';
    process.env.CUSTOMER_PORTAL_URL = 'https://customer.example.test';
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'mailer@example.test';
    process.env.SMTP_PASS = 'test-only-password';
    process.env.SMTP_FROM_EMAIL = 'no-reply@example.test';
    db.user.findUnique = async () => accountExists ? user : null;
    db.user.update = async () => user;
    db.auditLog.create = async () => ({});
    db.$transaction = async (callback: (transaction: any) => unknown) => callback(tx);
    EmailService.setTransporterFactoryForTests(() => ({
      sendMail: async (message: any) => { messages.push(message); return { accepted: [message.to], rejected: [] }; },
      close: () => undefined,
    } as any));

    const requestReset = async () => {
      let statusCode = 0;
      let body: any;
      const response = { status(code: number) { statusCode = code; return this; }, json(value: any) { body = value; return this; } };
      await AuthController.forgotPassword({ body: { email: 'owner@example.test' } } as any, response as any, ((error: unknown) => { throw error; }) as any);
      return { statusCode, body };
    };
    const first = await requestReset();
    assert.equal(first.statusCode, 200);
    assert.equal(first.body.message, 'If an eligible account exists, recovery instructions will be sent.');
    assert.equal('token' in first.body, false);
    assert.match(messages[0].text, /https:\/\/shop.example.test\/reset-password#token=/);
    const rawToken = messages[0].text.match(/#token=([A-Za-z0-9_-]+)/)?.[1];
    assert.ok(rawToken);
    assert.notEqual(action.tokenHash, rawToken);
    assert.equal(action.tokenHash, crypto.createHash('sha256').update(rawToken!).digest('hex'));

    const cooldown = await requestReset();
    assert.equal(cooldown.statusCode, 200);
    assert.equal(messages.length, 1);
    accountExists = false;
    const unknown = await requestReset();
    assert.deepEqual(unknown.body, first.body);
    assert.equal(messages.length, 1);
    accountExists = true;

    action.expiresAt = new Date(Date.now() - 1_000);
    let expiredStatus = 0;
    const expiredResponse = { status(code: number) { expiredStatus = code; return this; }, json() { return this; } };
    await AuthController.resetPassword({ body: { token: rawToken, password: 'a-new-secure-password-123' } } as any, expiredResponse as any, ((error: unknown) => { throw error; }) as any);
    assert.equal(expiredStatus, 400);
    assert.equal(user.sessionVersion, 0);

    action.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    let resetStatus = 0;
    let resetBody: any;
    const resetResponse = { status(code: number) { resetStatus = code; return this; }, json(value: any) { resetBody = value; return this; } };
    await AuthController.resetPassword({ body: { token: rawToken, password: 'a-new-secure-password-123' } } as any, resetResponse as any, ((error: unknown) => { throw error; }) as any);
    assert.equal(resetStatus, 200);
    assert.equal(user.sessionVersion, 1);
    assert.match(user.passwordHash, /^\$2[aby]\$/);
    assert.notEqual(user.passwordHash, 'a-new-secure-password-123');
    assert.equal(action.usedAt instanceof Date, true);
    assert.equal('token' in resetBody, false);
    assert.match(messages[1].subject, /password was changed/i);

    let loginStatus = 0;
    let loginBody: any;
    const loginResponse = { status(code: number) { loginStatus = code; return this; }, json(value: any) { loginBody = value; return this; } };
    user.emailVerificationRequired = false;
    user.ownedShops = [];
    user.staffMembers = [];
    await AuthController.login({ body: { email: user.email, password: 'a-new-secure-password-123' }, ip: '127.0.0.1', get: () => 'email-test' } as any, loginResponse as any, ((error: unknown) => { throw error; }) as any);
    assert.equal(loginStatus, 200);
    assert.equal(loginBody.success, true);

    let reusedStatus = 0;
    const reusedResponse = { status(code: number) { reusedStatus = code; return this; }, json() { return this; } };
    await AuthController.resetPassword({ body: { token: rawToken, password: 'another-secure-password-456' } } as any, reusedResponse as any, ((error: unknown) => { throw error; }) as any);
    assert.equal(reusedStatus, 400);
    assert.equal(user.sessionVersion, 1);
  } finally {
    EmailService.setTransporterFactoryForTests(null);
    db.user.findUnique = original.userFindUnique;
    db.user.update = original.userUpdate;
    db.auditLog.create = original.auditCreate;
    db.$transaction = original.transaction;
    previousEnv.forEach((value, key) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  }
});

test('shop registration accepts only the shop onboarding payload and refuses role overrides', () => {
  const valid = { shopName: 'Example Print', ownerName: 'Shop Owner', email: 'owner@example.com', phone: '9876543210', password: 'correct-horse-battery-9', planId: 'plan-1' };
  const parsed = ShopRegistrationSchema.safeParse(valid);
  assert.equal(parsed.success, true);
  assert.equal(ShopRegistrationSchema.safeParse({ ...valid, role: 'ADMIN' }).success, false);
  assert.equal(ShopRegistrationSchema.safeParse({ ...valid, password: 'short' }).success, false);
});

test('login payload cannot select its own role; role is read from the stored account', () => {
  const parsed = LoginSchema.parse({ email: 'owner@example.com', password: 'long-password', role: 'SUPER_ADMIN' });
  assert.deepEqual(parsed, { email: 'owner@example.com', password: 'long-password' });
});

test('admin-only route middleware rejects shop owners and allows existing administrators', () => {
  const run = (role: string) => {
    let statusCode = 0;
    let passed = false;
    const response = { status(code: number) { statusCode = code; return this; }, json() { return this; } };
    requireAdmin({ user: { id: 'user-1', email: 'x@example.com', role } } as any, response as any, (() => { passed = true; }) as any);
    return { statusCode, passed };
  };
  assert.deepEqual(run('SHOP_OWNER'), { statusCode: 403, passed: false });
  assert.deepEqual(run('SUPER_ADMIN'), { statusCode: 0, passed: true });
});

test('free-print requests are opt-in flags and do not accept a client total', () => {
  const result = CreateOrderSchema.safeParse({
    shopSlug: 'sample-shop', paymentMethod: 'PAY_AT_COUNTER', freePrintRequested: true, totalAmount: 0,
    items: [{ fileId: '8a5c1b7c-cbe7-45dc-8c60-735c70ee8c12', settings: { copies: 2 } }],
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.freePrintRequested, true);
    assert.equal('totalAmount' in result.data, false);
  }
});

test('free-print allowance checks page impressions and copy caps together', () => {
  const usage = { requestedPages: 20, requestedCopies: 2, completedPages: 30, reservedPages: 10, pageLimit: 60, completedCopies: 5, reservedCopies: 1, copyLimit: 8 };
  assert.equal(canReserveFreePrintAllowance(usage), true);
  assert.equal(canReserveFreePrintAllowance({ ...usage, pageLimit: 59 }), false);
  assert.equal(canReserveFreePrintAllowance({ ...usage, copyLimit: 7 }), false);
  assert.equal(canReserveFreePrintAllowance({ ...usage, requestedPages: 0 }), false);
});

test('free-print calendar buckets use Asia/Kolkata date boundaries', () => {
  assert.deepEqual(kolkataPeriodKeys(new Date('2026-10-28T18:45:00.000Z')), { dayKey: '2026-10-29', monthKey: '2026-10' });
});

test('college free-print policy respects enablement and configured start/expiry times', () => {
  const now = new Date('2026-10-29T12:00:00.000Z');
  assert.equal(isFreePrintPolicyActive(null, now), false);
  assert.equal(isFreePrintPolicyActive({ enabled: false, startsAt: null, expiresAt: null }, now), false);
  assert.equal(isFreePrintPolicyActive({ enabled: true, startsAt: new Date('2026-10-29T12:01:00.000Z'), expiresAt: null }, now), false);
  assert.equal(isFreePrintPolicyActive({ enabled: true, startsAt: null, expiresAt: new Date('2026-10-29T11:59:00.000Z') }, now), false);
  assert.equal(isFreePrintPolicyActive({ enabled: true, startsAt: now, expiresAt: new Date('2026-10-29T12:01:00.000Z') }, now), true);
});

test('guest ID matching stores a keyed hash and normalizes case, spaces, and hyphens', () => {
  const first = hashCollegeIdNumber('institution-1', 'ab-12 34');
  assert.equal(first, hashCollegeIdNumber('institution-1', 'AB1234'));
  assert.notEqual(first, hashCollegeIdNumber('institution-2', 'AB1234'));
  assert.notEqual(first, 'AB1234');
  assert.notEqual(hashGuestAccessToken('a'.repeat(48)), 'a'.repeat(48));
});

test('guest ID photo review is restricted to the owning shop owner', () => {
  assert.equal(canShopOwnerReviewGuestId('SHOP_OWNER', 'shop-a', 'shop-a'), true);
  assert.equal(canShopOwnerReviewGuestId('SHOP_OWNER', 'shop-a', 'shop-b'), false);
  assert.equal(canShopOwnerReviewGuestId('SHOP_STAFF', 'shop-a', 'shop-a'), false);
  assert.equal(canShopOwnerReviewGuestId('ADMIN', null, 'shop-a'), false);
});

test('print-agent heartbeat accepts a valid bearer credential and scopes update by agent id', async () => {
  const db = prisma as any;
  const originalFindUnique = db.printerAgent.findUnique;
  const originalUpdateMany = db.printerAgent.updateMany;
  let updated: any;
  try {
    db.printerAgent.findUnique = async ({ where }: any) => where.agentToken === 'test-agent-credential'
      ? { id: 'agent-123', shopId: 'shop-123' }
      : null;
    db.printerAgent.updateMany = async (args: any) => { updated = args; return { count: 1 }; };
    let statusCode = 0;
    let body: any;
    const req: any = {
      body: { status: 'CONNECTED' },
      get: (name: string) => name.toLowerCase() === 'authorization' ? 'Bearer test-agent-credential' : undefined,
    };
    const res: any = {
      status(code: number) { statusCode = code; return this; },
      json(value: any) { body = value; return this; },
    };

    await AgentController.agentHeartbeat(req, res, (error: unknown) => { throw error; });

    assert.equal(statusCode, 200);
    assert.equal(body.success, true);
    assert.deepEqual(updated.where, { id: 'agent-123' });
    assert.equal(updated.data.status, 'CONNECTED');
    assert.ok(updated.data.lastHeartbeat instanceof Date);
  } finally {
    db.printerAgent.findUnique = originalFindUnique;
    db.printerAgent.updateMany = originalUpdateMany;
  }
});

test('print-agent heartbeat rejects missing bearer credentials', async () => {
  const db = prisma as any;
  const originalFindUnique = db.printerAgent.findUnique;
  try {
    db.printerAgent.findUnique = async () => null;
    let statusCode = 0;
    const req: any = { body: { status: 'CONNECTED' }, get: () => undefined };
    const res: any = { status(code: number) { statusCode = code; return this; }, json() { return this; } };

    await AgentController.agentHeartbeat(req, res, (error: unknown) => { throw error; });

    assert.equal(statusCode, 401);
  } finally {
    db.printerAgent.findUnique = originalFindUnique;
  }
});
