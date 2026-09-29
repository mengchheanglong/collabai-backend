// src/shared/services/email.service.spec.ts
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService', () => {
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

  it('initializes with Mailjet provider when MAILJET_API_KEY is configured', () => {
    configService = new ConfigService({
      EMAIL_PROVIDER: 'mailjet',
      MAILJET_API_KEY: 'test-api-key',
      MAILJET_SECRET_KEY: 'test-secret-key',
      DEFAULT_FROM_EMAIL: 'CollabAI <noreply@collabai.com>',
    });

    service = new EmailService(configService);
    service.onModuleInit();

    expect((service as any).provider).toBe('mailjet');
    expect((service as any).sender.email).toBe('noreply@collabai.com');
    expect((service as any).sender.name).toBe('CollabAI');
  });

  it('dispatches verification email via Mailjet HTTPS API successfully', async () => {
    configService = new ConfigService({
      EMAIL_PROVIDER: 'mailjet',
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
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_key',
      DEFAULT_FROM_EMAIL: 'CollabAI <soviseth@example.com>',
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'resend-msg-123' }),
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
      EMAIL_PROVIDER: 'mailjet',
      MAILJET_API_KEY: 'key123',
      MAILJET_SECRET_KEY: 'secret123',
    });

    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    service = new EmailService(configService);
    service.onModuleInit();

    // Should not throw
    await expect(
      service.sendVerificationCode('user@example.com', '123456'),
    ).resolves.not.toThrow();
  });
});
