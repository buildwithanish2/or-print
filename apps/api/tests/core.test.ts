import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PricingEngineService } from '../src/services/pricing.service';
import { CreateOrderSchema, LoginSchema, ShopRegistrationSchema } from '../../../packages/validation/src/index';
import crypto from 'crypto';
import { canCollectCashPayment, canManageShopPayment, canReviewManualUpiPayment, decryptPaymentCredentialWithKey, encryptPaymentCredentialWithKey, isValidUpiVpa, verifyRazorpaySignature, verifyRazorpayWebhookSignature } from '../src/services/payment.service';
import { canReserveFreePrintAllowance, canShopOwnerReviewGuestId, hashCollegeIdNumber, hashGuestAccessToken, isFreePrintPolicyActive, kolkataPeriodKeys } from '../src/services/free-print.service';
import { AuthController } from '../src/controllers/auth.controller';
import { requireAdmin } from '../src/middleware/rbac.middleware';
import { errorHandler } from '../src/middleware/error.middleware';

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
