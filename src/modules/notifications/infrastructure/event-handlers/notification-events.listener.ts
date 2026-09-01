// src/modules/notifications/infrastructure/event-handlers/notification-events.listener.ts
//
// Turns cross-module domain events into notifications. This is the consumer side of the
// events emitted by the tasks and comments modules in Phases 2–3. Registered as a provider
// so @OnEvent handlers are picked up (EventEmitterModule is global).
// Enforces user notification preferences from UserSettings before dispatching Web Push.

import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { TaskAssignedEvent } from '../../../tasks/domain/events/task-assigned.event';
import { MentionCreatedEvent } from '../../../comments/domain/events/mention-created.event';
import { NotificationDomainService } from '../../domain/services/notification.domain.service';
import { NotificationType } from '../../domain/value-objects/notification-type.value-object';
import { CreateNotificationCommand } from '../../application/commands/create-notification.command';
import { SendPushNotificationCommand } from '../../application/commands/send-push-notification.command';

@Injectable()
export class NotificationEventsListener {
  private readonly logger = new Logger(NotificationEventsListener.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly content: NotificationDomainService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(TaskAssignedEvent.eventName)
  async onTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    try {
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
    } catch (err) {
      this.logger.error(
        `Unexpected error handling TaskAssignedEvent for task ${event.taskId}: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent(MentionCreatedEvent.eventName)
  async onMention(event: MentionCreatedEvent): Promise<void> {
    try {
      // Defensive check: don't notify if author mentioned themselves
      if (event.mentionedUserId === event.authorId) return;
      const { type, title, message } = this.content.forMention();
      await this.dispatch(
        event.mentionedUserId,
        type,
        title,
        message,
        'task',
        event.taskId,
      );
    } catch (err) {
      this.logger.error(
        `Unexpected error handling MentionCreatedEvent for task ${event.taskId}: ${(err as Error).message}`,
      );
    }
  }

  private async dispatch(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    relatedEntityType: string,
    relatedEntityId: string,
  ): Promise<void> {
    // 1. In-app notification creation (isolated)
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
      this.logger.error(
        `Failed to create in-app ${type} notification for user ${userId}: ${(err as Error).message}`,
      );
    }

    // 2. Web Push notification delivery (governed by UserSettings preferences)
    try {
      const isPushEnabled = await this.shouldSendPush(userId, type);
      if (!isPushEnabled) {
        this.logger.debug(
          `Push notification skipped for user ${userId}: ${type} disabled in UserSettings.`,
        );
        return;
      }

      await this.commandBus.execute(
        new SendPushNotificationCommand(
          userId,
          title,
          message,
          relatedEntityType === 'task' ? '/board' : '/dashboard',
          { type, relatedEntityType, relatedEntityId },
        ),
      );
    } catch (err) {
      // A failed push notification must never break the originating action.
      this.logger.error(
        `Failed to deliver ${type} push notification for user ${userId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Evaluates user notification preferences from UserSettings.
   * If settings do not exist or setting is undefined, defaults to true (enabled).
   */
  async shouldSendPush(
    userId: string,
    type: NotificationType,
  ): Promise<boolean> {
    try {
      const settings = await this.prisma.userSettings.findUnique({
        where: { userId },
      });

      if (!settings) {
        return true; // Default to enabled
      }

      if (type === 'task_assigned') {
        return settings.notifyTaskAssigned !== false;
      }

      if (type === 'comment_mention') {
        return settings.notifyCommentMentions !== false;
      }

      return true;
    } catch (err) {
      this.logger.warn(
        `Failed to read UserSettings for user ${userId}: ${(err as Error).message}. Defaulting to enabled push.`,
      );
      return true;
    }
  }
}
