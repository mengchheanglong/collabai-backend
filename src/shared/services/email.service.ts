// src/shared/services/email.service.ts
//
// Transactional email delivery with pluggable backends:
//
//   EMAIL_BACKEND = log | smtp | resend | mailjet   (auto-detected from keys if unset)
//   (EMAIL_PROVIDER is also accepted as an alias)
//
//   - log     — dev default: prints the email (incl. verification codes) to the console
//   - smtp    — nodemailer SMTP. NOTE: Render's free tier blocks outbound SMTP ports
//               25/465/587 (since Sept 2025), so SMTP only works locally or on paid plans.
//   - resend  — Resend HTTP API  (api.resend.com, port 443 — works on Render free tier)
//   - mailjet — Mailjet HTTP API (api.mailjet.com, port 443 — works on Render free tier)
//
// Env precedence for the sender address:
//   DEFAULT_FROM_EMAIL > SMTP_FROM > EMAIL_USER > 'CollabAI <no-reply@localhost>'
//
// Email failures must never break the auth flow (they're triggered from an event
// listener), so every backend swallows errors after logging them.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type EmailBackend = 'log' | 'smtp' | 'resend' | 'mailjet';

/** `throwOnError` lets a queue worker see delivery failures so it can retry them. */
export interface SendOptions {
  throwOnError?: boolean;
}

export interface MailBody {
  text: string;
  html: string;
}

/** Accepts plain values ("resend") and Django-style ones ("notifications.email_backends.ResendAPIBackend"). */
const BACKEND_ALIASES: Record<string, EmailBackend> = {
  log: 'log',
  console: 'log',
  logemailbackend: 'log',
  smtp: 'smtp',
  smtpbackend: 'smtp',
  smtpemailbackend: 'smtp',
  resend: 'resend',
  resendapibackend: 'resend',
  mailjet: 'mailjet',
  mailjetapibackend: 'mailjet',
};

function normalizeBackendName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase()
    .replace(/^.*email_backends\./, '');
}

/**
 * Resolve the active backend. An explicit EMAIL_BACKEND / EMAIL_PROVIDER always wins
 * (falling back to `log` if its keys are missing); otherwise auto-detect from
 * whichever API keys are present: resend > mailjet > smtp > log.
 */
export function resolveEmailBackend(
  env: NodeJS.ProcessEnv = process.env,
): EmailBackend {
  const configured = env.EMAIL_BACKEND ?? env.EMAIL_PROVIDER;
  const explicit = BACKEND_ALIASES[normalizeBackendName(configured) ?? ''];
  if (explicit) return explicit;
  if (env.RESEND_API_KEY) return 'resend';
  if (env.MAILJET_API_KEY && env.MAILJET_SECRET_KEY) return 'mailjet';
  if (env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASS) return 'smtp';
  return 'log';
}

/**
 * True when a real delivery backend is active — i.e. codes actually go out by email.
 * With the `log` backend, codes are printed to the server console for local development.
 */
export function isEmailDeliveryConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveEmailBackend(env) !== 'log';
}

/** Parse `"Name" <email@host>` or `email@host` into Mailjet's From shape. */
function parseFrom(from: string): { email: string; name?: string } {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) {
    const name = m[1].trim();
    return { name: name || undefined, email: m[2].trim() };
  }
  return { email: from.trim() };
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private backend: EmailBackend = 'log';
  private transporter?: Transporter;
  private from = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const envObj: NodeJS.ProcessEnv = {
      ...process.env,
      ...(this.config.get<string>('EMAIL_BACKEND')
        ? { EMAIL_BACKEND: this.config.get<string>('EMAIL_BACKEND') }
        : {}),
      ...(this.config.get<string>('EMAIL_PROVIDER')
        ? { EMAIL_PROVIDER: this.config.get<string>('EMAIL_PROVIDER') }
        : {}),
      ...(this.config.get<string>('RESEND_API_KEY')
        ? { RESEND_API_KEY: this.config.get<string>('RESEND_API_KEY') }
        : {}),
      ...(this.config.get<string>('MAILJET_API_KEY')
        ? { MAILJET_API_KEY: this.config.get<string>('MAILJET_API_KEY') }
        : {}),
      ...(this.config.get<string>('MAILJET_SECRET_KEY')
        ? { MAILJET_SECRET_KEY: this.config.get<string>('MAILJET_SECRET_KEY') }
        : {}),
      ...(this.config.get<string>('EMAIL_HOST')
        ? { EMAIL_HOST: this.config.get<string>('EMAIL_HOST') }
        : {}),
      ...(this.config.get<string>('EMAIL_USER')
        ? { EMAIL_USER: this.config.get<string>('EMAIL_USER') }
        : {}),
      ...(this.config.get<string>('EMAIL_PASS')
        ? { EMAIL_PASS: this.config.get<string>('EMAIL_PASS') }
        : {}),
      ...(this.config.get<string>('EMAIL_PORT')
        ? { EMAIL_PORT: this.config.get<string>('EMAIL_PORT') }
        : {}),
    };
    this.backend = resolveEmailBackend(envObj);
    this.from =
      this.config.get<string>('DEFAULT_FROM_EMAIL') ??
      this.config.get<string>('SMTP_FROM') ??
      this.config.get<string>('EMAIL_USER') ??
      'CollabAI <no-reply@localhost>';

    if (this.backend === 'smtp') {
      const host = this.config.get<string>('EMAIL_HOST');
      const user = this.config.get<string>('EMAIL_USER');
      const pass = this.config.get<string>('EMAIL_PASS');
      const port = parseInt(this.config.get<string>('EMAIL_PORT') ?? '587', 10);
      if (!host || !user || !pass) {
        this.logger.warn(
          'EMAIL_BACKEND=smtp but EMAIL_HOST/EMAIL_USER/EMAIL_PASS are missing — falling back to log.',
        );
        this.backend = 'log';
        return;
      }
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
        auth: { user, pass },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
      });
      this.logger.log(`Email backend: smtp (host=${host}, port=${port}).`);
      return;
    }

    if (this.backend === 'resend') {
      const configuredFrom =
        this.config.get<string>('DEFAULT_FROM_EMAIL') ??
        this.config.get<string>('SMTP_FROM');
      this.from = configuredFrom ?? 'CollabAI <onboarding@resend.dev>';
      if (!this.config.get<string>('RESEND_API_KEY')) {
        this.logger.warn(
          'EMAIL_BACKEND=resend but RESEND_API_KEY is missing — falling back to log.',
        );
        this.backend = 'log';
        return;
      }
      this.logger.log(`Email backend: resend (from="${this.from}").`);
      return;
    }

    if (
      this.backend === 'mailjet' &&
      !(
        this.config.get<string>('MAILJET_API_KEY') &&
        this.config.get<string>('MAILJET_SECRET_KEY')
      )
    ) {
      this.logger.warn(
        'EMAIL_BACKEND=mailjet but MAILJET_API_KEY/MAILJET_SECRET_KEY are missing — falling back to log.',
      );
      this.backend = 'log';
      return;
    }

    this.logger.log(
      this.backend === 'log'
        ? 'Email backend: log (emails printed to console — set EMAIL_BACKEND/keys for real delivery).'
        : `Email backend: ${this.backend} (from="${this.from}").`,
    );
  }

  /** Whether a real delivery backend is active (exposed for health checks / guards). */
  get activeBackend(): EmailBackend {
    return this.backend;
  }

  /** Verify provider readiness / connection. */
  async verifyConnection(): Promise<boolean> {
    try {
      if (this.backend === 'smtp') {
        if (!this.transporter) return false;
        await this.transporter.verify();
        return true;
      }
      if (this.backend === 'mailjet') {
        return Boolean(
          this.config.get<string>('MAILJET_API_KEY') &&
          this.config.get<string>('MAILJET_SECRET_KEY'),
        );
      }
      if (this.backend === 'resend') {
        return Boolean(this.config.get<string>('RESEND_API_KEY'));
      }
      return true;
    } catch (err) {
      this.logger.error(
        `Email connection verify failed: ${(err as Error).message}`,
      );
      return false;
    }
  }

  async sendVerificationCode(
    to: string,
    code: string,
    options: SendOptions = {},
  ): Promise<void> {
    await this.send(
      to,
      'Verify your email address — CollabAI',
      this.codeTemplate(
        'Verify your email address',
        'Welcome to CollabAI! Enter the code below to verify your email address and activate your account.',
        code,
      ),
      options,
    );
  }

  async sendPasswordResetCode(
    to: string,
    code: string,
    options: SendOptions = {},
  ): Promise<void> {
    await this.send(
      to,
      'Reset your password — CollabAI',
      this.codeTemplate(
        'Reset your password',
        'We received a request to reset your CollabAI account password. Use the code below to proceed.',
        code,
      ),
      options,
    );
  }

  async sendPasswordResetSuccess(
    to: string,
    options: SendOptions = {},
  ): Promise<void> {
    const title = 'Password changed successfully';
    const text = [
      '========================================',
      'CollabAI — Password Changed Successfully',
      '========================================',
      '',
      'Your CollabAI account password has been changed successfully.',
      '',
      'If you did not make this change, please reset your password immediately',
      'or contact support to protect your account.',
      '',
      '--',
      'CollabAI Team',
    ].join('\n');

    const contentHtml = `
      <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #0f172a; line-height: 1.3;">
        ${title}
      </h1>
      <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
        The password for your CollabAI account has been changed successfully.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
        <tr>
          <td style="background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px 18px;">
            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #991b1b;">
              Didn't make this change?
            </p>
            <p style="margin: 0; font-size: 13px; color: #b91c1c; line-height: 1.5;">
              If you did not perform this action, your account may be compromised. Please reset your password immediately or contact support.
            </p>
          </td>
        </tr>
      </table>
    `;

    await this.send(
      to,
      `${title} — CollabAI`,
      {
        text,
        html: this.wrapEmailLayout(title, contentHtml),
      },
      options,
    );
  }

  async sendProjectInvitation(
    to: string,
    projectName: string,
    inviterName: string,
    inviteUrl: string,
    options: SendOptions = {},
  ): Promise<void> {
    const subject = `You've been invited to join ${projectName} on CollabAI`;
    const text = [
      '========================================',
      'CollabAI — Project Invitation',
      '========================================',
      '',
      `${inviterName} has invited you to collaborate on ${projectName} on CollabAI.`,
      '',
      `Accept your invitation by visiting: ${inviteUrl}`,
      '',
      'This invitation expires in 7 days.',
      '',
      '--',
      'CollabAI Team',
    ].join('\n');

    const contentHtml = `
      <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #0f172a; line-height: 1.3;">
        You're invited to collaborate!
      </h1>
      <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
        <strong style="color: #0f172a;">${inviterName}</strong> has invited you to collaborate on the project <strong style="color: #4f46e5;">${projectName}</strong> on CollabAI.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0;">
        <tr>
          <td align="center">
            <a href="${inviteUrl}" target="_blank" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
              Accept Invitation
            </a>
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b;">
        Or copy and paste this URL into your browser:
      </p>
      <p style="margin: 0 0 20px 0; font-size: 13px; word-break: break-all;">
        <a href="${inviteUrl}" target="_blank" style="color: #4f46e5; text-decoration: underline;">${inviteUrl}</a>
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="background-color: #f8fafc; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #64748b;">
            ⏳ This invitation will expire in <strong>7 days</strong>.
          </td>
        </tr>
      </table>
    `;

    await this.send(
      to,
      subject,
      {
        text,
        html: this.wrapEmailLayout(subject, contentHtml),
      },
      options,
    );
  }

  private async send(
    to: string,
    subject: string,
    body: MailBody,
    options: SendOptions = {},
  ): Promise<void> {
    try {
      switch (this.backend) {
        case 'smtp':
          if (this.transporter) {
            const info = (await this.transporter.sendMail({
              from: this.from,
              to,
              subject,
              text: body.text,
              html: body.html,
            })) as { messageId?: string };
            this.logger.log(
              `Email sent: "${subject}" -> ${to} (messageId=${info.messageId})`,
            );
          }
          return;
        case 'resend':
          await this.sendViaResend(to, subject, body);
          this.logger.log(`Email sent: "${subject}" -> ${to} (via Resend)`);
          return;
        case 'mailjet':
          await this.sendViaMailjet(to, subject, body);
          this.logger.log(`Email sent: "${subject}" -> ${to} (via Mailjet)`);
          return;
        default:
          this.logger.log(`[LOG-EMAIL] "${subject}" -> ${to}\n${body.text}`);
          return;
      }
    } catch (err) {
      // Only rethrow when asked (queue worker retries) — an email failure must not
      // break registration / reset flows.
      this.logger.error(
        `Email send failed (${this.backend}): "${subject}" -> ${to}: ${(err as Error).message}`,
      );
      if (options.throwOnError) throw err;
    }
  }

  /** Resend HTTP API — https://resend.com/docs/api-reference (port 443, Render-safe). */
  private async sendViaResend(
    to: string,
    subject: string,
    body: MailBody,
  ): Promise<void> {
    const key = this.config.get<string>('RESEND_API_KEY');
    let from = this.from;
    if (!from || from.includes('@localhost')) {
      from = 'CollabAI <onboarding@resend.dev>';
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body.text,
        html: body.html,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(
        `Resend API ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
  }

  /** Mailjet Send API v3.1 — https://dev.mailjet.com (port 443, Render-safe). */
  private async sendViaMailjet(
    to: string,
    subject: string,
    body: MailBody,
  ): Promise<void> {
    const key = this.config.get<string>('MAILJET_API_KEY');
    const secret = this.config.get<string>('MAILJET_SECRET_KEY');
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const from = parseFrom(this.from);
    const res = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Messages: [
          {
            From: {
              Email: from.email,
              ...(from.name ? { Name: from.name } : {}),
            },
            To: [{ Email: to }],
            Subject: subject,
            TextPart: body.text,
            HTMLPart: body.html,
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(
        `Mailjet API ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
  }

  private codeTemplate(title: string, intro: string, code: string): MailBody {
    const text = [
      '========================================',
      `CollabAI — ${title}`,
      '========================================',
      '',
      intro,
      '',
      `    Verification Code: ${code}`,
      '',
      'This code expires in 15 minutes and can only be used once.',
      '',
      'Security Note: Never share this code with anyone.',
      'If you did not request this, please ignore this email.',
      '',
      '--',
      'CollabAI Team',
    ].join('\n');

    const contentHtml = `
      <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #0f172a; line-height: 1.3;">
        ${title}
      </h1>
      <p style="margin: 0 0 28px 0; font-size: 15px; color: #475569; line-height: 1.6;">
        ${intro}
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 28px;">
        <tr>
          <td style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 26px 16px; text-align: center;">
            <span style="font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 10px;">
              Your Verification Code
            </span>
            <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0f172a; line-height: 1; padding: 4px 0 8px 10px;">
              ${code}
            </div>
            <span style="font-size: 12px; font-weight: 500; color: #64748b; display: block;">
              Expires in <strong>15 minutes</strong> • One-time use
            </span>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px;">
        <tr>
          <td style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; border-radius: 4px; padding: 12px 16px;">
            <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
              <strong style="color: #0f172a;">Security Note:</strong> Never share this code with anyone. CollabAI will never ask you for your code via phone, chat, or email.
            </p>
          </td>
        </tr>
      </table>
    `;

    return {
      text,
      html: this.wrapEmailLayout(title, contentHtml),
    };
  }

  /**
   * Enterprise-grade, responsive email wrapper compatible with all major email clients
   * (Gmail, Apple Mail, Outlook, Yahoo, and mobile screens).
   */
  private wrapEmailLayout(title: string, contentHtml: string): string {
    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; width: 100%; margin: 0; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Wrapper -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; width: 100%; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Header with Brand Icon -->
          <tr>
            <td style="padding: 32px 36px 24px 36px; border-bottom: 1px solid #f1f5f9; text-align: left;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); width: 40px; height: 40px; border-radius: 12px; text-align: center; vertical-align: middle;">
                    <span style="color: #ffffff; font-weight: 800; font-size: 20px; line-height: 40px; display: inline-block;">✦</span>
                  </td>
                  <td style="padding-left: 14px; font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                    Collab<span style="color: #4f46e5;">AI</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              ${contentHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #475569;">
                CollabAI • Real-Time Collaborative Workspace
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                This automated message was sent to verify your identity. If you did not make this request, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
        <!-- Sub-footer copyright -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; margin-top: 20px; text-align: center;">
          <tr>
            <td style="font-size: 12px; color: #94a3b8;">
              © 2026 CollabAI. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
