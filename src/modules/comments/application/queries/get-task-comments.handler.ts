// src/modules/comments/application/queries/get-task-comments.handler.ts
// List a task's comments (oldest first). Caller must be a project member.

import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetTaskCommentsQuery } from './get-task-comments.query';
import {
  type ICommentRepository,
  COMMENT_REPOSITORY,
  CommentView,
} from '../../domain/repositories/comment.repository.interface';
import { CommentAccessService } from '../services/comment-access.service';
import { TaskNotFoundError } from '../errors/comment.errors';

@QueryHandler(GetTaskCommentsQuery)
export class GetTaskCommentsHandler
  implements IQueryHandler<GetTaskCommentsQuery>
{
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly repo: ICommentRepository,
    private readonly access: CommentAccessService,
  ) {}

  async execute(query: GetTaskCommentsQuery): Promise<CommentView[]> {
    const projectId = await this.repo.getTaskProjectId(query.taskId);
    if (!projectId) throw new TaskNotFoundError();
    await this.access.requireMember(projectId, query.userId);
    return this.repo.listForTask(query.taskId);
  }
}
