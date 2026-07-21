// src/modules/notifications/application/commands/mark-as-read.handler.ts
// Mark one notification as read. The caller must own it.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { MarkAsReadCommand } from './mark-as-read.command';
import {
  type INotificationRepository,
  NOTIFICATION_REPOSITORY,
} from '../../domain/repositories/notification.repository.interface';
import {
  NotificationForbiddenError,
  NotificationNotFoundError,
} from '../errors/notification.errors';

@CommandHandler(MarkAsReadCommand)
export class MarkAsReadHandler implements ICommandHandler<MarkAsReadCommand> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repo: INotificationRepository,
  ) {}

  async execute(command: MarkAsReadCommand): Promise<void> {
    const notification = await this.repo.findById(command.notificationId);
    if (!notification) throw new NotificationNotFoundError();
    if (notification.userId !== command.userId) {
      throw new NotificationForbiddenError();
    }
    if (notification.isRead) return; // idempotent
    await this.repo.markAsRead(notification.id);
  }
}
