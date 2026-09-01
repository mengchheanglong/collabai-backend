// src/modules/tasks/application/commands/create-task.handler.spec.ts

import { CreateTaskHandler } from './create-task.handler';
import { CreateTaskCommand } from './create-task.command';
import { ITaskRepository } from '../../domain/repositories/task.repository.interface';
import { IBoardRepository } from '../../../boards/domain/repositories/board.repository.interface';
import { TaskAccessService } from '../services/task-access.service';
import { TaskDomainService } from '../../domain/services/task.domain.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AssigneeNotMemberError,
  InvalidTaskFieldError,
  TaskNotFoundError,
} from '../errors/task.errors';
import { TaskCreatedEvent } from '../../domain/events/task-created.event';
import { TaskAssignedEvent } from '../../domain/events/task-assigned.event';

describe('CreateTaskHandler (Offline Sync, Concurrency & Idempotency)', () => {
  let handler: CreateTaskHandler;
  let repo: jest.Mocked<ITaskRepository>;
  let boardRepo: jest.Mocked<IBoardRepository>;
  let access: jest.Mocked<TaskAccessService>;
  let domain: TaskDomainService;
  let events: jest.Mocked<EventEmitter2>;

  const validProjectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const otherProjectId = 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b';
  const validBoardId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
  const validUserId = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f';
  const validAssigneeId = 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a';

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findViewById: jest.fn(),
      maxPosition: jest.fn().mockResolvedValue(0),
      setLabels: jest.fn().mockResolvedValue(undefined),
      addSubtask: jest.fn().mockResolvedValue(undefined),
    } as any;

    boardRepo = {
      findById: jest.fn().mockResolvedValue({
        id: validBoardId,
        projectId: validProjectId,
      } as any),
      listForProject: jest.fn().mockResolvedValue([]),
    } as any;

    access = {
      requireWriter: jest.fn().mockResolvedValue(undefined),
      isMember: jest.fn().mockResolvedValue(true),
    } as any;

    domain = new TaskDomainService();
    events = {
      emit: jest.fn(),
    } as any;

    handler = new CreateTaskHandler(
      repo,
      boardRepo,
      access,
      domain,
      events,
    );
  });

  describe('Standard Task Creation & Offline ID Assignment', () => {
    it('should create a new task with client-assigned UUID and assign subtasks + labels', async () => {
      const customId = 'offline-task-uuid-123';
      repo.findViewById.mockResolvedValueOnce(null); // not existing before create
      repo.findViewById.mockResolvedValueOnce({
        id: customId,
        projectId: validProjectId,
        boardId: validBoardId,
        title: 'Offline Created Task',
        labels: ['frontend', 'pwa'],
        subtasks: [{ id: 'sub-1', title: 'Subtask 1', done: false }],
      } as any);

      const cmd = new CreateTaskCommand(
        validUserId,
        validProjectId,
        validBoardId,
        'Offline Created Task',
        'Description',
        'todo',
        'high',
        validAssigneeId,
        new Date('2026-09-10T00:00:00Z'),
        ['frontend', 'pwa'],
        ['Subtask 1'],
        customId,
      );

      const result = await handler.execute(cmd);

      expect(repo.create).toHaveBeenCalledTimes(1);
      const created = repo.create.mock.calls[0][0];
      expect(created.id).toBe(customId);
      expect(created.projectId).toBe(validProjectId);
      expect(created.title).toBe('Offline Created Task');
      expect(created.priority).toBe('high');

      expect(repo.setLabels).toHaveBeenCalledWith(
        customId,
        validProjectId,
        validUserId,
        ['frontend', 'pwa'],
      );
      expect(repo.addSubtask).toHaveBeenCalledTimes(1);

      expect(events.emit).toHaveBeenCalledWith(
        TaskCreatedEvent.eventName,
        expect.any(TaskCreatedEvent),
      );
      expect(events.emit).toHaveBeenCalledWith(
        TaskAssignedEvent.eventName,
        expect.any(TaskAssignedEvent),
      );

      expect(result.id).toBe(customId);
    });

    it('should generate a new UUID when client id is omitted', async () => {
      repo.findViewById.mockImplementation(async (id: string) => ({
        id,
        projectId: validProjectId,
        boardId: validBoardId,
        title: 'Auto ID Task',
      } as any));

      const cmd = new CreateTaskCommand(
        validUserId,
        validProjectId,
        validBoardId,
        'Auto ID Task',
      );

      const result = await handler.execute(cmd);

      expect(repo.create).toHaveBeenCalledTimes(1);
      const created = repo.create.mock.calls[0][0];
      expect(created.id).toBeDefined();
      expect(created.id.length).toBeGreaterThan(10);
      expect(result.id).toBe(created.id);
    });
  });

  describe('Idempotent Replay (Same Project)', () => {
    it('should return existing task directly without creating new DB row or re-emitting events', async () => {
      const customId = 'offline-task-uuid-replay';
      const existingTask = {
        id: customId,
        projectId: validProjectId,
        boardId: validBoardId,
        title: 'Offline Created Task',
      } as any;

      repo.findViewById.mockResolvedValue(existingTask);

      const cmd = new CreateTaskCommand(
        validUserId,
        validProjectId,
        validBoardId,
        'Offline Created Task',
        'Description',
        'todo',
        'medium',
        undefined,
        undefined,
        undefined,
        undefined,
        customId,
      );

      const result = await handler.execute(cmd);

      // Must be idempotent
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.setLabels).not.toHaveBeenCalled();
      expect(repo.addSubtask).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
      expect(result.id).toBe(customId);
    });
  });

  describe('Cross-Project ID Collision & Hijacking Prevention', () => {
    it('should reject with InvalidTaskFieldError if supplied ID exists in a different project', async () => {
      const collidingId = 'colliding-task-uuid';
      const taskInOtherProject = {
        id: collidingId,
        projectId: otherProjectId, // Different project!
        title: 'Other project task',
      } as any;

      repo.findViewById.mockResolvedValue(taskInOtherProject);

      const cmd = new CreateTaskCommand(
        validUserId,
        validProjectId,
        validBoardId,
        'Malicious Task Attempt',
        'Trying to hijack ID from another project',
        'todo',
        'medium',
        undefined,
        undefined,
        undefined,
        undefined,
        collidingId,
      );

      await expect(handler.execute(cmd)).rejects.toThrow(InvalidTaskFieldError);
      expect(repo.create).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });
  });

  describe('Concurrent Replay Race Conditions', () => {
    it('should handle unique constraint violation on repo.create gracefully and return the task', async () => {
      const customId = 'concurrent-offline-uuid-1';

      // 1. Initial findViewById returns null (first check in both concurrent requests)
      repo.findViewById.mockResolvedValueOnce(null);

      // 2. repo.create throws duplicate key / unique constraint error
      const uniqueConstraintError = new Error(
        'Unique constraint failed on the fields: (`id`)',
      );
      repo.create.mockRejectedValueOnce(uniqueConstraintError);

      // 3. Post-catch findViewById returns the task created by the parallel request in the same project
      const createdByParallelRequest = {
        id: customId,
        projectId: validProjectId,
        title: 'Concurrent Task',
      } as any;
      repo.findViewById.mockResolvedValueOnce(createdByParallelRequest);

      const cmd = new CreateTaskCommand(
        validUserId,
        validProjectId,
        validBoardId,
        'Concurrent Task',
        undefined,
        'todo',
        'medium',
        undefined,
        undefined,
        undefined,
        undefined,
        customId,
      );

      const result = await handler.execute(cmd);

      expect(result).toEqual(createdByParallelRequest);
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('should reject with InvalidTaskFieldError if concurrent collision belongs to a different project', async () => {
      const customId = 'concurrent-cross-project-uuid';

      repo.findViewById.mockResolvedValueOnce(null);
      repo.create.mockRejectedValueOnce(new Error('Unique constraint failed'));

      // The task created concurrently belongs to another project
      const taskInOtherProject = {
        id: customId,
        projectId: otherProjectId,
        title: 'Task from other project',
      } as any;
      repo.findViewById.mockResolvedValueOnce(taskInOtherProject);

      const cmd = new CreateTaskCommand(
        validUserId,
        validProjectId,
        validBoardId,
        'Concurrent Attempt',
        undefined,
        'todo',
        'medium',
        undefined,
        undefined,
        undefined,
        undefined,
        customId,
      );

      await expect(handler.execute(cmd)).rejects.toThrow(InvalidTaskFieldError);
    });

    it('should rethrow unexpected non-idempotency errors from repo.create', async () => {
      const customId = 'some-uuid';
      repo.findViewById.mockResolvedValueOnce(null);
      repo.create.mockRejectedValueOnce(new Error('Database connection lost'));

      // Post-catch findViewById still returns null
      repo.findViewById.mockResolvedValueOnce(null);

      const cmd = new CreateTaskCommand(
        validUserId,
        validProjectId,
        validBoardId,
        'Task',
        undefined,
        'todo',
        'medium',
        undefined,
        undefined,
        undefined,
        undefined,
        customId,
      );

      await expect(handler.execute(cmd)).rejects.toThrow('Database connection lost');
    });
  });

  describe('Authorization and Board Validation', () => {
    it('should throw AssigneeNotMemberError if assignee is not a member of the project', async () => {
      access.isMember.mockResolvedValue(false);

      const cmd = new CreateTaskCommand(
        validUserId,
        validProjectId,
        validBoardId,
        'Task',
        undefined,
        'todo',
        'medium',
        'non-member-user-id',
      );

      await expect(handler.execute(cmd)).rejects.toThrow(AssigneeNotMemberError);
    });

    it('should throw InvalidTaskFieldError if project has no boards', async () => {
      boardRepo.findById.mockResolvedValue(null);
      boardRepo.listForProject.mockResolvedValue([]);

      const cmd = new CreateTaskCommand(
        validUserId,
        validProjectId,
        undefined,
        'Task without board',
      );

      await expect(handler.execute(cmd)).rejects.toThrow(InvalidTaskFieldError);
    });

    it('should fallback to first board in project if supplied boardId belongs to another project', async () => {
      boardRepo.findById.mockResolvedValueOnce({
        id: 'board-other',
        projectId: otherProjectId,
      } as any);

      boardRepo.listForProject.mockResolvedValueOnce([
        { id: 'board-fallback-1', projectId: validProjectId } as any,
      ]);

      boardRepo.findById.mockResolvedValueOnce({
        id: 'board-fallback-1',
        projectId: validProjectId,
      } as any);

      repo.findViewById.mockResolvedValue({
        id: 'new-task-id',
        projectId: validProjectId,
        boardId: 'board-fallback-1',
        title: 'Task on fallback board',
      } as any);

      const cmd = new CreateTaskCommand(
        validUserId,
        validProjectId,
        'board-other',
        'Task on fallback board',
      );

      const result = await handler.execute(cmd);

      expect(repo.create).toHaveBeenCalledTimes(1);
      const created = repo.create.mock.calls[0][0];
      expect(created.boardId).toBe('board-fallback-1');
      expect(result.boardId).toBe('board-fallback-1');
    });
  });
});
