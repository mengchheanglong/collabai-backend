// src/modules/notifications/application/queries/get-user-notifications.handler.ts
// List the caller's notifications (newest first), optionally unread only.

import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetUserNotificationsQuery } from './get-user-notifications.query';
import {
  type INotificationRepository,
  NOTIFICATION_REPOSITORY,
  Paginated,
} from '../../domain/repositories/notification.repository.interface';
import { NotificationEntity } from '../../domain/entities/notification.entity';

@QueryHandler(GetUserNotificationsQuery)
export class GetUserNotificationsHandler
  implements IQueryHandler<GetUserNotificationsQuery>
{
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repo: INotificationRepository,
  ) {}

  async execute(
    query: GetUserNotificationsQuery,
  ): Promise<Paginated<NotificationEntity>> {
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    return this.repo.listForUser(query.userId, {
      unreadOnly: query.unreadOnly,
      page,
      limit,
    });
  }
}
