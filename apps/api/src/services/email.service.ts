import nodemailer from 'nodemailer';

type EmailPurpose = 'verify' | 'reset';

interface SmtpConfiguration {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string | { name: string; address: string };
}

export interface WelcomeEmailPayload {
  to: string;
  ownerName: string;
  shopName: string;
  planName: string;
  shopUrl: string;
  customerUrl: string;
}

type TransporterFactory = (configuration: SmtpConfiguration) => nodemailer.Transporter;

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

const readSmtpConfiguration = (env: NodeJS.ProcessEnv): SmtpConfiguration | null => {
  const host = env.SMTP_HOST?.trim() || '';
  const user = env.SMTP_USER?.trim() || '';
  const pass = env.SMTP_PASS || '';
  const portText = env.SMTP_PORT?.trim() || '587';
  const port = Number(portText);
  const secureText = env.SMTP_SECURE?.trim().toLowerCase();
  const fromEmail = env.SMTP_FROM_EMAIL?.trim();
  const legacyFrom = env.SMTP_FROM?.trim();
  const fromName = (env.SMTP_FROM_NAME?.trim() || 'AnishNova Print').replace(/[\r\n]/g, '');

  if (!host || /\s|[\r\n]/.test(host) || !user || !pass
    || !/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535
    || (secureText && secureText !== 'true' && secureText !== 'false')) return null;

  if (fromEmail) {
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(fromEmail) || /[\r\n]/.test(fromEmail)) return null;
    return {
      host, port, secure: secureText ? secureText === 'true' : port === 465,
      user, pass, from: { name: fromName, address: fromEmail },
    };
  }

  // Keep SMTP_FROM working for deployments configured before the split sender fields existed.
  if (!legacyFrom || /[\r\n]/.test(legacyFrom)) return null;
  return {
    host, port, secure: secureText ? secureText === 'true' : port === 465,
    user, pass, from: legacyFrom,
  };
};

const safeEmailUrl = (value: string): string => {
  const url = new URL(value);
  if (!['https:', ...(process.env.NODE_ENV === 'production' ? [] : ['http:'])].includes(url.protocol)) {
    throw new Error('Email links must use HTTPS in production.');
  }
  return url.toString();
};

const sendMail = async (transporter: nodemailer.Transporter, message: nodemailer.SendMailOptions): Promise<void> => {
  const info = await transporter.sendMail(message);
  if (Array.isArray(info.accepted) && info.accepted.length === 0) {
    throw new Error('SMTP did not accept the recipient.');
  }
};

const renderActionEmail = (link: string, purpose: EmailPurpose) => {
  const verify = purpose === 'verify';
  const title = verify ? 'Verify your email address' : 'Reset your password';
  const description = verify
    ? 'Confirm that this email address belongs to you to activate your shop account.'
    : 'Use this one-time link to choose a new password for your AnishNova Print account.';
  const action = verify ? 'Verify email' : 'Reset password';
  const safeLink = escapeHtml(link);
  const text = `${title}\n\n${description}\n\n${link}\n\nThis one-time link expires in 30 minutes. If you did not request it, you can ignore this email.`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;color:#172033"><main style="max-width:560px;margin:auto;padding:32px;background:#fff;border:1px solid #e2e8f0;border-radius:16px"><p style="margin:0 0 20px;color:#6d28d9;font-weight:700">AnishNova Print</p><h1 style="font-size:24px">${title}</h1><p style="line-height:1.6">${description}</p><p style="margin:28px 0"><a href="${safeLink}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700">${action}</a></p><p style="font-size:13px;color:#64748b">This one-time link expires in 30 minutes. If you did not request it, you can ignore this email.</p></main></body></html>`;
  return { text, html };
};

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;
  private static testTransporterFactory: TransporterFactory | null = null;

  static isConfigured(): boolean {
    return readSmtpConfiguration(process.env) !== null;
  }

  private static getTransporter(): { transporter: nodemailer.Transporter; from: SmtpConfiguration['from'] } | null {
    const configuration = readSmtpConfiguration(process.env);
    if (!configuration) return null;
    if (!this.transporter) {
      const factory = this.testTransporterFactory || ((config) => nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.pass },
        requireTLS: !config.secure,
        tls: { minVersion: 'TLSv1.2' },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      }));
      this.transporter = factory(configuration);
    }
    return { transporter: this.transporter, from: configuration.from };
  }

  static async sendActionLink(to: string, link: string, purpose: EmailPurpose): Promise<boolean> {
    const mailer = this.getTransporter();
    if (!mailer) return false;
    const safeLink = safeEmailUrl(link);
    const verify = purpose === 'verify';
    const rendered = renderActionEmail(safeLink, purpose);
    await sendMail(mailer.transporter, {
      from: mailer.from,
      to,
      subject: verify ? 'Verify your AnishNova Print email' : 'Reset your AnishNova Print password',
      ...rendered,
    });
    return true;
  }

  static async sendWelcomeEmail(payload: WelcomeEmailPayload): Promise<boolean> {
    const mailer = this.getTransporter();
    if (!mailer) return false;
    const shopUrl = safeEmailUrl(payload.shopUrl);
    const shopLoginUrl = `${shopUrl.replace(/\/$/, '')}/login`;
    const customerUrl = safeEmailUrl(payload.customerUrl);
    const ownerName = escapeHtml(payload.ownerName);
    const shopName = escapeHtml(payload.shopName);
    const planName = escapeHtml(payload.planName);
    const text = `Welcome to AnishNova Print, ${payload.ownerName}.\n\nYour shop ${payload.shopName} has been registered with the ${payload.planName} plan. Verify your email before signing in.\n\nShop Dashboard: ${shopLoginUrl}\nCustomer print page: ${customerUrl}\n\nAfter verification, sign in to finish setup and pair your print agent from the dashboard.`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;color:#172033"><main style="max-width:600px;margin:auto;padding:32px;background:#fff;border:1px solid #e2e8f0;border-radius:16px"><p style="margin:0 0 20px;color:#6d28d9;font-weight:700">AnishNova Print</p><h1 style="font-size:24px">Welcome, ${ownerName}</h1><p style="line-height:1.6">Your shop <strong>${shopName}</strong> has been registered on AnishNova Print with the <strong>${planName}</strong> plan. Verify your email before signing in; your shop access remains pending until verification.</p><p><a href="${escapeHtml(shopLoginUrl)}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700">Open Shop Dashboard</a></p><p>After verifying your email, sign in to finish setup and pair your print agent from the dashboard.</p><p><a href="${escapeHtml(customerUrl)}">View your customer print page</a></p><p style="font-size:13px;color:#64748b">If you did not create this shop, please contact support.</p></main></body></html>`;
    await sendMail(mailer.transporter, {
      from: mailer.from, to: payload.to,
      subject: 'Welcome to AnishNova Print', text, html,
    });
    return true;
  }

  static async sendPasswordChangedNotice(to: string, name: string): Promise<boolean> {
    const mailer = this.getTransporter();
    if (!mailer) return false;
    const safeName = escapeHtml(name);
    const text = `Hello ${name},\n\nYour AnishNova Print password was changed. If you did not make this change, contact support immediately.`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;color:#172033"><main style="max-width:560px;margin:auto;padding:32px;background:#fff;border:1px solid #e2e8f0;border-radius:16px"><p style="color:#6d28d9;font-weight:700">AnishNova Print</p><h1 style="font-size:22px">Password changed</h1><p>Hello ${safeName}, your account password was changed.</p><p>If you did not make this change, contact support immediately.</p></main></body></html>`;
    await sendMail(mailer.transporter, { from: mailer.from, to, subject: 'Your AnishNova Print password was changed', text, html });
    return true;
  }

  /** Test-only seam; production code should always use the authenticated SMTP transport. */
  static setTransporterFactoryForTests(factory: TransporterFactory | null): void {
    this.transporter?.close();
    this.transporter = null;
    this.testTransporterFactory = factory;
  }
}
