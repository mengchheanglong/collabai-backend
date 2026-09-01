// src/modules/comments/application/commands/add-comment.handler.spec.ts

import { AddCommentHandler } from './add-comment.handler';
import { AddCommentCommand } from './add-comment.command';
import { ICommentRepository } from '../../domain/repositories/comment.repository.interface';
import { CommentAccessService } from '../services/comment-access.service';
import { CommentDomainService } from '../../domain/services/comment.domain.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  InvalidCommentFieldError,
  TaskNotFoundError,
} from '../errors/comment.errors';
import { CommentAddedEvent } from '../../domain/events/comment-added.event';
import { MentionCreatedEvent } from '../../domain/events/mention-created.event';

describe('AddCommentHandler (Offline Sync, Concurrency & Idempotency)', () => {
  let handler: AddCommentHandler;
  let repo: jest.Mocked<ICommentRepository>;
  let access: jest.Mocked<CommentAccessService>;
  let domain: CommentDomainService;
  let events: jest.Mocked<EventEmitter2>;

  const validTaskId = 't1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c';
  const otherTaskId = 't2a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c';
  const validProjectId = 'p1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c';
  const validUserId = 'u1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c';
  const mentionedUserId = 'u2a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c';

  beforeEach(() => {
    repo = {
      getTaskProjectId: jest.fn().mockResolvedValue(validProjectId),
      create: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findViewById: jest.fn(),
      listForTask: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    access = {
      requireWriter: jest.fn().mockResolvedValue(undefined),
      requireAuthorOrModerator: jest.fn().mockResolvedValue(undefined),
      resolveMentionedMemberIds: jest.fn().mockResolvedValue([mentionedUserId]),
    } as any;

    domain = new CommentDomainService();
    events = {
      emit: jest.fn(),
    } as any;

    handler = new AddCommentHandler(
      repo,
      access,
      domain,
      events,
    );
  });

  describe('Standard Comment Creation & Client ID Assignment', () => {
    it('should create comment with client-assigned UUID and emit events', async () => {
      const customId = 'offline-comment-uuid-123';
      repo.findViewById.mockResolvedValueOnce(null);
      repo.findViewById.mockResolvedValueOnce({
        id: customId,
        taskId: validTaskId,
        projectId: validProjectId,
        authorId: validUserId,
        body: 'Hello @alice@example.com',
      } as any);

      const cmd = new AddCommentCommand(
        validUserId,
        validTaskId,
        'Hello @alice@example.com',
        customId,
      );

      const result = await handler.execute(cmd);

      expect(repo.create).toHaveBeenCalledTimes(1);
      const created = repo.create.mock.calls[0][0];
      expect(created.id).toBe(customId);
      expect(created.taskId).toBe(validTaskId);
      expect(created.body).toBe('Hello @alice@example.com');

      expect(events.emit).toHaveBeenCalledWith(
        CommentAddedEvent.eventName,
        expect.any(CommentAddedEvent),
      );
      expect(events.emit).toHaveBeenCalledWith(
        MentionCreatedEvent.eventName,
        expect.any(MentionCreatedEvent),
      );

      expect(result.id).toBe(customId);
    });

    it('should auto-generate UUID when client id is not provided', async () => {
      repo.findViewById.mockImplementation(async (id: string) => ({
        id,
        taskId: validTaskId,
        projectId: validProjectId,
        authorId: validUserId,
        body: 'Simple comment',
      } as any));

      const cmd = new AddCommentCommand(validUserId, validTaskId, 'Simple comment');
      const result = await handler.execute(cmd);

      expect(repo.create).toHaveBeenCalledTimes(1);
      const created = repo.create.mock.calls[0][0];
      expect(created.id).toBeDefined();
      expect(result.id).toBe(created.id);
    });
  });

  describe('Idempotent Replay (Same Task)', () => {
    it('should return existing comment directly without creating duplicate DB row', async () => {
      const customId = 'offline-comment-replay-1';
      const existingComment = {
        id: customId,
        taskId: validTaskId,
        projectId: validProjectId,
        authorId: validUserId,
        body: 'Replayed comment',
      } as any;

      repo.findViewById.mockResolvedValue(existingComment);

      const cmd = new AddCommentCommand(
        validUserId,
        validTaskId,
        'Replayed comment',
        customId,
      );

      const result = await handler.execute(cmd);

      expect(repo.create).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
      expect(result.id).toBe(customId);
    });
  });

  describe('Cross-Task ID Collision Prevention', () => {
    it('should reject with InvalidCommentFieldError if ID exists on another task', async () => {
      const collidingId = 'colliding-comment-id';
      const commentOnOtherTask = {
        id: collidingId,
        taskId: otherTaskId,
        projectId: validProjectId,
        authorId: validUserId,
        body: 'Existing comment on other task',
      } as any;

      repo.findViewById.mockResolvedValue(commentOnOtherTask);

      const cmd = new AddCommentCommand(
        validUserId,
        validTaskId,
        'Malicious comment',
        collidingId,
      );

      await expect(handler.execute(cmd)).rejects.toThrow(InvalidCommentFieldError);
      expect(repo.create).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });
  });

  describe('Concurrent Replay Race Conditions', () => {
    it('should handle unique constraint collision gracefully and return existing comment', async () => {
      const customId = 'concurrent-comment-uuid-1';

      repo.findViewById.mockResolvedValueOnce(null);
      repo.create.mockRejectedValueOnce(
        new Error('Unique constraint failed on the fields: (`id`)'),
      );

      const createdByParallelRequest = {
        id: customId,
        taskId: validTaskId,
        projectId: validProjectId,
        authorId: validUserId,
        body: 'Concurrent comment',
      } as any;
      repo.findViewById.mockResolvedValueOnce(createdByParallelRequest);

      const cmd = new AddCommentCommand(
        validUserId,
        validTaskId,
        'Concurrent comment',
        customId,
      );

      const result = await handler.execute(cmd);

      expect(result).toEqual(createdByParallelRequest);
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('should reject with InvalidCommentFieldError if concurrent collision is on a different task', async () => {
      const customId = 'concurrent-cross-task-uuid';

      repo.findViewById.mockResolvedValueOnce(null);
      repo.create.mockRejectedValueOnce(new Error('Unique constraint failed'));

      const commentOnOtherTask = {
        id: customId,
        taskId: otherTaskId,
        projectId: validProjectId,
        authorId: validUserId,
        body: 'Other task comment',
      } as any;
      repo.findViewById.mockResolvedValueOnce(commentOnOtherTask);

      const cmd = new AddCommentCommand(
        validUserId,
        validTaskId,
        'Comment',
        customId,
      );

      await expect(handler.execute(cmd)).rejects.toThrow(InvalidCommentFieldError);
    });
  });

  describe('Validation & Task Existence', () => {
    it('should throw TaskNotFoundError if task does not exist', async () => {
      repo.getTaskProjectId.mockResolvedValue(null);

      const cmd = new AddCommentCommand(
        validUserId,
        'non-existent-task-id',
        'Comment on ghost task',
      );

      await expect(handler.execute(cmd)).rejects.toThrow(TaskNotFoundError);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });
});
