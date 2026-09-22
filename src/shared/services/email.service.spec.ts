// src/shared/services/email.service.spec.ts
// Unit tests for backend resolution + fallback-code gating.

import {
  resolveEmailBackend,
  isEmailDeliveryConfigured,
} from './email.service';

describe('EmailService backend resolution', () => {
  const baseEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...baseEnv };
  });

  it('defaults to log when nothing is configured', () => {
    expect(resolveEmailBackend({})).toBe('log');
    expect(isEmailDeliveryConfigured({})).toBe(false);
  });

  it('explicit EMAIL_BACKEND always wins', () => {
    const env = {
      EMAIL_BACKEND: 'log',
      RESEND_API_KEY: 're_x',
    } as NodeJS.ProcessEnv;
    expect(resolveEmailBackend(env)).toBe('log');
    expect(isEmailDeliveryConfigured(env)).toBe(false);
  });

  it('accepts Django-style backend names (notifications.email_backends.*)', () => {
    expect(
      resolveEmailBackend({
        EMAIL_BACKEND: 'notifications.email_backends.ResendAPIBackend',
        RESEND_API_KEY: 're_x',
      }),
    ).toBe('resend');
    expect(
      resolveEmailBackend({
        EMAIL_BACKEND: 'notifications.email_backends.MailjetAPIBackend',
      }),
    ).toBe('mailjet');
  });

  it('auto-detects resend from RESEND_API_KEY', () => {
    const env = { RESEND_API_KEY: 're_x' } as NodeJS.ProcessEnv;
    expect(resolveEmailBackend(env)).toBe('resend');
    expect(isEmailDeliveryConfigured(env)).toBe(true);
  });

  it('auto-detects mailjet from its key pair', () => {
    const env = {
      MAILJET_API_KEY: 'k',
      MAILJET_SECRET_KEY: 's',
    } as NodeJS.ProcessEnv;
    expect(resolveEmailBackend(env)).toBe('mailjet');
    expect(isEmailDeliveryConfigured(env)).toBe(true);
  });

  it('auto-detects smtp from EMAIL_HOST/USER/PASS', () => {
    const env = {
      EMAIL_HOST: 'smtp.gmail.com',
      EMAIL_USER: 'a@b.c',
      EMAIL_PASS: 'x',
    } as NodeJS.ProcessEnv;
    expect(resolveEmailBackend(env)).toBe('smtp');
    expect(isEmailDeliveryConfigured(env)).toBe(true);
  });

  it('resend has priority over mailjet and smtp when auto-detecting', () => {
    const env = {
      RESEND_API_KEY: 're_x',
      MAILJET_API_KEY: 'k',
      MAILJET_SECRET_KEY: 's',
      EMAIL_HOST: 'smtp.gmail.com',
      EMAIL_USER: 'a@b.c',
      EMAIL_PASS: 'x',
    } as NodeJS.ProcessEnv;
    expect(resolveEmailBackend(env)).toBe('resend');
  });

  it('empty-string EMAIL_BACKEND falls through to auto-detect', () => {
    const env = {
      EMAIL_BACKEND: '',
      RESEND_API_KEY: 're_x',
    } as NodeJS.ProcessEnv;
    expect(resolveEmailBackend(env)).toBe('resend');
  });
});
