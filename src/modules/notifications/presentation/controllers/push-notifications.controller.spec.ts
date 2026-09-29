// src/modules/notifications/presentation/controllers/push-notifications.controller.spec.ts

import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PushNotificationsController } from './push-notifications.controller';
import { SubscribePushCommand } from '../../application/commands/subscribe-push.command';
import { UnsubscribePushCommand } from '../../application/commands/unsubscribe-push.command';
import { SendPushNotificationCommand } from '../../application/commands/send-push-notification.command';
import { GetVapidPublicKeyQuery } from '../../application/queries/get-vapid-public-key.query';

describe('PushNotificationsController', () => {
  let controller: PushNotificationsController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  beforeEach(() => {
    commandBus = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as any;
    queryBus = {
      execute: jest.fn(),
    } as any;
    controller = new PushNotificationsController(commandBus, queryBus);
  });

  describe('getPublicKey', () => {
    it('should return VAPID public key via queryBus', async () => {
      queryBus.execute.mockResolvedValue({
        publicKey: 'mock-vapid-public-key',
      });

      const result = await controller.getPublicKey();

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetVapidPublicKeyQuery),
      );
      expect(result).toEqual({ publicKey: 'mock-vapid-public-key' });
    });
  });

  describe('subscribe', () => {
    it('should execute SubscribePushCommand with authenticated userId', async () => {
      const dto = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/1',
        keys: {
          p256dh: 'p256dhKey...',
          auth: 'authSecret...',
        },
        userAgent: 'Chrome on Windows',
      };

      const result = await controller.subscribe('user-123', dto);

      expect(commandBus.execute).toHaveBeenCalledWith(
        new SubscribePushCommand(
          'user-123',
          dto.endpoint,
          dto.keys.p256dh,
          dto.keys.auth,
          dto.userAgent,
        ),
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('unsubscribe', () => {
    it('should execute UnsubscribePushCommand with authenticated userId and endpoint (RBAC / IDOR prevention)', async () => {
      const dto = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/1',
      };

      const result = await controller.unsubscribe('user-123', dto);

      expect(commandBus.execute).toHaveBeenCalledWith(
        new UnsubscribePushCommand('user-123', dto.endpoint),
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('testPush', () => {
    it('should execute SendPushNotificationCommand for authenticated user', async () => {
      const result = await controller.testPush('user-123');

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(SendPushNotificationCommand),
      );
      const calledCmd = commandBus.execute.mock
        .calls[0][0] as SendPushNotificationCommand;
      expect(calledCmd.userId).toBe('user-123');
      expect(calledCmd.title).toContain('Test Notification');
      expect(result.success).toBe(true);
      expect(result.message).toBe('Test push notification dispatched');
    });
  });
});
