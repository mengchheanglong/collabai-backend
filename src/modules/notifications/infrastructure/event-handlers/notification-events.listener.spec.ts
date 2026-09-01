// src/modules/notifications/infrastructure/event-handlers/notification-events.listener.spec.ts

import { CommandBus } from '@nestjs/cqrs';
import { NotificationEventsListener } from './notification-events.listener';
import { NotificationDomainService } from '../../domain/services/notification.domain.service';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { TaskAssignedEvent } from '../../../tasks/domain/events/task-assigned.event';
import { MentionCreatedEvent } from '../../../comments/domain/events/mention-created.event';
import { CreateNotificationCommand } from '../../application/commands/create-notification.command';
import { SendPushNotificationCommand } from '../../application/commands/send-push-notification.command';

describe('NotificationEventsListener', () => {
  let listener: NotificationEventsListener;
  let commandBus: jest.Mocked<CommandBus>;
  let content: NotificationDomainService;
  let prisma: {
    userSettings: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    commandBus = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as any;
    content = new NotificationDomainService();
    prisma = {
      userSettings: {
        findUnique: jest.fn(),
      },
    };
    listener = new NotificationEventsListener(
      commandBus,
      content,
      prisma as unknown as PrismaService,
    );
  });

  describe('onTaskAssigned', () => {
    const event = new TaskAssignedEvent(
      'task-1',
      'proj-1',
      'user-assignee',
      'user-assigner',
      'Design new UI',
    );

    it('should ignore self-assignment when assigneeId === assignedById', async () => {
      const selfEvent = new TaskAssignedEvent(
        'task-1',
        'proj-1',
        'user-1',
        'user-1',
        'Self assigned task',
      );

      await listener.onTaskAssigned(selfEvent);

      expect(commandBus.execute).not.toHaveBeenCalled();
      expect(prisma.userSettings.findUnique).not.toHaveBeenCalled();
    });

    it('should dispatch both in-app and push notification when notifyTaskAssigned is true', async () => {
      prisma.userSettings.findUnique.mockResolvedValue({
        userId: 'user-assignee',
        notifyTaskAssigned: true,
        notifyCommentMentions: true,
      });

      await listener.onTaskAssigned(event);

      expect(commandBus.execute).toHaveBeenCalledTimes(2);
      expect(commandBus.execute).toHaveBeenNthCalledWith(
        1,
        expect.any(CreateNotificationCommand),
      );
      expect(commandBus.execute).toHaveBeenNthCalledWith(
        2,
        expect.any(SendPushNotificationCommand),
      );
    });

    it('should dispatch in-app notification but SKIP push notification when notifyTaskAssigned is false', async () => {
      prisma.userSettings.findUnique.mockResolvedValue({
        userId: 'user-assignee',
        notifyTaskAssigned: false,
        notifyCommentMentions: true,
      });

      await listener.onTaskAssigned(event);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(CreateNotificationCommand),
      );
    });

    it('should dispatch push notification by default when user has no UserSettings row', async () => {
      prisma.userSettings.findUnique.mockResolvedValue(null);

      await listener.onTaskAssigned(event);

      expect(commandBus.execute).toHaveBeenCalledTimes(2);
      expect(commandBus.execute).toHaveBeenNthCalledWith(
        2,
        expect.any(SendPushNotificationCommand),
      );
    });

    it('should fall back gracefully to sending push if UserSettings query throws', async () => {
      prisma.userSettings.findUnique.mockRejectedValue(
        new Error('DB Connection Timeout'),
      );

      await listener.onTaskAssigned(event);

      expect(commandBus.execute).toHaveBeenCalledTimes(2);
      expect(commandBus.execute).toHaveBeenNthCalledWith(
        2,
        expect.any(SendPushNotificationCommand),
      );
    });

    it('should not throw if commandBus.execute throws', async () => {
      prisma.userSettings.findUnique.mockResolvedValue({
        notifyTaskAssigned: true,
      });
      commandBus.execute.mockRejectedValue(new Error('Broker failure'));

      await expect(listener.onTaskAssigned(event)).resolves.not.toThrow();
    });
  });

  describe('onMention', () => {
    const event = new MentionCreatedEvent(
      'user-mentioned',
      'comment-1',
      'task-1',
      'proj-1',
      'author-1',
    );

    it('should ignore self-mention when mentionedUserId === authorId', async () => {
      const selfMentionEvent = new MentionCreatedEvent(
        'user-1',
        'comment-1',
        'task-1',
        'proj-1',
        'user-1',
      );

      await listener.onMention(selfMentionEvent);

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('should dispatch both in-app and push notification when notifyCommentMentions is true', async () => {
      prisma.userSettings.findUnique.mockResolvedValue({
        userId: 'user-mentioned',
        notifyTaskAssigned: true,
        notifyCommentMentions: true,
      });

      await listener.onMention(event);

      expect(commandBus.execute).toHaveBeenCalledTimes(2);
      expect(commandBus.execute).toHaveBeenNthCalledWith(
        1,
        expect.any(CreateNotificationCommand),
      );
      expect(commandBus.execute).toHaveBeenNthCalledWith(
        2,
        expect.any(SendPushNotificationCommand),
      );
    });

    it('should dispatch in-app notification but SKIP push notification when notifyCommentMentions is false', async () => {
      prisma.userSettings.findUnique.mockResolvedValue({
        userId: 'user-mentioned',
        notifyTaskAssigned: true,
        notifyCommentMentions: false,
      });

      await listener.onMention(event);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(CreateNotificationCommand),
      );
    });

    it('should dispatch push notification by default when UserSettings is null', async () => {
      prisma.userSettings.findUnique.mockResolvedValue(null);

      await listener.onMention(event);

      expect(commandBus.execute).toHaveBeenCalledTimes(2);
    });
  });
});
