import nodemailer from 'nodemailer';
import { prisma } from '../prisma';
import { getShopWebUrl, getCustomerWebUrl } from '@printqr/config';

export interface WelcomeEmailPayload {
  to: string;
  ownerName: string;
  shopName: string;
  planName: string;
  shopId: string;
  pairingCode: string;
  customerUrl: string;
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  static isConfigured(): boolean {
    const port = Number(process.env.SMTP_PORT || 587);
    return Boolean(process.env.SMTP_HOST && Number.isInteger(port) && port > 0 && port < 65536
      && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
  }

  /**
   * Initializes or returns the Nodemailer SMTP Transporter
   */
  private static getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (this.isConfigured() && host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      return this.transporter;
    }

    return null;
  }

  static async sendActionLink(to: string, link: string, purpose: 'verify' | 'reset'): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) return false;
    const verify = purpose === 'verify';
    const subject = verify ? 'Verify your OR PRINT shop email' : 'Reset your OR PRINT password';
    const action = verify ? 'Verify email' : 'Reset password';
    const description = verify
      ? 'Confirm that this email address belongs to you to activate shop access.'
      : 'Use this one-time link to choose a new password.';
    const safeLink = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    await transporter.sendMail({
      from: process.env.SMTP_FROM!, to, subject,
      text: `${description}\n\n${link}\n\nThis link expires soon. If you did not request it, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033"><h2>${action}</h2><p>${description}</p><p><a href="${safeLink}">${action}</a></p><p>This one-time link expires in 30 minutes. If you did not request it, ignore this email.</p></div>`,
    });
    return true;
  }

  /**
   * Sends Welcome & Account Activation Email to Shop Owner
   */
  static async sendWelcomeEmail(payload: WelcomeEmailPayload): Promise<{ success: boolean; message: string }> {
    try {
      const { to, ownerName, shopName, planName, shopId, pairingCode, customerUrl } = payload;
      const shopWebUrl = getShopWebUrl();

      // Professional HTML Email Template
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
            .card { max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155; }
            .header { text-align: center; border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 24px; }
            .brand { font-size: 22px; font-weight: 900; color: #c084fc; letter-spacing: -0.5px; }
            .brand-sub { font-size: 12px; color: #94a3b8; margin-top: 4px; }
            .badge { display: inline-block; padding: 6px 14px; background-color: #7c3aed; color: #ffffff; border-radius: 20px; font-weight: bold; font-size: 12px; margin: 12px 0; }
            .field-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; font-size: 13px; }
            .field-label { color: #94a3b8; }
            .field-val { font-weight: bold; color: #ffffff; }
            .pin-box { background-color: #0b0f19; border: 1px solid #7c3aed; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0; }
            .pin-code { font-size: 24px; font-weight: 900; font-family: monospace; color: #34d399; letter-spacing: 2px; }
            .btn { display: block; width: 100%; text-align: center; background-color: #7c3aed; color: #ffffff !important; padding: 14px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px; margin-top: 24px; }
            .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 28px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="brand">AnishNova Print</div>
              <div class="brand-sub">Cloud-Native QR Printing &amp; Spooler Platform</div>
            </div>

            <h2>Hello ${ownerName},</h2>
            <p style="color: #cbd5e1; font-size: 13px; line-height: 1.6;">
              Congratulations! Your print shop <strong style="color: #ffffff;">${shopName}</strong> has been registered and activated on AnishNova Print.
            </p>

            <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; margin: 16px 0;">
              <div class="field-row">
                <span class="field-label">Shop Name:</span>
                <span class="field-val">${shopName}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Shop ID:</span>
                <span class="field-val" style="font-family: monospace; color: #c084fc;">${shopId}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Subscription Plan:</span>
                <span class="field-val">${planName}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Login Email:</span>
                <span class="field-val">${to}</span>
              </div>
              <div class="field-row" style="border-bottom: none;">
                <span class="field-label">Password:</span>
                <span class="field-val" style="color: #38bdf8;">Created securely during registration</span>
              </div>
            </div>

            <div class="pin-box">
              <div style="font-size: 11px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Windows Agent 10-Minute Pairing PIN</div>
              <div class="pin-code">${pairingCode}</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Enter this PIN into the Windows Print Agent to connect your local printers.</div>
            </div>

            <h4 style="color: #ffffff; margin-bottom: 8px;">Next Steps to Start Printing:</h4>
            <ol style="color: #cbd5e1; font-size: 12px; line-height: 1.8; padding-left: 20px;">
              <li>Login to your Shop Dashboard at <a href="${shopWebUrl}" style="color: #c084fc;">${shopWebUrl}</a></li>
              <li>Download &amp; Install the <strong>AnishNova Print Agent</strong> for Windows.</li>
              <li>Enter your Shop Pairing PIN: <code style="color: #34d399; font-weight: bold;">${pairingCode}</code>.</li>
              <li>Print your high-resolution A4 Counter Standee from the QR Studio.</li>
            </ol>

            <a href="${shopWebUrl}/login" class="btn">Login to Shop Dashboard</a>

            <div class="footer">
              AnishNova Technologies • Contactless QR Printing Infrastructure<br>
              Need help? Contact support@anishnova.com
            </div>
          </div>
        </body>
        </html>
      `;

      const transporter = this.getTransporter();
      if (!transporter) return { success: false, message: 'Email delivery is not configured.' };
      {
        const fromAddress = process.env.SMTP_FROM!;
        await transporter.sendMail({
          from: fromAddress,
          to,
          subject: 'Welcome to AnishNova Print — Your Shop is Ready!',
          html: htmlContent,
        });
        console.info('Shop welcome email dispatched via SMTP.');
      }

      return {
        success: true,
        message: 'Welcome email sent.',
      };
    } catch (err: any) {
      console.error('Failed to send welcome email.');
      return { success: false, message: 'Failed to send email.' };
    }
  }
}
