// src/modules/comments/application/commands/edit-comment.handler.ts
// Edit a comment. Allowed for the author or a project moderator (owner/admin).

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EditCommentCommand } from './edit-comment.command';
import {
  type ICommentRepository,
  COMMENT_REPOSITORY,
  CommentView,
} from '../../domain/repositories/comment.repository.interface';
import { CommentAccessService } from '../services/comment-access.service';
import {
  CommentNotFoundError,
  TaskNotFoundError,
} from '../errors/comment.errors';

@CommandHandler(EditCommentCommand)
export class EditCommentHandler implements ICommandHandler<EditCommentCommand> {
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly repo: ICommentRepository,
    private readonly access: CommentAccessService,
  ) {}

  async execute(command: EditCommentCommand): Promise<CommentView> {
    const comment = await this.repo.findById(command.commentId);
    if (!comment) throw new CommentNotFoundError();

    const projectId = await this.repo.getTaskProjectId(comment.taskId);
    if (!projectId) throw new TaskNotFoundError();

    await this.access.requireAuthorOrModerator(
      projectId,
      command.actingUserId,
      comment.authorId,
    );

    comment.edit(command.body);
    await this.repo.update(comment);

    const view = await this.repo.findViewById(comment.id);
    if (!view) throw new CommentNotFoundError();
    return view;
  }
}
