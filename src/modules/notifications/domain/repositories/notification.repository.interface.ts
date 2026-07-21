// src/modules/notifications/domain/repositories/notification.repository.interface.ts
//
// Port for notification persistence. Bound to NOTIFICATION_REPOSITORY in the module.

import { NotificationEntity } from '../entities/notification.entity';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface ListNotificationsOptions {
  unreadOnly: boolean;
  page: number;
  limit: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface INotificationRepository {
  create(notification: NotificationEntity): Promise<void>;
  findById(id: string): Promise<NotificationEntity | null>;
  listForUser(
    userId: string,
    options: ListNotificationsOptions,
  ): Promise<Paginated<NotificationEntity>>;
  markAsRead(id: string): Promise<void>;
  /** Mark all of the user's unread notifications read; returns how many were updated. */
  markAllAsRead(userId: string): Promise<number>;
}
