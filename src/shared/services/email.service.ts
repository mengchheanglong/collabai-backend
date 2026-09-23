// src/shared/services/email.service.ts
//
// Transactional email delivery with pluggable backends:
//
//   EMAIL_BACKEND = log | smtp | resend | mailjet   (auto-detected from keys if unset)
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

interface MailBody {
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
 * Resolve the active backend. An explicit EMAIL_BACKEND always wins (falling back
 * to `log` if its keys are missing); otherwise auto-detect from whichever API keys
 * are present: resend > mailjet > smtp > log.
 */
export function resolveEmailBackend(
  env: NodeJS.ProcessEnv = process.env,
): EmailBackend {
  const explicit =
    BACKEND_ALIASES[normalizeBackendName(env.EMAIL_BACKEND) ?? ''];
  if (explicit) return explicit;
  if (env.RESEND_API_KEY) return 'resend';
  if (env.MAILJET_API_KEY && env.MAILJET_SECRET_KEY) return 'mailjet';
  if (env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASS) return 'smtp';
  return 'log';
}

/**
 * True when a real delivery backend is active — i.e. codes actually go out by email.
 * Used to gate the `000000` development fallback verification code.
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
    this.backend = resolveEmailBackend(process.env);
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

  private async send(
    to: string,
    subject: string,
    body: MailBody,
  ): Promise<void> {
    try {
      switch (this.backend) {
        case 'smtp':
          if (this.transporter) {
            // nodemailer's SentMessageInfo is typed `any`; assert the shape we use.
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
      // Never rethrow — an email failure must not break registration / reset flows.
      this.logger.error(
        `Email send failed (${this.backend}): "${subject}" -> ${to}: ${(err as Error).message}`,
      );
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
    });
    if (!res.ok) {
      throw new Error(
        `Mailjet API ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
  }

  private codeTemplate(title: string, intro: string, code: string): MailBody {
    const text = `${intro}\n\nYour code: ${code}\n\nThis code expires in 15 minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="margin-bottom: 8px;">${title}</h2>
        <p style="color: #444;">${intro}</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px;
                    background: #f4f4f5; padding: 16px 0; text-align: center;
                    border-radius: 8px; margin: 16px 0;">${code}</div>
        <p style="color: #888; font-size: 13px;">This code expires in 15 minutes.</p>
      </div>`;
    return { text, html };
  }
}
