// src/modules/notifications/infrastructure/persistence/push-subscription.repository.ts
//
// Prisma implementation of IPushSubscriptionRepository.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { PushSubscriptionEntity } from '../../domain/entities/push-subscription.entity';
import { IPushSubscriptionRepository } from '../../domain/repositories/push-subscription.repository.interface';

@Injectable()
export class PushSubscriptionRepository implements IPushSubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(subscription: PushSubscriptionEntity): Promise<void> {
    if (!subscription || !subscription.endpoint) return;
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        id: subscription.id,
        userId: subscription.userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: subscription.userAgent,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      },
      update: {
        userId: subscription.userId,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: subscription.userAgent,
        updatedAt: subscription.updatedAt,
      },
    });
  }

  async findByUserId(userId: string): Promise<PushSubscriptionEntity[]> {
    if (!userId) return [];
    const rows = await this.prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!rows || !Array.isArray(rows)) return [];
    return rows.map((row) =>
      PushSubscriptionEntity.reconstitute({
        id: row.id,
        userId: row.userId,
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  async findByEndpoint(
    endpoint: string,
  ): Promise<PushSubscriptionEntity | null> {
    if (!endpoint) return null;
    const row = await this.prisma.pushSubscription.findUnique({
      where: { endpoint },
    });
    if (!row) return null;
    return PushSubscriptionEntity.reconstitute({
      id: row.id,
      userId: row.userId,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    if (!endpoint || typeof endpoint !== 'string') return;
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });
  }

  async deleteByEndpointAndUserId(
    endpoint: string,
    userId: string,
  ): Promise<void> {
    if (!endpoint || !userId) return;
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint, userId },
    });
  }

  async deleteByEndpoints(endpoints: string[]): Promise<void> {
    if (!Array.isArray(endpoints) || endpoints.length === 0) return;
    const cleanEndpoints = endpoints.filter(
      (ep) => typeof ep === 'string' && ep.trim().length > 0,
    );
    if (cleanEndpoints.length === 0) return;
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: cleanEndpoints } },
    });
  }
}
