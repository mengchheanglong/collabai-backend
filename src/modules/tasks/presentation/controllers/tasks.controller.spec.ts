import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { GetTasksQuery } from '../../application/queries/get-tasks.query';
import { GetTaskQuery } from '../../application/queries/get-task.query';
import { CreateTaskCommand } from '../../application/commands/create-task.command';
import { UpdateTaskCommand } from '../../application/commands/update-task.command';
import { MoveTaskCommand } from '../../application/commands/move-task.command';
import { DeleteTaskCommand } from '../../application/commands/delete-task.command';
import { AddSubtaskCommand } from '../../application/commands/add-subtask.command';
import { UpdateSubtaskCommand } from '../../application/commands/update-subtask.command';
import { DeleteSubtaskCommand } from '../../application/commands/delete-subtask.command';
import { TaskView } from '../../domain/repositories/task.repository.interface';

describe('TasksController', () => {
  let controller: TasksController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  const mockTaskView: TaskView = {
    id: '11111111-1111-4111-a111-111111111111',
    projectId: '22222222-2222-4222-a222-222222222222',
    boardId: '33333333-3333-4333-a333-333333333333',
    title: 'Implement Unit Tests',
    description: 'Detailed description',
    status: 'todo',
    priority: 'high',
    position: 1000,
    assigneeId: '44444444-4444-4444-a444-444444444444',
    createdById: '55555555-5555-4555-a555-555555555555',
    dueDate: new Date('2026-09-10T12:00:00.000Z'),
    completedAt: null,
    labels: ['backend', 'testing'],
    subtasks: [
      { id: '66666666-6666-4666-a666-666666666666', title: 'Write tests', done: false, orderIndex: 0 },
    ],
    commentCount: 2,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-01T11:00:00.000Z'),
  };

  beforeEach(() => {
    commandBus = { execute: jest.fn() } as any;
    queryBus = { execute: jest.fn() } as any;
    controller = new TasksController(commandBus, queryBus);
  });

  describe('list', () => {
    it('executes GetTasksQuery with properly clamped pagination and valid dates', async () => {
      queryBus.execute.mockResolvedValueOnce({
        items: [mockTaskView],
        page: 1,
        limit: 50,
        total: 1,
      });

      const res = await controller.list(
        'user-1',
        '22222222-2222-4222-a222-222222222222',
        '33333333-3333-4333-a333-333333333333',
        'todo',
        '44444444-4444-4444-a444-444444444444',
        'Unit',
        'backend',
        '2026-09-10T12:00:00.000Z',
        '-5',
        '999999',
      );

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetTasksQuery),
      );
      const query = queryBus.execute.mock.calls[0][0] as GetTasksQuery;
      expect(query.filters.page).toBe(1);
      expect(query.filters.limit).toBe(100);
      expect(query.filters.dueBefore).toEqual(new Date('2026-09-10T12:00:00.000Z'));
      expect(res.items).toHaveLength(1);
      expect(res.meta.totalPages).toBe(1);
    });

    it('handles invalid dueBefore format without throwing', async () => {
      queryBus.execute.mockResolvedValueOnce({
        items: [],
        page: 1,
        limit: 50,
        total: 0,
      });

      const res = await controller.list(
        'user-1',
        '22222222-2222-4222-a222-222222222222',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'invalid-date-format',
        '1',
        '25',
      );

      const query = queryBus.execute.mock.calls[0][0] as GetTasksQuery;
      expect(query.filters.dueBefore).toBeUndefined();
      expect(res.meta.page).toBe(1);
      expect(res.meta.limit).toBe(50);
    });
  });

  describe('create', () => {
    it('executes CreateTaskCommand and returns mapped response', async () => {
      commandBus.execute.mockResolvedValueOnce(mockTaskView);

      const res = await controller.create('user-1', {
        projectId: '22222222-2222-4222-a222-222222222222',
        title: 'Implement Unit Tests',
        description: 'Detailed description',
        status: 'todo',
        priority: 'high',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(CreateTaskCommand));
      expect(res.task.id).toBe(mockTaskView.id);
      expect(res.task.title).toBe(mockTaskView.title);
    });
  });

  describe('get', () => {
    it('executes GetTaskQuery and returns task', async () => {
      queryBus.execute.mockResolvedValueOnce(mockTaskView);

      const res = await controller.get('user-1', mockTaskView.id);
      expect(queryBus.execute).toHaveBeenCalledWith(expect.any(GetTaskQuery));
      expect(res.task.id).toBe(mockTaskView.id);
    });
  });

  describe('update', () => {
    it('executes UpdateTaskCommand and returns updated task', async () => {
      commandBus.execute.mockResolvedValueOnce(mockTaskView);

      const res = await controller.update('user-1', mockTaskView.id, {
        title: 'Updated Title',
        priority: 'urgent',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(UpdateTaskCommand));
      expect(res.task).toBeDefined();
    });
  });

  describe('move', () => {
    it('moves task using destinationStatus and destinationPosition', async () => {
      commandBus.execute.mockResolvedValueOnce(mockTaskView);

      const res = await controller.move('user-1', mockTaskView.id, {
        destinationStatus: 'in_progress',
        destinationPosition: 2000,
      });

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(MoveTaskCommand));
      expect(res.task).toBeDefined();
    });

    it('throws BadRequestException if neither status nor destinationStatus is provided', async () => {
      await expect(
        controller.move('user-1', mockTaskView.id, { position: 100 } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('executes DeleteTaskCommand and returns success message', async () => {
      commandBus.execute.mockResolvedValueOnce(undefined);

      const res = await controller.remove('user-1', mockTaskView.id);
      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(DeleteTaskCommand));
      expect(res.success).toBe(true);
    });
  });

  describe('subtasks', () => {
    it('adds subtask', async () => {
      commandBus.execute.mockResolvedValueOnce(mockTaskView);

      const res = await controller.addSubtask('user-1', mockTaskView.id, {
        title: 'New Subtask',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(AddSubtaskCommand));
      expect(res.subtask).toBeDefined();
    });

    it('updates subtask', async () => {
      commandBus.execute.mockResolvedValueOnce(mockTaskView);

      const res = await controller.updateSubtask(
        'user-1',
        mockTaskView.id,
        '66666666-6666-4666-a666-666666666666',
        { done: true },
      );

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(UpdateSubtaskCommand));
      expect(res.subtask).toBeDefined();
    });

    it('deletes subtask', async () => {
      commandBus.execute.mockResolvedValueOnce(mockTaskView);

      const res = await controller.deleteSubtask(
        'user-1',
        mockTaskView.id,
        '66666666-6666-4666-a666-666666666666',
      );

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(DeleteSubtaskCommand));
      expect(res.success).toBe(true);
    });
  });
});
