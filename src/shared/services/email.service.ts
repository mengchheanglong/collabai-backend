// src/shared/services/email.service.ts
//
// SendGrid email delivery for verification, password-reset, and invitation emails.
// Config comes from SENDGRID_API_KEY and SENDGRID_FROM (see .env.example).
// If SendGrid isn't configured, sends are skipped (logged) rather than throwing — email
// failures must never break the auth flow (they're triggered from an event listener).

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail = require('@sendgrid/mail');

interface MailBody {
  text: string;
  html: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private configured = false;
  private from = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.from = this.config.get<string>('SENDGRID_FROM') ?? 'no-reply@localhost';
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'Email not configured (SENDGRID_API_KEY missing) — emails will be skipped.',
      );
      return;
    }
    sgMail.setApiKey(apiKey);
    const apiBaseUrl = this.config.get<string>('SENDGRID_API_BASE_URL');
    if (apiBaseUrl) {
      // Set only in isolated staging/smoke environments to target a SendGrid-compatible
      // mock. Real deployments should omit this and use SendGrid's default endpoint.
      (sgMail as unknown as { client: { setDefaultRequest(key: string, value: string): void } })
        .client.setDefaultRequest('baseUrl', apiBaseUrl);
    }
    this.configured = true;
    this.logger.log('SendGrid email transport configured.');
  }

  /** Report whether SendGrid credentials are configured. */
  async verifyConnection(): Promise<boolean> {
    return this.configured;
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

  async sendProjectInvitation(to: string, projectName: string, inviterName: string, url: string, expiresAt?: Date): Promise<void> {
    const safeProject = this.escapeHtml(projectName);
    const safeInviter = this.escapeHtml(inviterName);
    const expiryText = expiresAt ? `This invitation expires ${expiresAt.toLocaleString()}.` : 'Sign in to view the project.';
    const expiryHtml = expiresAt ? `<p>This invitation expires ${expiresAt.toLocaleString()}.</p>` : '<p>Sign in to view the project.</p>';
    await this.send(to, `Invitation to join ${projectName} on CollabAI`, {
      text: `${inviterName} invited you to join ${projectName} on CollabAI. Open here: ${url}\n${expiryText}`,
      html: `<p>${safeInviter} invited you to join <strong>${safeProject}</strong> on CollabAI.</p><p><a href="${this.escapeHtml(url)}">Open project</a></p>${expiryHtml}`,
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  }

  private async send(
    to: string,
    subject: string,
    body: MailBody,
  ): Promise<void> {
    if (!this.configured) {
      this.logger.warn(
        `Email skipped (SendGrid not configured): "${subject}" -> ${to}`,
      );
      return;
    }
    try {
      const [response] = await sgMail.send({
        from: this.from,
        to,
        subject,
        text: body.text,
        html: body.html,
      });
      this.logger.log(
        `Email sent: "${subject}" -> ${to} (status=${response.statusCode})`,
      );
    } catch (err) {
      // Never rethrow — an email failure must not break registration / reset flows.
      this.logger.error(
        `Email send failed: "${subject}" -> ${to}: ${(err as Error).message}`,
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
