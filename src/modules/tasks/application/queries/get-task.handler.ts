// src/modules/tasks/application/queries/get-task.handler.ts
// Fetch a single task (with subtasks/labels/commentCount). Caller must be a project member.

import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetTaskQuery } from './get-task.query';
import {
  type ITaskRepository,
  TASK_REPOSITORY,
  TaskView,
} from '../../domain/repositories/task.repository.interface';
import { TaskAccessService } from '../services/task-access.service';
import { TaskNotFoundError } from '../errors/task.errors';

@QueryHandler(GetTaskQuery)
export class GetTaskHandler implements IQueryHandler<GetTaskQuery> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly repo: ITaskRepository,
    private readonly access: TaskAccessService,
  ) {}

  async execute(query: GetTaskQuery): Promise<TaskView> {
    const task = await this.repo.findById(query.taskId);
    if (!task) throw new TaskNotFoundError();
    await this.access.requireMember(task.projectId, query.userId);

    const view = await this.repo.findViewById(query.taskId);
    if (!view) throw new TaskNotFoundError();
    return view;
  }
}
