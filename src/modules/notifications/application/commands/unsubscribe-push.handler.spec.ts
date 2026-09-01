// src/modules/notifications/application/commands/unsubscribe-push.handler.spec.ts

import { UnsubscribePushHandler } from './unsubscribe-push.handler';
import { UnsubscribePushCommand } from './unsubscribe-push.command';
import { IPushSubscriptionRepository } from '../../domain/repositories/push-subscription.repository.interface';

describe('UnsubscribePushHandler', () => {
  let handler: UnsubscribePushHandler;
  let repo: jest.Mocked<IPushSubscriptionRepository>;

  beforeEach(() => {
    repo = {
      save: jest.fn(),
      findByUserId: jest.fn(),
      findByEndpoint: jest.fn(),
      deleteByEndpoint: jest.fn(),
      deleteByEndpointAndUserId: jest.fn().mockResolvedValue(undefined),
      deleteByEndpoints: jest.fn(),
    };
    handler = new UnsubscribePushHandler(repo);
  });

  it('should call deleteByEndpointAndUserId with scoped userId and endpoint', async () => {
    const cmd = new UnsubscribePushCommand(
      'user-123',
      'https://fcm.googleapis.com/fcm/send/1',
    );

    await handler.execute(cmd);

    expect(repo.deleteByEndpointAndUserId).toHaveBeenCalledWith(
      'https://fcm.googleapis.com/fcm/send/1',
      'user-123',
    );
  });
});
