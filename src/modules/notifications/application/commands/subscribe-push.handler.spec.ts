// src/modules/notifications/application/commands/subscribe-push.handler.spec.ts

import { SubscribePushHandler } from './subscribe-push.handler';
import { SubscribePushCommand } from './subscribe-push.command';
import { IPushSubscriptionRepository } from '../../domain/repositories/push-subscription.repository.interface';

describe('SubscribePushHandler', () => {
  let handler: SubscribePushHandler;
  let repo: jest.Mocked<IPushSubscriptionRepository>;

  beforeEach(() => {
    repo = {
      save: jest.fn().mockResolvedValue(undefined),
      findByUserId: jest.fn(),
      findByEndpoint: jest.fn(),
      deleteByEndpoint: jest.fn(),
      deleteByEndpoints: jest.fn(),
    };
    handler = new SubscribePushHandler(repo);
  });

  it('should save a valid push subscription entity', async () => {
    const cmd = new SubscribePushCommand(
      'user-123',
      'https://push.service.com/send/1',
      'BNcKey...',
      'authSecret...',
      'Mozilla/5.0...',
    );

    await handler.execute(cmd);

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls[0][0];
    expect(saved.userId).toBe('user-123');
    expect(saved.endpoint).toBe('https://push.service.com/send/1');
    expect(saved.p256dh).toBe('BNcKey...');
    expect(saved.auth).toBe('authSecret...');
    expect(saved.userAgent).toBe('Mozilla/5.0...');
  });

  it('should throw InvalidPushSubscriptionError if required fields are missing', async () => {
    const invalidCmd = new SubscribePushCommand('', '', '', '', '');
    await expect(handler.execute(invalidCmd)).rejects.toThrow();
  });
});
