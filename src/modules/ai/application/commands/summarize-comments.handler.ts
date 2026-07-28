// src/modules/ai/application/commands/summarize-comments.handler.ts
// Summarize a task's comments. Caller must be a member of the task's project. Reuses the
// comments module's COMMENT_REPOSITORY to resolve the project and load the thread.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SummarizeCommentsCommand } from './summarize-comments.command';
import {
  AI_PROVIDER,
  type IAiProvider,
} from '../../domain/services/ai-provider.interface';
import { AiAccessService } from '../services/ai-access.service';
import {
  type ICommentRepository,
  COMMENT_REPOSITORY,
} from '../../../comments/domain/repositories/comment.repository.interface';
import { TaskNotFoundError } from '../errors/ai.errors';

@CommandHandler(SummarizeCommentsCommand)
export class SummarizeCommentsHandler
  implements ICommandHandler<SummarizeCommentsCommand>
{
  constructor(
    @Inject(AI_PROVIDER) private readonly ai: IAiProvider,
    @Inject(COMMENT_REPOSITORY) private readonly comments: ICommentRepository,
    private readonly access: AiAccessService,
  ) {}

  async execute(
    command: SummarizeCommentsCommand,
  ): Promise<{ summary: string }> {
    const projectId = await this.comments.getTaskProjectId(command.taskId);
    if (!projectId) throw new TaskNotFoundError();
    await this.access.requireMember(projectId, command.userId);

    const thread = await this.comments.listForTask(command.taskId);
    const summary = await this.ai.summarizeComments({
      comments: thread.map((c) => c.body),
    });
    return { summary };
  }
}
