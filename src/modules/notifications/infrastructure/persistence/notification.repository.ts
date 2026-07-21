// src/modules/notifications/infrastructure/persistence/notification.repository.ts
//
// Prisma implementation of INotificationRepository. Maps `message`/`isRead`/`readAt`
// columns to the domain entity.

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { NotificationEntity } from '../../domain/entities/notification.entity';
import {
  INotificationRepository,
  ListNotificationsOptions,
  Paginated,
} from '../../domain/repositories/notification.repository.interface';
import {
  NotificationType,
  NotificationTypes,
} from '../../domain/value-objects/notification-type.value-object';

@Injectable()
export class NotificationRepository implements INotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(notification: NotificationEntity): Promise<void> {
    await this.prisma.notification.create({
      data: {
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        relatedEntityType: notification.relatedEntityType,
        relatedEntityId: notification.relatedEntityId,
        isRead: notification.isRead,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      },
    });
  }

  async findById(id: string): Promise<NotificationEntity | null> {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async listForUser(
    userId: string,
    options: ListNotificationsOptions,
  ): Promise<Paginated<NotificationEntity>> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(options.unreadOnly ? { isRead: false } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toDomain(r)),
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  async markAsRead(id: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return result.count;
  }

  private toDomain(row: {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationEntity {
    return NotificationEntity.fromPersistence({
      id: row.id,
      userId: row.userId,
      type: this.asType(row.type),
      title: row.title,
      message: row.message,
      relatedEntityType: row.relatedEntityType,
      relatedEntityId: row.relatedEntityId,
      isRead: row.isRead,
      readAt: row.readAt,
      createdAt: row.createdAt,
    });
  }

  private asType(value: string): NotificationType {
    return NotificationTypes.isValid(value) ? value : 'task_assigned';
  }
}
