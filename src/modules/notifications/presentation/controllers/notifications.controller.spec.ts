import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { NotificationsController } from './notifications.controller';
import { GetUserNotificationsQuery } from '../../application/queries/get-user-notifications.query';
import { MarkAsReadCommand } from '../../application/commands/mark-as-read.command';
import { MarkAllReadCommand } from '../../application/commands/mark-all-read.command';
import { NotificationEntity } from '../../domain/entities/notification.entity';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  const mockNotification = NotificationEntity.fromPersistence({
    id: '11111111-1111-4111-a111-111111111111',
    userId: '22222222-2222-4222-a222-222222222222',
    type: 'task_assigned',
    title: 'Task Assigned',
    message: 'You have been assigned to task #1',
    relatedEntityType: 'task',
    relatedEntityId: '33333333-3333-4333-a333-333333333333',
    isRead: false,
    readAt: null,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
  });

  beforeEach(() => {
    commandBus = { execute: jest.fn() } as any;
    queryBus = { execute: jest.fn() } as any;
    controller = new NotificationsController(commandBus, queryBus);
  });

  describe('list', () => {
    it('executes GetUserNotificationsQuery with clamped pagination parameters', async () => {
      queryBus.execute.mockResolvedValueOnce({
        items: [mockNotification],
        page: 1,
        limit: 20,
        total: 1,
      });

      const res = await controller.list('user-1', 'true', '-10', '999999');

      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetUserNotificationsQuery('user-1', true, 1, 100),
      );
      expect(res.items).toHaveLength(1);
      expect(res.meta.page).toBe(1);
      expect(res.meta.limit).toBe(20);
    });
  });

  describe('markAllRead', () => {
    it('executes MarkAllReadCommand', async () => {
      commandBus.execute.mockResolvedValueOnce({ updated: 5 });

      const res = await controller.markAllRead('user-1');
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(MarkAllReadCommand),
      );
      expect(res).toEqual({ updated: 5 });
    });
  });

  describe('markRead', () => {
    it('executes MarkAsReadCommand and returns read: true', async () => {
      commandBus.execute.mockResolvedValueOnce(undefined);

      const res = await controller.markRead('user-1', mockNotification.id);
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(MarkAsReadCommand),
      );
      expect(res).toEqual({ read: true });
    });
  });
});
