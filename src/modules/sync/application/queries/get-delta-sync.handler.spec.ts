// src/modules/sync/application/queries/get-delta-sync.handler.spec.ts

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GetDeltaSyncHandler } from './get-delta-sync.handler';
import { GetDeltaSyncQuery } from './get-delta-sync.query';
import { PrismaService } from '../../../../shared/services/prisma.service';

describe('GetDeltaSyncHandler', () => {
  let handler: GetDeltaSyncHandler;
  let prisma: jest.Mocked<PrismaService>;

  const validProjectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const validUserId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

  beforeEach(() => {
    prisma = {
      project: {
        findFirst: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
      },
      board: {
        findMany: jest.fn(),
      },
      comment: {
        findMany: jest.fn(),
      },
    } as any;

    handler = new GetDeltaSyncHandler(prisma);
  });

  describe('Multi-tenant isolation & Access Control', () => {
    it('should throw NotFoundException if projectId is not a valid UUID', async () => {
      const query = new GetDeltaSyncQuery(validUserId, 'invalid-uuid');

      await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
      expect(prisma.project.findFirst).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if project does not exist in database', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      const query = new GetDeltaSyncQuery(validUserId, validProjectId);

      await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: validProjectId, deletedAt: null },
        include: { members: { where: { userId: validUserId, isActive: true } } },
      });
    });

    it('should throw ForbiddenException if user is not owner and not an active member', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: validProjectId,
        ownerId: 'different-owner-uuid-000000000000',
        members: [],
      } as any);

      const query = new GetDeltaSyncQuery(validUserId, validProjectId);

      await expect(handler.execute(query)).rejects.toThrow(ForbiddenException);
    });

    it('should allow access if user is the project owner', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: validProjectId,
        ownerId: validUserId,
        members: [],
      } as any);

      prisma.task.findMany.mockResolvedValue([]);
      prisma.board.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([]);

      const query = new GetDeltaSyncQuery(validUserId, validProjectId);
      const result = await handler.execute(query);

      expect(result).toBeDefined();
      expect(result.serverTime).toBeDefined();
    });

    it('should allow access if user is an active project member', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: validProjectId,
        ownerId: 'different-owner-uuid-000000000000',
        members: [{ id: 'm1', userId: validUserId, isActive: true }],
      } as any);

      prisma.task.findMany.mockResolvedValue([]);
      prisma.board.findMany.mockResolvedValue([]);
      prisma.comment.findMany.mockResolvedValue([]);

      const query = new GetDeltaSyncQuery(validUserId, validProjectId);
      const result = await handler.execute(query);

      expect(result).toBeDefined();
      expect(result.serverTime).toBeDefined();
    });
  });

  describe('Delta Sync Boundaries & Timestamp Handling', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({
        id: validProjectId,
        ownerId: validUserId,
        members: [],
      } as any);
    });

    it('should throw BadRequestException if since is an invalid Date', async () => {
      const invalidDate = new Date('invalid-timestamp-string');
      const query = new GetDeltaSyncQuery(validUserId, validProjectId, invalidDate);

      await expect(handler.execute(query)).rejects.toThrow(BadRequestException);
    });

    it('should handle skewed future timestamps by returning empty deltas and current serverTime', async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours in the future
      const query = new GetDeltaSyncQuery(validUserId, validProjectId, futureDate);

      const result = await handler.execute(query);

      expect(result.serverTime).toBeDefined();
      expect(new Date(result.serverTime).getTime()).toBeLessThan(futureDate.getTime());
      expect(result.tasks.upserted).toEqual([]);
      expect(result.tasks.deletedIds).toEqual([]);
      expect(result.comments.upserted).toEqual([]);
      expect(result.comments.deletedIds).toEqual([]);
      expect(result.boards.upserted).toEqual([]);
      // DB queries should not be run when future timestamp is detected
      expect(prisma.task.findMany).not.toHaveBeenCalled();
      expect(prisma.board.findMany).not.toHaveBeenCalled();
      expect(prisma.comment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Initial Full Snapshot (since omitted)', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({
        id: validProjectId,
        ownerId: validUserId,
        members: [],
      } as any);
    });

    it('should return initial full snapshot with formatted tasks, subtasks, labels, boards, and comments', async () => {
      const createdAt = new Date('2026-08-01T00:00:00Z');
      const updatedAt = new Date('2026-08-02T00:00:00Z');
      const dueDate = new Date('2026-08-10T00:00:00Z');

      const mockRawTasks = [
        {
          id: 'task-1',
          projectId: validProjectId,
          boardId: 'board-1',
          title: 'Implement Delta Sync',
          description: 'Full dive sync',
          status: 'in_progress',
          priority: 'high',
          position: 100,
          assignedTo: 'user-assignee',
          createdBy: validUserId,
          dueDate,
          completedAt: null,
          createdAt,
          updatedAt,
          labels: [
            { label: { name: 'backend' } },
            { label: { name: 'sync' } },
          ],
          subtasks: [
            { id: 'sub-1', title: 'Task 1 subtask', completed: false, orderIndex: 1 },
            { id: 'sub-2', title: 'Task 2 subtask', completed: true, orderIndex: 2 },
          ],
          assignee: {
            id: 'user-assignee',
            name: 'Assignee User',
            email: 'assignee@example.com',
            avatarUrl: 'https://avatar.com/1.png',
          },
          creator: {
            id: validUserId,
            name: 'Creator User',
            email: 'creator@example.com',
            avatarUrl: null,
          },
          _count: { comments: 3 },
        },
      ];

      const mockRawBoards = [
        {
          id: 'board-1',
          projectId: validProjectId,
          name: 'Main Board',
          description: 'Sprint 1',
          columns: [{ key: 'todo', title: 'To Do', position: 0 }],
          createdAt,
          updatedAt,
        },
      ];

      const mockRawComments = [
        {
          id: 'comment-1',
          taskId: 'task-1',
          userId: 'user-commenter',
          content: 'Working on it',
          createdAt,
          editedAt: null,
          user: {
            id: 'user-commenter',
            name: 'Commenter',
            email: 'commenter@example.com',
            avatarUrl: null,
          },
          task: { projectId: validProjectId },
        },
      ];

      prisma.task.findMany.mockResolvedValue(mockRawTasks as any);
      prisma.board.findMany.mockResolvedValue(mockRawBoards as any);
      prisma.comment.findMany.mockResolvedValue(mockRawComments as any);

      const query = new GetDeltaSyncQuery(validUserId, validProjectId);
      const result = await handler.execute(query);

      expect(result.serverTime).toBeDefined();
      expect(result.tasks.deletedIds).toEqual([]);
      expect(result.comments.deletedIds).toEqual([]);

      // Verify task formatting: subtasks & labels
      expect(result.tasks.upserted).toHaveLength(1);
      const formattedTask = result.tasks.upserted[0];
      expect(formattedTask.id).toBe('task-1');
      expect(formattedTask._id).toBe('task-1');
      expect(formattedTask.assigneeId).toBe('user-assignee');
      expect(formattedTask.createdById).toBe(validUserId);
      expect(formattedTask.labels).toEqual(['backend', 'sync']);
      expect(formattedTask.subtasks).toEqual([
        { id: 'sub-1', _id: 'sub-1', title: 'Task 1 subtask', done: false, completed: false, orderIndex: 1 },
        { id: 'sub-2', _id: 'sub-2', title: 'Task 2 subtask', done: true, completed: true, orderIndex: 2 },
      ]);
      expect(formattedTask.commentCount).toBe(3);
      expect(formattedTask.dueDate).toBe(dueDate.toISOString());

      // Verify board formatting
      expect(result.boards.upserted).toHaveLength(1);
      expect(result.boards.upserted[0].id).toBe('board-1');
      expect(result.boards.upserted[0].name).toBe('Main Board');

      // Verify comment formatting
      expect(result.comments.upserted).toHaveLength(1);
      const formattedComment = result.comments.upserted[0];
      expect(formattedComment.id).toBe('comment-1');
      expect(formattedComment.authorId).toBe('user-commenter');
      expect(formattedComment.body).toBe('Working on it');
      expect(formattedComment.author.name).toBe('Commenter');
    });
  });

  describe('Incremental Delta Sync (since timestamp provided)', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({
        id: validProjectId,
        ownerId: validUserId,
        members: [],
      } as any);
    });

    it('should return upserted and soft-deleted items modified since checkpoint', async () => {
      const since = new Date('2026-08-30T00:00:00Z');

      const mockUpsertedTasks = [
        {
          id: 'task-updated-1',
          projectId: validProjectId,
          title: 'Updated Task',
          status: 'done',
          priority: 'medium',
          position: 200,
          assignedTo: null,
          createdBy: validUserId,
          labels: ['offline-sync'],
          subtasks: [{ id: 'sub-1', title: 'Done item', completed: true, orderIndex: 1 }],
          createdAt: new Date('2026-08-25T00:00:00Z'),
          updatedAt: new Date('2026-08-31T00:00:00Z'),
        },
      ];
      const mockDeletedTasks = [{ id: 'task-soft-deleted-1' }, { id: 'task-soft-deleted-2' }];
      const mockUpsertedBoards = [
        {
          id: 'board-1',
          projectId: validProjectId,
          name: 'Main Board Updated',
          createdAt: new Date('2026-08-01T00:00:00Z'),
          updatedAt: new Date('2026-08-31T10:00:00Z'),
        },
      ];
      const mockUpsertedComments = [
        {
          id: 'comment-new-1',
          taskId: 'task-updated-1',
          userId: validUserId,
          content: 'New comment since checkpoint',
          createdAt: new Date('2026-08-31T12:00:00Z'),
          editedAt: null,
        },
      ];
      const mockDeletedComments = [{ id: 'comment-soft-deleted-1' }];

      // Mock the 5 parallel promises:
      // 1. upserted tasks
      // 2. deleted tasks
      prisma.task.findMany
        .mockResolvedValueOnce(mockUpsertedTasks as any)
        .mockResolvedValueOnce(mockDeletedTasks as any);

      // 3. upserted boards
      prisma.board.findMany.mockResolvedValueOnce(mockUpsertedBoards as any);

      // 4. upserted comments
      // 5. deleted comments
      prisma.comment.findMany
        .mockResolvedValueOnce(mockUpsertedComments as any)
        .mockResolvedValueOnce(mockDeletedComments as any);

      const query = new GetDeltaSyncQuery(validUserId, validProjectId, since);
      const result = await handler.execute(query);

      expect(result.tasks.upserted).toHaveLength(1);
      expect(result.tasks.upserted[0].id).toBe('task-updated-1');
      expect(result.tasks.upserted[0].labels).toEqual(['offline-sync']);
      expect(result.tasks.upserted[0].subtasks).toEqual([
        { id: 'sub-1', _id: 'sub-1', title: 'Done item', done: true, completed: true, orderIndex: 1 },
      ]);
      expect(result.tasks.deletedIds).toEqual(['task-soft-deleted-1', 'task-soft-deleted-2']);

      expect(result.boards.upserted).toHaveLength(1);
      expect(result.boards.upserted[0].id).toBe('board-1');

      expect(result.comments.upserted).toHaveLength(1);
      expect(result.comments.upserted[0].id).toBe('comment-new-1');
      expect(result.comments.deletedIds).toEqual(['comment-soft-deleted-1']);

      // Verify prisma where filter parameters for soft deletes
      expect(prisma.task.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          projectId: validProjectId,
          deletedAt: { gt: since },
        },
        select: { id: true },
      });

      expect(prisma.comment.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          task: { projectId: validProjectId },
          deletedAt: { gt: since },
        },
        select: { id: true },
      });
    });
  });
});
