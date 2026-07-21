// src/modules/tasks/application/queries/get-tasks.handler.ts
// List tasks in a project with optional filters. Caller must be a project member.

import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetTasksQuery } from './get-tasks.query';
import {
  type ITaskRepository,
  Paginated,
  TASK_REPOSITORY,
  TaskView,
} from '../../domain/repositories/task.repository.interface';
import { TaskAccessService } from '../services/task-access.service';

@QueryHandler(GetTasksQuery)
export class GetTasksHandler implements IQueryHandler<GetTasksQuery> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly repo: ITaskRepository,
    private readonly access: TaskAccessService,
  ) {}

  async execute(query: GetTasksQuery): Promise<Paginated<TaskView>> {
    await this.access.requireMember(query.projectId, query.userId);
    const page = Math.max(1, query.filters.page);
    const limit = Math.min(100, Math.max(1, query.filters.limit));
    return this.repo.list(query.projectId, { ...query.filters, page, limit });
  }
}
