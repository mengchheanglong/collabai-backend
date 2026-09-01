// src/modules/notifications/application/commands/send-push-notification.handler.spec.ts

import { SendPushNotificationHandler } from './send-push-notification.handler';
import { SendPushNotificationCommand } from './send-push-notification.command';
import { IPushSubscriptionRepository } from '../../domain/repositories/push-subscription.repository.interface';
import { WebPushService } from '../../infrastructure/push/web-push.service';
import { PushSubscriptionEntity } from '../../domain/entities/push-subscription.entity';

describe('SendPushNotificationHandler', () => {
  let handler: SendPushNotificationHandler;
  let repo: jest.Mocked<IPushSubscriptionRepository>;
  let webPush: jest.Mocked<WebPushService>;

  beforeEach(() => {
    repo = {
      save: jest.fn(),
      findByUserId: jest.fn(),
      findByEndpoint: jest.fn(),
      deleteByEndpoint: jest.fn(),
      deleteByEndpoints: jest.fn(),
    };
    webPush = {
      getPublicKey: jest.fn(),
      sendNotification: jest.fn().mockResolvedValue(true),
    } as any;
    handler = new SendPushNotificationHandler(repo, webPush);
  });

  it('should fan out to all user subscriptions', async () => {
    const sub1 = PushSubscriptionEntity.create({
      userId: 'user-1',
      endpoint: 'https://push.com/1',
      p256dh: 'key1',
      auth: 'auth1',
    });
    const sub2 = PushSubscriptionEntity.create({
      userId: 'user-1',
      endpoint: 'https://push.com/2',
      p256dh: 'key2',
      auth: 'auth2',
    });

    repo.findByUserId.mockResolvedValue([sub1, sub2]);

    const cmd = new SendPushNotificationCommand(
      'user-1',
      'Task Assigned',
      'You were assigned to Real Madrid match',
      '/board',
    );

    await handler.execute(cmd);

    expect(repo.findByUserId).toHaveBeenCalledWith('user-1');
    expect(webPush.sendNotification).toHaveBeenCalledTimes(2);
    expect(webPush.sendNotification).toHaveBeenCalledWith(
      sub1,
      expect.objectContaining({
        title: 'Task Assigned',
        body: 'You were assigned to Real Madrid match',
      }),
    );
  });

  it('should do nothing if user has no push subscriptions', async () => {
    repo.findByUserId.mockResolvedValue([]);

    const cmd = new SendPushNotificationCommand('user-2', 'Title', 'Body');
    await handler.execute(cmd);

    expect(webPush.sendNotification).not.toHaveBeenCalled();
  });

  it('should handle repository errors gracefully without throwing', async () => {
    repo.findByUserId.mockRejectedValue(new Error('DB Query Failed'));

    const cmd = new SendPushNotificationCommand('user-error', 'Title', 'Body');
    await expect(handler.execute(cmd)).resolves.not.toThrow();
  });

  it('should do nothing and not throw if command or userId is missing', async () => {
    const cmd = new SendPushNotificationCommand('', 'Title', 'Body');
    await expect(handler.execute(cmd)).resolves.not.toThrow();
    expect(repo.findByUserId).not.toHaveBeenCalled();
  });
});
