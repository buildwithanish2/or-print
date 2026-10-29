import QRCode from 'qrcode';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { prisma } from '../prisma';

export const verifyRazorpaySignature = (orderId: string, paymentId: string, signature: string, secret: string): boolean => {
  if (!orderId || !paymentId || !signature || !secret || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && crypto.timingSafeEqual(expected, supplied);
};

export const verifyRazorpayWebhookSignature = (rawBody: Buffer, signature: string, secret: string): boolean => {
  if (!rawBody?.length || !signature || !secret || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && crypto.timingSafeEqual(expected, supplied);
};

export const isValidUpiVpa = (value: string): boolean => /^[A-Za-z0-9._-]{2,100}@[A-Za-z0-9.-]{2,64}$/.test(value.trim());

export const canCollectCashPayment = (paymentMethod: string, paymentStatus: string, printStatus: string): boolean =>
  paymentMethod === 'PAY_AT_COUNTER' && paymentStatus === 'CASH_ON_COUNTER' && printStatus === 'QUEUED';

export const canManageShopPayment = (actorRole: string, actorShopId: string | null | undefined, orderShopId: string): boolean =>
  ['SUPER_ADMIN', 'ADMIN'].includes(actorRole) || Boolean(actorShopId && actorShopId === orderShopId);

export const canReviewManualUpiPayment = (paymentMethod: string, paymentStatus: string, gateway: string, proofRef: string | null, amount: number, orderAmount: number): boolean =>
  paymentMethod === 'UPI' && paymentStatus === 'PAYMENT_SUBMITTED' && gateway === 'UPI' && Boolean(proofRef) && amount === orderAmount;

const getPlatformRazorpay = (): Razorpay | null => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;
};

const parseCredentialEncryptionKey = (configured: string): Buffer => {
  if (!/^[a-f\d]{64}$/i.test(configured)) {
    throw new Error('Payment credential encryption is not configured (expected a 64-character hex key)');
  }
  return Buffer.from(configured, 'hex');
};

export const encryptPaymentCredentialWithKey = (value: string, keyHex: string): string => {
  if (!value) throw new Error('Payment credential cannot be empty');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', parseCredentialEncryptionKey(keyHex), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ciphertext.toString('hex')}`;
};

export const decryptPaymentCredentialWithKey = (value: string, keyHex: string): string => {
  if (!value.startsWith('enc:v1:')) return value;
  const [, , ivHex, tagHex, encryptedHex] = value.split(':');
  if (!ivHex || !tagHex || !encryptedHex || !/^[a-f\d]+$/i.test(ivHex) || !/^[a-f\d]{32}$/i.test(tagHex) || !/^[a-f\d]+$/i.test(encryptedHex)) {
    throw new Error('Stored payment credential is malformed');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', parseCredentialEncryptionKey(keyHex), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
};

export const encryptPaymentCredential = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (value.startsWith('enc:v1:')) return value;
  return encryptPaymentCredentialWithKey(value, process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY || '');
};

export const decryptPaymentCredential = (value: string | null | undefined): string | null => {
  if (!value) return null;
  // Existing installations may contain legacy plaintext credentials; preserve
  // availability while new writes are encrypted and APIs never return secrets.
  if (!value.startsWith('enc:v1:')) return value;
  return decryptPaymentCredentialWithKey(value, process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY || '');
};

export interface PaymentInitResult {
  gateway: string;
  paymentId: string;
  amount: number;
  currency: string;
  upiQrDataUrl?: string;
  upiIntentUrl?: string;
  razorpayOrderId?: string;
  keyId?: string;
  status: string;
}

export class PaymentGatewayService {
  static async createSubscriptionOrder(planId: string) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Subscription plan not found');
    const amountPaise = Math.round(plan.priceMonthly * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      throw new Error('A paid subscription plan with a valid monthly price is required');
    }
    const razorpay = getPlatformRazorpay();
    if (!razorpay) throw new Error('Platform Razorpay checkout is not configured');

    const receipt = `sub_${crypto.randomBytes(12).toString('hex')}`;
    const gatewayOrder = await razorpay.orders.create({ amount: amountPaise, currency: 'INR', receipt });
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const attempt = await prisma.subscriptionPaymentAttempt.create({
      data: { planId, gatewayOrderId: gatewayOrder.id, amountPaise, currency: 'INR', expiresAt },
    });
    return { attemptId: attempt.id, orderId: gatewayOrder.id, amount: amountPaise, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID!, planName: plan.name };
  }

  static async verifySubscriptionPayment(attemptId: string, orderId: string, paymentId: string, signature: string) {
    const attempt = await prisma.subscriptionPaymentAttempt.findUnique({ where: { id: attemptId }, include: { plan: true } });
    if (!attempt || attempt.gatewayOrderId !== orderId) throw new Error('Subscription payment attempt was not found');
    if (!['PENDING', 'PAID'].includes(attempt.status) || (attempt.status === 'PENDING' && attempt.expiresAt <= new Date())) throw new Error('Subscription payment attempt is no longer payable');
    const razorpay = getPlatformRazorpay();
    if (!razorpay) throw new Error('Platform Razorpay verification is not configured');
    if (!verifyRazorpaySignature(orderId, paymentId, signature, process.env.RAZORPAY_KEY_SECRET!)) {
      throw new Error('Invalid Razorpay payment signature');
    }

    const payment = await razorpay.payments.fetch(paymentId);
    if (payment.order_id !== orderId || payment.amount !== attempt.amountPaise || payment.currency !== attempt.currency || payment.status !== 'captured') {
      throw new Error('Razorpay payment is not captured for the expected amount and order');
    }
    if (attempt.status === 'PAID' && attempt.gatewayPaymentId !== paymentId) throw new Error('Subscription payment attempt was already paid by another transaction');
    return { attempt, payment };
  }

  /**
   * Generates dynamic UPI URI complying with NPCI UPI Specs
   * format: upi://pay?pa=VPA&pn=NAME&am=AMOUNT&tr=ORDER_ID&tn=NOTE&cu=INR
   */
  static generateUpiUri(
    vpa: string,
    payeeName: string,
    amount: number,
    orderNumber: string,
    note: string
  ): string {
    const cleanVpa = encodeURIComponent(vpa);
    const cleanName = encodeURIComponent(payeeName || 'PrintQR Cloud Services');
    const cleanAmt = amount.toFixed(2);
    const cleanTr = encodeURIComponent(orderNumber);
    const cleanNote = encodeURIComponent(note || `Print Order ${orderNumber}`);

    return `upi://pay?pa=${cleanVpa}&pn=${cleanName}&am=${cleanAmt}&tr=${cleanTr}&tn=${cleanNote}&cu=INR`;
  }

  /**
   * Initializes payment transaction for order
   */
  static async initializeOrderPayment(
    orderId: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string,
    shopName: string,
    configuredUpiVpa?: string
  ): Promise<PaymentInitResult> {
    const upiVpa = configuredUpiVpa;
    if (paymentMethod === 'UPI' && !upiVpa) {
      throw new Error('UPI payment is not configured for this shop');
    }

    const payment = await prisma.payment.create({
      data: {
        orderId,
        amount,
        gateway: paymentMethod.startsWith('RAZORPAY') ? 'RAZORPAY' : paymentMethod,
        paymentMethod,
        status: paymentMethod === 'PAY_AT_COUNTER' ? 'PENDING' : 'PENDING',
      },
    });

    if (paymentMethod === 'PAY_AT_COUNTER') {
      return {
        gateway: 'COUNTER_CASH',
        paymentId: payment.id,
        amount,
        currency: 'INR',
        status: 'PENDING',
      };
    }

    if (paymentMethod === 'UPI') {
      const upiIntentUrl = this.generateUpiUri(upiVpa!, shopName, amount, orderNumber, `Print order ${orderNumber}`);
      const upiQrDataUrl = await QRCode.toDataURL(upiIntentUrl, {
        margin: 1,
        width: 350,
        color: { dark: '#0f172a', light: '#ffffff' },
      });

      return {
        gateway: 'UPI_DIRECT',
        paymentId: payment.id,
        amount,
        currency: 'INR',
        upiQrDataUrl,
        upiIntentUrl,
        status: 'PENDING',
      };
    }

    // Razorpay orders are created by the dedicated checkout endpoint only;
    // never return synthetic order IDs or placeholder public keys.
    return {
      gateway: 'RAZORPAY',
      paymentId: payment.id,
      amount,
      currency: 'INR',
      status: 'PENDING',
    };
  }

}
