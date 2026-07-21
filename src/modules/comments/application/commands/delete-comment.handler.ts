// src/modules/comments/application/commands/delete-comment.handler.ts
// Delete a comment. Allowed for the author or a project moderator (owner/admin). Hard
// delete keeps the task's derived commentCount accurate.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteCommentCommand } from './delete-comment.command';
import {
  type ICommentRepository,
  COMMENT_REPOSITORY,
} from '../../domain/repositories/comment.repository.interface';
import { CommentAccessService } from '../services/comment-access.service';
import {
  CommentNotFoundError,
  TaskNotFoundError,
} from '../errors/comment.errors';

@CommandHandler(DeleteCommentCommand)
export class DeleteCommentHandler
  implements ICommandHandler<DeleteCommentCommand>
{
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly repo: ICommentRepository,
    private readonly access: CommentAccessService,
  ) {}

  async execute(command: DeleteCommentCommand): Promise<void> {
    const comment = await this.repo.findById(command.commentId);
    if (!comment) throw new CommentNotFoundError();

    const projectId = await this.repo.getTaskProjectId(comment.taskId);
    if (!projectId) throw new TaskNotFoundError();

    await this.access.requireAuthorOrModerator(
      projectId,
      command.actingUserId,
      comment.authorId,
    );

    await this.repo.delete(comment.id);
  }
}
