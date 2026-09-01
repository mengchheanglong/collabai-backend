// src/modules/notifications/infrastructure/persistence/push-subscription.repository.spec.ts

import { PushSubscriptionRepository } from './push-subscription.repository';
import { PushSubscriptionEntity } from '../../domain/entities/push-subscription.entity';
import { PrismaService } from '../../../../shared/services/prisma.service';

describe('PushSubscriptionRepository', () => {
  let repository: PushSubscriptionRepository;
  let prisma: {
    pushSubscription: {
      upsert: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      pushSubscription: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    repository = new PushSubscriptionRepository(
      prisma as unknown as PrismaService,
    );
  });

  describe('save', () => {
    it('should upsert push subscription by endpoint', async () => {
      const entity = PushSubscriptionEntity.create({
        userId: 'user-123',
        endpoint: 'https://push.com/endpoint1',
        p256dh: 'p256dhKey',
        auth: 'authSecret',
        userAgent: 'Chrome',
      });

      await repository.save(entity);

      expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
        where: { endpoint: entity.endpoint },
        create: expect.objectContaining({
          userId: 'user-123',
          endpoint: 'https://push.com/endpoint1',
          p256dh: 'p256dhKey',
          auth: 'authSecret',
          userAgent: 'Chrome',
        }),
        update: expect.objectContaining({
          userId: 'user-123',
          p256dh: 'p256dhKey',
          auth: 'authSecret',
          userAgent: 'Chrome',
        }),
      });
    });

    it('should do nothing if subscription entity is invalid', async () => {
      await repository.save(null as any);
      expect(prisma.pushSubscription.upsert).not.toHaveBeenCalled();
    });
  });

  describe('findByUserId', () => {
    it('should return reconstituted PushSubscriptionEntities for user', async () => {
      const mockRows = [
        {
          id: 'sub-1',
          userId: 'user-123',
          endpoint: 'https://push.com/1',
          p256dh: 'k1',
          auth: 'a1',
          userAgent: 'Mozilla',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.pushSubscription.findMany.mockResolvedValue(mockRows);

      const result = await repository.findByUserId('user-123');

      expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sub-1');
      expect(result[0].endpoint).toBe('https://push.com/1');
    });

    it('should return empty array if userId is empty', async () => {
      const result = await repository.findByUserId('');
      expect(result).toEqual([]);
      expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findByEndpoint', () => {
    it('should return entity when endpoint exists', async () => {
      const mockRow = {
        id: 'sub-1',
        userId: 'user-123',
        endpoint: 'https://push.com/1',
        p256dh: 'k1',
        auth: 'a1',
        userAgent: 'Mozilla',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.pushSubscription.findUnique.mockResolvedValue(mockRow);

      const result = await repository.findByEndpoint('https://push.com/1');

      expect(prisma.pushSubscription.findUnique).toHaveBeenCalledWith({
        where: { endpoint: 'https://push.com/1' },
      });
      expect(result).not.toBeNull();
      expect(result?.endpoint).toBe('https://push.com/1');
    });

    it('should return null when endpoint does not exist', async () => {
      prisma.pushSubscription.findUnique.mockResolvedValue(null);

      const result = await repository.findByEndpoint('https://push.com/none');

      expect(result).toBeNull();
    });

    it('should return null if endpoint parameter is falsy', async () => {
      const result = await repository.findByEndpoint('');
      expect(result).toBeNull();
    });
  });

  describe('deleteByEndpoint', () => {
    it('should delete subscription by endpoint', async () => {
      await repository.deleteByEndpoint('https://push.com/dead');

      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { endpoint: 'https://push.com/dead' },
      });
    });

    it('should not throw or call prisma if endpoint is empty', async () => {
      await repository.deleteByEndpoint('');
      expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteByEndpointAndUserId (RBAC Scoping)', () => {
    it('should delete subscription strictly matching endpoint and userId', async () => {
      await repository.deleteByEndpointAndUserId(
        'https://push.com/user-sub',
        'user-123',
      );

      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: {
          endpoint: 'https://push.com/user-sub',
          userId: 'user-123',
        },
      });
    });

    it('should do nothing if endpoint or userId is missing', async () => {
      await repository.deleteByEndpointAndUserId('', 'user-123');
      await repository.deleteByEndpointAndUserId('https://push.com/sub', '');

      expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteByEndpoints', () => {
    it('should batch delete multiple endpoints', async () => {
      await repository.deleteByEndpoints([
        'https://push.com/1',
        'https://push.com/2',
      ]);

      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: {
          endpoint: {
            in: ['https://push.com/1', 'https://push.com/2'],
          },
        },
      });
    });

    it('should do nothing if array is empty or contains only falsy entries', async () => {
      await repository.deleteByEndpoints([]);
      await repository.deleteByEndpoints(['', '   ']);

      expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
    });
  });
});
