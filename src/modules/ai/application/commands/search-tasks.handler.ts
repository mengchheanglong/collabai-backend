// src/modules/ai/application/commands/search-tasks.handler.ts
// Natural-language task search: the provider interprets the query into a structured filter,
// which is then run through the tasks module's TASK_REPOSITORY. Caller must be a member.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SearchTasksCommand } from './search-tasks.command';
import {
  AI_PROVIDER,
  type IAiProvider,
} from '../../domain/services/ai-provider.interface';
import { AiAccessService } from '../services/ai-access.service';
import {
  type ITaskRepository,
  TASK_REPOSITORY,
} from '../../../tasks/domain/repositories/task.repository.interface';
import {
  toTaskResponse,
  TaskResponse,
} from '../../../tasks/application/dtos/task-response.dto';

export interface SearchTasksResult {
  interpretedQuery: Record<string, unknown>;
  tasks: TaskResponse[];
  taskIds: string[];
}

@CommandHandler(SearchTasksCommand)
export class SearchTasksHandler implements ICommandHandler<SearchTasksCommand> {
  constructor(
    @Inject(AI_PROVIDER) private readonly ai: IAiProvider,
    @Inject(TASK_REPOSITORY) private readonly tasks: ITaskRepository,
    private readonly access: AiAccessService,
  ) {}

  async execute(command: SearchTasksCommand): Promise<SearchTasksResult> {
    await this.access.requireMember(command.projectId, command.userId);

    const interpretation = await this.ai.interpretSearch(command.query);
    const result = await this.tasks.list(command.projectId, {
      status: interpretation.status,
      label: interpretation.label,
      q: interpretation.q,
      dueBefore: interpretation.dueBefore,
      page: 1,
      limit: 50,
    });

    return {
      interpretedQuery: interpretation.raw,
      tasks: result.items.map(toTaskResponse),
      taskIds: result.items.map((i) => i.id),
    };
  }
}
