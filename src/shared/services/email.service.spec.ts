// src/shared/services/email.service.spec.ts
// Unit tests for backend resolution + email dispatching.

import { ConfigService } from '@nestjs/config';
import {
  EmailService,
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

  it('accepts EMAIL_PROVIDER as alias to EMAIL_BACKEND', () => {
    const env = {
      EMAIL_PROVIDER: 'mailjet',
      RESEND_API_KEY: 're_x',
    } as NodeJS.ProcessEnv;
    expect(resolveEmailBackend(env)).toBe('mailjet');
    expect(isEmailDeliveryConfigured(env)).toBe(true);
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

describe('EmailService dispatching', () => {
  let service: EmailService;
  let configService: ConfigService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation();
  });

  afterEach(() => {
    fetchMock.mockRestore();
    jest.clearAllMocks();
  });

  it('dispatches verification email via Mailjet HTTPS API successfully', async () => {
    configService = new ConfigService({
      EMAIL_BACKEND: 'mailjet',
      MAILJET_API_KEY: 'key123',
      MAILJET_SECRET_KEY: 'secret123',
      DEFAULT_FROM_EMAIL: 'CollabAI <soviseth@example.com>',
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Messages: [
          {
            Status: 'success',
            To: [{ MessageID: 987654 }],
          },
        ],
      }),
    });

    service = new EmailService(configService);
    service.onModuleInit();

    await service.sendVerificationCode('user@example.com', '654321');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mailjet.com/v3.1/send');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toContain('Basic ');

    const body = JSON.parse(options.body);
    expect(body.Messages[0].To[0].Email).toBe('user@example.com');
    expect(body.Messages[0].From.Email).toBe('soviseth@example.com');
    expect(body.Messages[0].TextPart).toContain('654321');
  });

  it('dispatches email via Resend HTTPS API when Resend is configured', async () => {
    configService = new ConfigService({
      EMAIL_BACKEND: 'resend',
      RESEND_API_KEY: 're_test_key',
      DEFAULT_FROM_EMAIL: 'CollabAI <soviseth@example.com>',
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => '',
    });

    service = new EmailService(configService);
    service.onModuleInit();

    await service.sendPasswordResetCode('user@example.com', '112233');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.headers.Authorization).toBe('Bearer re_test_key');

    const body = JSON.parse(options.body);
    expect(body.to).toEqual(['user@example.com']);
    expect(body.text).toContain('112233');
  });

  it('swallows send errors so auth flow is not broken', async () => {
    configService = new ConfigService({
      EMAIL_BACKEND: 'mailjet',
      MAILJET_API_KEY: 'key123',
      MAILJET_SECRET_KEY: 'secret123',
    });

    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    service = new EmailService(configService);
    service.onModuleInit();

    await expect(
      service.sendVerificationCode('user@example.com', '123456'),
    ).resolves.not.toThrow();
  });
});
