// src/modules/notifications/infrastructure/event-handlers/notification-events.listener.ts
//
// Turns cross-module domain events into notifications. This is the consumer side of the
// events emitted by the tasks and comments modules in Phases 2–3. Registered as a provider
// so @OnEvent handlers are picked up (EventEmitterModule is global).

import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { TaskAssignedEvent } from '../../../tasks/domain/events/task-assigned.event';
import { MentionCreatedEvent } from '../../../comments/domain/events/mention-created.event';
import { NotificationDomainService } from '../../domain/services/notification.domain.service';
import { CreateNotificationCommand } from '../../application/commands/create-notification.command';

@Injectable()
export class NotificationEventsListener {
  private readonly logger = new Logger(NotificationEventsListener.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly content: NotificationDomainService,
  ) {}

  @OnEvent(TaskAssignedEvent.eventName)
  async onTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    // Don't notify someone for assigning a task to themselves.
    if (event.assigneeId === event.assignedById) return;
    const { type, title, message } = this.content.forTaskAssigned(event.title);
    await this.dispatch(
      event.assigneeId,
      type,
      title,
      message,
      'task',
      event.taskId,
    );
  }

  @OnEvent(MentionCreatedEvent.eventName)
  async onMention(event: MentionCreatedEvent): Promise<void> {
    const { type, title, message } = this.content.forMention();
    await this.dispatch(
      event.mentionedUserId,
      type,
      title,
      message,
      'task',
      event.taskId,
    );
  }

  private async dispatch(
    userId: string,
    type: ReturnType<NotificationDomainService['forMention']>['type'],
    title: string,
    message: string,
    relatedEntityType: string,
    relatedEntityId: string,
  ): Promise<void> {
    try {
      await this.commandBus.execute(
        new CreateNotificationCommand(
          userId,
          type,
          title,
          message,
          relatedEntityType,
          relatedEntityId,
        ),
      );
    } catch (err) {
      // A failed notification must never break the originating action.
      this.logger.error(
        `Failed to create ${type} notification for user ${userId}: ${(err as Error).message}`,
      );
    }
  }
}
