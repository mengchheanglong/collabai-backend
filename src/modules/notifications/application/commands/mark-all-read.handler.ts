// src/modules/notifications/application/commands/mark-all-read.handler.ts
// Mark all of the caller's unread notifications read. Returns the number updated.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { MarkAllReadCommand } from './mark-all-read.command';
import {
  type INotificationRepository,
  NOTIFICATION_REPOSITORY,
} from '../../domain/repositories/notification.repository.interface';

@CommandHandler(MarkAllReadCommand)
export class MarkAllReadHandler implements ICommandHandler<MarkAllReadCommand> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repo: INotificationRepository,
  ) {}

  async execute(command: MarkAllReadCommand): Promise<{ updated: number }> {
    const updated = await this.repo.markAllAsRead(command.userId);
    return { updated };
  }
}
