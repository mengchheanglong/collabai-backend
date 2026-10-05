// src/shared/infrastructure/rabbitmq/workers/email.worker.spec.ts

import { EmailWorker } from './email.worker';
import { QUEUE } from '../rabbitmq.constants';

describe('EmailWorker', () => {
  let email: Record<string, jest.Mock>;
  let rabbitmq: { consume: jest.Mock };
  let worker: EmailWorker;
  const strict = { throwOnError: true };

  beforeEach(() => {
    email = {
      sendVerificationCode: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetSuccess: jest.fn().mockResolvedValue(undefined),
      sendProjectInvitation: jest.fn().mockResolvedValue(undefined),
    };
    rabbitmq = { consume: jest.fn() };
    worker = new EmailWorker(rabbitmq as any, email as any);
  });

  it('registers on the email queue', () => {
    worker.onModuleInit();
    expect(rabbitmq.consume).toHaveBeenCalledWith(
      QUEUE.EMAIL,
      expect.any(Function),
    );
  });

  it('delivers each email job type with failures surfaced for retry', async () => {
    await worker.handle('email.verify', { to: 'a@b.c', code: '111111' });
    await worker.handle('email.password-reset', {
      to: 'a@b.c',
      code: '222222',
    });
    await worker.handle('email.password-reset-success', { to: 'a@b.c' });
    await worker.handle('email.project-invitation', {
      to: 'a@b.c',
      projectName: 'Alpha',
      inviterName: 'Alice',
      inviteUrl: 'http://x/accept-invite?token=t',
    });

    expect(email.sendVerificationCode).toHaveBeenCalledWith(
      'a@b.c',
      '111111',
      strict,
    );
    expect(email.sendPasswordResetCode).toHaveBeenCalledWith(
      'a@b.c',
      '222222',
      strict,
    );
    expect(email.sendPasswordResetSuccess).toHaveBeenCalledWith(
      'a@b.c',
      strict,
    );
    expect(email.sendProjectInvitation).toHaveBeenCalledWith(
      'a@b.c',
      'Alpha',
      'Alice',
      'http://x/accept-invite?token=t',
      strict,
    );
  });

  it('propagates delivery errors so the bus can retry', async () => {
    email.sendVerificationCode.mockRejectedValueOnce(new Error('Mailjet 503'));
    await expect(
      worker.handle('email.verify', { to: 'a@b.c', code: '1' }),
    ).rejects.toThrow('Mailjet 503');
  });

  it('skips unknown email jobs', async () => {
    await expect(worker.handle('email.unknown', {})).resolves.toBeUndefined();
  });
});
