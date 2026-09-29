// src/shared/services/email.service.ts
//
// Multi-provider email service supporting HTTPS REST APIs and SMTP.
//
// IMPORTANT (Render & Cloud Deployments):
// Render's free/standard instances block outbound SMTP ports (25, 465, 587), causing
// traditional SMTP transports (e.g. Gmail SMTP) to fail with connection timeouts
// or "Network is unreachable".
//
// To solve this, this service supports HTTPS REST API backends that communicate over
// port 443 (which is never blocked):
//   1. Mailjet API  — https://api.mailjet.com/v3.1/send (6,000 free/month, no domain needed)
//   2. Resend API   — https://api.resend.com/emails
//   3. Brevo API    — https://api.brevo.com/v3/smtp/email (300/day free)
//   4. SendGrid API — https://api.sendgrid.com/v3/mail/send (100/day free)
//   5. SMTP         — Nodemailer fallback (for local development or unblocked environments)
//   6. Console      — Prints verification codes to terminal in dev when unconfigured

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type EmailProviderType =
  | 'mailjet'
  | 'resend'
  | 'brevo'
  | 'sendgrid'
  | 'smtp'
  | 'console';

export interface MailBody {
  text: string;
  html: string;
}

export interface SenderInfo {
  name: string;
  email: string;
  formatted: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private provider: EmailProviderType = 'console';
  private transporter?: Transporter;
  private sender: SenderInfo = {
    name: 'CollabAI',
    email: 'no-reply@collabai.local',
    formatted: 'CollabAI <no-reply@collabai.local>',
  };

  // API credentials
  private mailjetApiKey = '';
  private mailjetSecretKey = '';
  private resendApiKey = '';
  private brevoApiKey = '';
  private sendgridApiKey = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.sender = this.resolveSender();
    this.mailjetApiKey = this.config.get<string>('MAILJET_API_KEY') ?? '';
    this.mailjetSecretKey = this.config.get<string>('MAILJET_SECRET_KEY') ?? '';
    this.resendApiKey = this.config.get<string>('RESEND_API_KEY') ?? '';
    this.brevoApiKey = this.config.get<string>('BREVO_API_KEY') ?? '';
    this.sendgridApiKey = this.config.get<string>('SENDGRID_API_KEY') ?? '';

    this.provider = this.determineProvider();

    if (this.provider === 'smtp') {
      const host = this.config.get<string>('EMAIL_HOST');
      const user = this.config.get<string>('EMAIL_USER');
      const pass = this.config.get<string>('EMAIL_PASS');
      const port = parseInt(this.config.get<string>('EMAIL_PORT') ?? '587', 10);

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`Email transport initialized: SMTP (${host}:${port})`);
    } else {
      this.logger.log(`Email transport initialized: ${this.provider.toUpperCase()} (HTTPS API)`);
    }
  }

  /**
   * Determine which provider to use based on EMAIL_PROVIDER / EMAIL_BACKEND
   * or available API credentials.
   */
  private determineProvider(): EmailProviderType {
    const raw = (
      this.config.get<string>('EMAIL_PROVIDER') ??
      this.config.get<string>('EMAIL_BACKEND') ??
      ''
    ).toLowerCase();

    if (raw.includes('mailjet')) return 'mailjet';
    if (raw.includes('resend')) return 'resend';
    if (raw.includes('brevo')) return 'brevo';
    if (raw.includes('sendgrid')) return 'sendgrid';
    if (raw.includes('smtp')) return 'smtp';
    if (raw.includes('console')) return 'console';

    // Auto-detection fallback
    if (this.mailjetApiKey && this.mailjetSecretKey) return 'mailjet';
    if (this.resendApiKey) return 'resend';
    if (this.brevoApiKey) return 'brevo';
    if (this.sendgridApiKey) return 'sendgrid';

    const host = this.config.get<string>('EMAIL_HOST');
    const user = this.config.get<string>('EMAIL_USER');
    const pass = this.config.get<string>('EMAIL_PASS');
    if (host && user && pass) return 'smtp';

    this.logger.warn(
      'No email API keys or SMTP configured — falling back to CONSOLE email logging.',
    );
    return 'console';
  }

  private resolveSender(): SenderInfo {
    const raw =
      this.config.get<string>('DEFAULT_FROM_EMAIL') ??
      this.config.get<string>('SMTP_FROM') ??
      this.config.get<string>('EMAIL_USER') ??
      'CollabAI <no-reply@collabai.local>';

    const trimmed = raw.trim();
    const match = trimmed.match(/^(?:["']?([^"']*)["']?\s*)?<([^>]+)>$/);
    if (match) {
      const name = match[1]?.trim() || 'CollabAI';
      const email = match[2]?.trim() || '';
      return {
        name,
        email,
        formatted: name ? `"${name}" <${email}>` : email,
      };
    }
    return { name: 'CollabAI', email: trimmed, formatted: trimmed };
  }

  /**
   * Verify provider readiness / connection.
   */
  async verifyConnection(): Promise<boolean> {
    try {
      if (this.provider === 'smtp') {
        if (!this.transporter) return false;
        await this.transporter.verify();
        return true;
      }
      if (this.provider === 'mailjet') {
        return Boolean(this.mailjetApiKey && this.mailjetSecretKey);
      }
      if (this.provider === 'resend') {
        return Boolean(this.resendApiKey);
      }
      if (this.provider === 'brevo') {
        return Boolean(this.brevoApiKey);
      }
      if (this.provider === 'sendgrid') {
        return Boolean(this.sendgridApiKey);
      }
      return true;
    } catch (err) {
      this.logger.error(`Email connection verify failed: ${(err as Error).message}`);
      return false;
    }
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    await this.send(
      to,
      'Verify your email address',
      this.codeTemplate(
        'Verify your email',
        'Use the code below to verify your email address.',
        code,
      ),
    );
  }

  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    await this.send(
      to,
      'Reset your password',
      this.codeTemplate(
        'Reset your password',
        'Use the code below to reset your password. If you did not request this, ignore this email.',
        code,
      ),
    );
  }

  async sendPasswordResetSuccess(to: string): Promise<void> {
    await this.send(to, 'Your password was changed', {
      text:
        'Your password was changed successfully. ' +
        "If this wasn't you, contact support immediately.",
      html:
        '<p>Your password was changed successfully.</p>' +
        "<p>If this wasn't you, please contact support immediately.</p>",
    });
  }

  /**
   * Main dispatch: calls the appropriate provider over HTTPS (or SMTP/console).
   * Failures are logged and caught so auth flows are never interrupted.
   */
  private async send(to: string, subject: string, body: MailBody): Promise<void> {
    try {
      switch (this.provider) {
        case 'mailjet':
          await this.sendViaMailjet(to, subject, body);
          break;
        case 'resend':
          await this.sendViaResend(to, subject, body);
          break;
        case 'brevo':
          await this.sendViaBrevo(to, subject, body);
          break;
        case 'sendgrid':
          await this.sendViaSendGrid(to, subject, body);
          break;
        case 'smtp':
          await this.sendViaSmtp(to, subject, body);
          break;
        case 'console':
        default:
          this.sendViaConsole(to, subject, body);
          break;
      }
    } catch (err) {
      this.logger.error(
        `[${this.provider.toUpperCase()}] Email send failed: "${subject}" -> ${to}: ${(err as Error).message}`,
      );
    }
  }

  // ── HTTPS Provider: Mailjet (v3.1) ──────────────────────────────────────────
  private async sendViaMailjet(to: string, subject: string, body: MailBody): Promise<void> {
    const authHeader =
      'Basic ' +
      Buffer.from(`${this.mailjetApiKey}:${this.mailjetSecretKey}`).toString('base64');

    const payload = {
      Messages: [
        {
          From: {
            Email: this.sender.email,
            Name: this.sender.name,
          },
          To: [{ Email: to }],
          Subject: subject,
          TextPart: body.text,
          HTMLPart: body.html,
        },
      ],
    };

    const res = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = (await res.json()) as {
      Messages?: Array<{
        Status?: string;
        Errors?: unknown[];
        To?: Array<{ MessageID?: number; MessageUUID?: string }>;
      }>;
    };

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    }

    const firstMsg = data?.Messages?.[0];
    if (firstMsg?.Status !== 'success') {
      throw new Error(`Message rejected: ${JSON.stringify(firstMsg?.Errors ?? data)}`);
    }

    const messageId = firstMsg?.To?.[0]?.MessageID;
    this.logger.log(`Mailjet accepted email: "${subject}" -> ${to} (id=${messageId})`);
  }

  // ── HTTPS Provider: Resend ──────────────────────────────────────────────────
  private async sendViaResend(to: string, subject: string, body: MailBody): Promise<void> {
    const payload = {
      from: this.sender.formatted,
      to: [to],
      subject,
      text: body.text,
      html: body.html,
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.resendApiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = (await res.json()) as { id?: string; message?: string };
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    }

    this.logger.log(`Resend accepted email: "${subject}" -> ${to} (id=${data.id})`);
  }

  // ── HTTPS Provider: Brevo ───────────────────────────────────────────────────
  private async sendViaBrevo(to: string, subject: string, body: MailBody): Promise<void> {
    const payload = {
      sender: {
        name: this.sender.name,
        email: this.sender.email,
      },
      to: [{ email: to }],
      subject,
      textContent: body.text,
      htmlContent: body.html,
    };

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': this.brevoApiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = (await res.json()) as { messageId?: string };
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    }

    this.logger.log(`Brevo accepted email: "${subject}" -> ${to} (id=${data.messageId})`);
  }

  // ── HTTPS Provider: SendGrid ────────────────────────────────────────────────
  private async sendViaSendGrid(to: string, subject: string, body: MailBody): Promise<void> {
    const payload = {
      personalizations: [{ to: [{ email: to }] }],
      from: {
        email: this.sender.email,
        name: this.sender.name,
      },
      subject,
      content: [
        { type: 'text/plain', value: body.text },
        { type: 'text/html', value: body.html },
      ],
    };

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.sendgridApiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const messageId = res.headers.get('x-message-id');
    this.logger.log(`SendGrid accepted email: "${subject}" -> ${to} (id=${messageId})`);
  }

  // ── SMTP Fallback (Nodemailer) ──────────────────────────────────────────────
  private async sendViaSmtp(to: string, subject: string, body: MailBody): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP transporter is not configured');
    }

    const info = await this.transporter.sendMail({
      from: this.sender.formatted,
      to,
      subject,
      text: body.text,
      html: body.html,
    });

    this.logger.log(
      `Email sent via SMTP: "${subject}" -> ${to} (messageId=${info.messageId})`,
    );
  }

  // ── Console Fallback (Development & Testing) ────────────────────────────────
  private sendViaConsole(to: string, subject: string, body: MailBody): void {
    this.logger.log(
      `\n------------------- [CONSOLE EMAIL] -------------------\n` +
        `To: ${to}\n` +
        `From: ${this.sender.formatted}\n` +
        `Subject: ${subject}\n` +
        `Body:\n${body.text}\n` +
        `-------------------------------------------------------`,
    );
  }

  private codeTemplate(title: string, intro: string, code: string): MailBody {
    const text = `${intro}\n\nYour code: ${code}\n\nThis code expires in 15 minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <h2 style="margin-bottom: 8px; color: #111827;">${title}</h2>
        <p style="color: #4b5563; font-size: 15px;">${intro}</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px;
                    background: #f3f4f6; padding: 18px 0; text-align: center;
                    border-radius: 8px; margin: 20px 0; color: #1f2937; border: 1px solid #e5e7eb;">
          ${code}
        </div>
        <p style="color: #9ca3af; font-size: 13px;">This code expires in 15 minutes. If you did not request this, please ignore this email.</p>
      </div>`;
    return { text, html };
  }
}
