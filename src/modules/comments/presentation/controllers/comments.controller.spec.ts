import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CommentsController } from './comments.controller';
import { GetTaskCommentsQuery } from '../../application/queries/get-task-comments.query';
import { AddCommentCommand } from '../../application/commands/add-comment.command';
import { EditCommentCommand } from '../../application/commands/edit-comment.command';
import { DeleteCommentCommand } from '../../application/commands/delete-comment.command';
import { CommentView } from '../../domain/repositories/comment.repository.interface';

describe('CommentsController', () => {
  let controller: CommentsController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  const mockCommentView: CommentView = {
    id: '11111111-1111-4111-a111-111111111111',
    taskId: '22222222-2222-4222-a222-222222222222',
    projectId: '33333333-3333-4333-a333-333333333333',
    authorId: '44444444-4444-4444-a444-444444444444',
    author: {
      id: '44444444-4444-4444-a444-444444444444',
      name: 'Alice',
      email: 'alice@example.com',
      avatarUrl: null,
    },
    body: 'This is a comment body',
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    editedAt: null,
  };

  beforeEach(() => {
    commandBus = { execute: jest.fn() } as any;
    queryBus = { execute: jest.fn() } as any;
    controller = new CommentsController(commandBus, queryBus);
  });

  describe('list', () => {
    it('executes GetTaskCommentsQuery and returns mapped comments', async () => {
      queryBus.execute.mockResolvedValueOnce([mockCommentView]);

      const res = await controller.list('user-1', mockCommentView.taskId);
      expect(queryBus.execute).toHaveBeenCalledWith(expect.any(GetTaskCommentsQuery));
      expect(res.comments).toHaveLength(1);
    });
  });

  describe('add', () => {
    it('executes AddCommentCommand and returns created comment', async () => {
      commandBus.execute.mockResolvedValueOnce(mockCommentView);

      const res = await controller.add('user-1', mockCommentView.taskId, {
        body: 'This is a comment body',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(AddCommentCommand));
      expect(res.comment.id).toBe(mockCommentView.id);
    });
  });

  describe('edit & editNested', () => {
    it('executes EditCommentCommand and returns updated comment', async () => {
      commandBus.execute.mockResolvedValueOnce(mockCommentView);

      const res = await controller.edit('user-1', mockCommentView.id, {
        body: 'Updated comment body',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(EditCommentCommand));
      expect(res.comment).toBeDefined();
    });

    it('delegates editNested to edit', async () => {
      commandBus.execute.mockResolvedValueOnce(mockCommentView);

      const res = await controller.editNested(
        'user-1',
        mockCommentView.taskId,
        mockCommentView.id,
        { body: 'Updated comment body' },
      );

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(EditCommentCommand));
      expect(res.comment).toBeDefined();
    });
  });

  describe('remove & removeNested', () => {
    it('executes DeleteCommentCommand and returns success message', async () => {
      commandBus.execute.mockResolvedValueOnce(undefined);

      const res = await controller.remove('user-1', mockCommentView.id);
      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(DeleteCommentCommand));
      expect(res.success).toBe(true);
    });

    it('delegates removeNested to remove', async () => {
      commandBus.execute.mockResolvedValueOnce(undefined);

      const res = await controller.removeNested(
        'user-1',
        mockCommentView.taskId,
        mockCommentView.id,
      );

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(DeleteCommentCommand));
      expect(res.success).toBe(true);
    });
  });
});
