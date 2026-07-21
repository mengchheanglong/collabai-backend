// src/modules/notifications/application/commands/create-notification.handler.ts
// Persist a notification. Internal (invoked by event listeners).

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import { CreateNotificationCommand } from './create-notification.command';
import {
  type INotificationRepository,
  NOTIFICATION_REPOSITORY,
} from '../../domain/repositories/notification.repository.interface';
import { NotificationEntity } from '../../domain/entities/notification.entity';

@CommandHandler(CreateNotificationCommand)
export class CreateNotificationHandler
  implements ICommandHandler<CreateNotificationCommand>
{
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repo: INotificationRepository,
  ) {}

  async execute(command: CreateNotificationCommand): Promise<void> {
    const notification = NotificationEntity.create({
      id: uuidv4(),
      userId: command.userId,
      type: command.type,
      title: command.title,
      message: command.message,
      relatedEntityType: command.relatedEntityType,
      relatedEntityId: command.relatedEntityId,
    });
    await this.repo.create(notification);
  }
}
