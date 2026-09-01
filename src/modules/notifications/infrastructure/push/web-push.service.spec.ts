// src/modules/notifications/infrastructure/push/web-push.service.spec.ts

import { ConfigService } from '@nestjs/config';
import {
  WebPushService,
  MAX_PUSH_PAYLOAD_BYTES,
  truncateUtf8,
  formatAndTruncatePayload,
} from './web-push.service';
import { IPushSubscriptionRepository } from '../../domain/repositories/push-subscription.repository.interface';
import { PushSubscriptionEntity } from '../../domain/entities/push-subscription.entity';
import * as webpush from 'web-push';

jest.mock('web-push', () => ({
  generateVAPIDKeys: jest.fn(() => ({
    publicKey: 'mock-public-key',
    privateKey: 'mock-private-key',
  })),
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('WebPushService', () => {
  let service: WebPushService;
  let config: jest.Mocked<ConfigService>;
  let repo: jest.Mocked<IPushSubscriptionRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      get: jest.fn(),
    } as any;
    repo = {
      save: jest.fn(),
      findByUserId: jest.fn(),
      findByEndpoint: jest.fn(),
      deleteByEndpoint: jest.fn().mockResolvedValue(undefined),
      deleteByEndpointAndUserId: jest.fn().mockResolvedValue(undefined),
      deleteByEndpoints: jest.fn().mockResolvedValue(undefined),
    };
    service = new WebPushService(config, repo);
  });

  describe('VAPID Initialization', () => {
    it('should auto-generate VAPID keys if not present in config', () => {
      config.get.mockReturnValue(undefined);

      service.onModuleInit();

      expect(webpush.generateVAPIDKeys).toHaveBeenCalled();
      expect(service.getPublicKey()).toBe('mock-public-key');
      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:support@collabai.internal',
        'mock-public-key',
        'mock-private-key',
      );
    });

    it('should use configured VAPID keys if present in config', () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'VAPID_PUBLIC_KEY') return 'custom-pub-key';
        if (key === 'VAPID_PRIVATE_KEY') return 'custom-priv-key';
        if (key === 'VAPID_SUBJECT') return 'mailto:admin@collabai.com';
        return undefined;
      });

      service.onModuleInit();

      expect(service.getPublicKey()).toBe('custom-pub-key');
      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:admin@collabai.com',
        'custom-pub-key',
        'custom-priv-key',
      );
    });

    it('should catch and log errors if setVapidDetails throws', () => {
      config.get.mockReturnValue('key');
      (webpush.setVapidDetails as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid VAPID details');
      });

      expect(() => service.onModuleInit()).not.toThrow();
    });
  });

  describe('Payload Truncation & UTF-8 Safety (4KB Protocol Limit)', () => {
    describe('truncateUtf8', () => {
      it('should return empty string for falsy input', () => {
        expect(truncateUtf8('', 100)).toBe('');
      });

      it('should not modify string within maxBytes', () => {
        const text = 'Hello CollabAI';
        expect(truncateUtf8(text, 50)).toBe(text);
      });

      it('should truncate string and append ellipsis when exceeding maxBytes', () => {
        const text = 'This is a very long notification body text';
        const result = truncateUtf8(text, 20);

        expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(20);
        expect(result.endsWith('...')).toBe(true);
      });

      it('should safely handle multi-byte UTF-8 emojis without broken surrogate pairs', () => {
        // Emojis are 4 bytes each: 🔥 (4 bytes), 🚀 (4 bytes), 🎉 (4 bytes)
        const emojiText = '🔥🚀🎉🔥🚀🎉🔥🚀🎉🔥🚀🎉';
        const truncated = truncateUtf8(emojiText, 15);

        expect(Buffer.byteLength(truncated, 'utf8')).toBeLessThanOrEqual(15);
        expect(truncated.endsWith('...')).toBe(true);
        // Ensure no replacement chars (\uFFFD) from broken surrogate pairs
        expect(truncated).not.toContain('\uFFFD');
      });

      it('should safely handle multi-byte Asian and Khmer characters', () => {
        const nonAsciiText = 'សួស្តីពិភពលោក こんにちは世界';
        const truncated = truncateUtf8(nonAsciiText, 25);

        expect(Buffer.byteLength(truncated, 'utf8')).toBeLessThanOrEqual(25);
        expect(truncated.endsWith('...')).toBe(true);
        expect(truncated).not.toContain('\uFFFD');
      });
    });

    describe('formatAndTruncatePayload', () => {
      it('should format standard payload under 4KB limit and retain all fields', () => {
        const payload = {
          title: 'Task Assigned',
          body: 'You have been assigned to design the homepage.',
          data: { url: '/board', type: 'task_assigned', entityId: 'task-123' },
        };

        const jsonStr = formatAndTruncatePayload(payload);
        const parsed = JSON.parse(jsonStr);

        expect(parsed.title).toBe('Task Assigned');
        expect(parsed.body).toBe(
          'You have been assigned to design the homepage.',
        );
        expect(parsed.data.url).toBe('/board');
        expect(parsed.data.type).toBe('task_assigned');
        expect(parsed.data.entityId).toBe('task-123');
        expect(parsed.icon).toBe('/favicon.ico');
        expect(parsed.badge).toBe('/favicon.ico');
        expect(parsed.tag).toBe('collabai-notification');
        expect(parsed.actions).toEqual([
          { action: 'open', title: 'Open in CollabAI' },
        ]);
        expect(Buffer.byteLength(jsonStr, 'utf8')).toBeLessThanOrEqual(
          MAX_PUSH_PAYLOAD_BYTES,
        );
      });

      it('should safely truncate massive task descriptions (>50KB) to stay under 4KB and parse cleanly', () => {
        const massiveBody = 'A'.repeat(50000);
        const payload = {
          title: 'Urgent Task',
          body: massiveBody,
          data: { url: '/tasks/huge', taskId: '123' },
        };

        const jsonStr = formatAndTruncatePayload(payload);

        expect(Buffer.byteLength(jsonStr, 'utf8')).toBeLessThanOrEqual(
          MAX_PUSH_PAYLOAD_BYTES,
        );

        // Verify JSON is 100% valid and parseable
        expect(() => JSON.parse(jsonStr)).not.toThrow();
        const parsed = JSON.parse(jsonStr);
        expect(parsed.title).toBe('Urgent Task');
        expect(parsed.body.endsWith('...')).toBe(true);
        expect(parsed.data.url).toBe('/tasks/huge');
      });

      it('should truncate excessively long titles', () => {
        const hugeTitle = 'T'.repeat(5000);
        const payload = {
          title: hugeTitle,
          body: 'Short body',
        };

        const jsonStr = formatAndTruncatePayload(payload);
        const parsed = JSON.parse(jsonStr);

        expect(parsed.title.length).toBeLessThan(300);
        expect(parsed.title.endsWith('...')).toBe(true);
        expect(Buffer.byteLength(jsonStr, 'utf8')).toBeLessThanOrEqual(
          MAX_PUSH_PAYLOAD_BYTES,
        );
      });

      it('should prune oversized data metadata objects while preserving essential routing url/type/entityId', () => {
        const largeData: Record<string, any> = {
          url: '/board/feature-x',
          type: 'comment_mention',
          entityId: 'c-999',
          hugePayloadBlob: 'X'.repeat(20000),
          extraMetadata: Array(500).fill({ key: 'value', nested: true }),
        };

        const payload = {
          title: 'Comment Mention',
          body: 'Check out the update: ' + 'B'.repeat(5000),
          data: largeData,
        };

        const jsonStr = formatAndTruncatePayload(payload);

        expect(Buffer.byteLength(jsonStr, 'utf8')).toBeLessThanOrEqual(
          MAX_PUSH_PAYLOAD_BYTES,
        );

        const parsed = JSON.parse(jsonStr);
        expect(parsed.data.url).toBe('/board/feature-x');
        expect(parsed.data.type).toBe('comment_mention');
        expect(parsed.data.entityId).toBe('c-999');
        // Non-essential huge blob should be pruned
        expect(parsed.data.hugePayloadBlob).toBeUndefined();
      });
    });
  });

  describe('Push Delivery & Error Handling (Non-blocking & Pruning)', () => {
    const validSubscription = PushSubscriptionEntity.create({
      userId: 'user-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/sub-1',
      p256dh: 'BNcKey123...',
      auth: 'authSecret123...',
    });

    it('should return true when webpush.sendNotification succeeds', async () => {
      (webpush.sendNotification as jest.Mock).mockResolvedValueOnce({});

      const result = await service.sendNotification(validSubscription, {
        title: 'Task Assigned',
        body: 'Hello',
      });

      expect(result).toBe(true);
      expect(webpush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: validSubscription.endpoint,
          keys: {
            p256dh: validSubscription.p256dh,
            auth: validSubscription.auth,
          },
        },
        expect.any(String),
        expect.objectContaining({
          urgency: 'high',
          TTL: 86400,
        }),
      );
    });

    it('should return false without throwing when subscription has missing keys', async () => {
      const invalidSub = {
        endpoint: '',
        p256dh: '',
        auth: '',
      } as any;

      const result = await service.sendNotification(invalidSub, {
        title: 'Test',
        body: 'Body',
      });

      expect(result).toBe(false);
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('should auto-prune subscription when push service returns HTTP 410 Gone', async () => {
      (webpush.sendNotification as jest.Mock).mockRejectedValueOnce({
        statusCode: 410,
        message: 'Subscription has expired or is no longer valid',
      });

      const result = await service.sendNotification(validSubscription, {
        title: 'Test',
        body: 'Body',
      });

      expect(result).toBe(false);
      expect(repo.deleteByEndpoint).toHaveBeenCalledWith(
        validSubscription.endpoint,
      );
    });

    it('should auto-prune subscription when push service returns HTTP 404 Not Found', async () => {
      (webpush.sendNotification as jest.Mock).mockRejectedValueOnce({
        statusCode: 404,
        message: 'Endpoint not found',
      });

      const result = await service.sendNotification(validSubscription, {
        title: 'Test',
        body: 'Body',
      });

      expect(result).toBe(false);
      expect(repo.deleteByEndpoint).toHaveBeenCalledWith(
        validSubscription.endpoint,
      );
    });

    it('should catch database errors when pruning expired subscription without crashing', async () => {
      (webpush.sendNotification as jest.Mock).mockRejectedValueOnce({
        statusCode: 410,
        message: 'Gone',
      });
      repo.deleteByEndpoint.mockRejectedValueOnce(
        new Error('Database connection lost'),
      );

      const result = await service.sendNotification(validSubscription, {
        title: 'Test',
        body: 'Body',
      });

      expect(result).toBe(false);
      expect(repo.deleteByEndpoint).toHaveBeenCalledWith(
        validSubscription.endpoint,
      );
    });

    it('should catch and log FCM/APNs HTTP 500 Internal Server Error and return false', async () => {
      (webpush.sendNotification as jest.Mock).mockRejectedValueOnce({
        statusCode: 500,
        message: 'Internal error in push gateway',
      });

      const result = await service.sendNotification(validSubscription, {
        title: 'Test',
        body: 'Body',
      });

      expect(result).toBe(false);
      expect(repo.deleteByEndpoint).not.toHaveBeenCalled();
    });

    it('should catch and log FCM/APNs HTTP 503 Service Unavailable and return false', async () => {
      (webpush.sendNotification as jest.Mock).mockRejectedValueOnce({
        statusCode: 503,
        message: 'Push service temporarily overloaded',
      });

      const result = await service.sendNotification(validSubscription, {
        title: 'Test',
        body: 'Body',
      });

      expect(result).toBe(false);
      expect(repo.deleteByEndpoint).not.toHaveBeenCalled();
    });

    it('should catch network socket errors (ECONNRESET, ETIMEDOUT) and return false', async () => {
      const networkErr = new Error('connect ECONNRESET');
      (networkErr as any).code = 'ECONNRESET';
      (webpush.sendNotification as jest.Mock).mockRejectedValueOnce(networkErr);

      const result = await service.sendNotification(validSubscription, {
        title: 'Test',
        body: 'Body',
      });

      expect(result).toBe(false);
      expect(repo.deleteByEndpoint).not.toHaveBeenCalled();
    });

    it('should handle simultaneous concurrent pushes with dead subscriptions without race conditions', async () => {
      const sub1 = PushSubscriptionEntity.create({
        userId: 'user-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/dead-1',
        p256dh: 'k1',
        auth: 'a1',
      });
      const sub2 = PushSubscriptionEntity.create({
        userId: 'user-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/dead-2',
        p256dh: 'k2',
        auth: 'a2',
      });

      (webpush.sendNotification as jest.Mock)
        .mockRejectedValueOnce({ statusCode: 410, message: 'Gone 1' })
        .mockRejectedValueOnce({ statusCode: 404, message: 'Not Found 2' });

      const [res1, res2] = await Promise.all([
        service.sendNotification(sub1, { title: 'T1', body: 'B1' }),
        service.sendNotification(sub2, { title: 'T2', body: 'B2' }),
      ]);

      expect(res1).toBe(false);
      expect(res2).toBe(false);
      expect(repo.deleteByEndpoint).toHaveBeenCalledWith(sub1.endpoint);
      expect(repo.deleteByEndpoint).toHaveBeenCalledWith(sub2.endpoint);
    });
  });
});
