// src/modules/tasks/application/queries/get-tasks.query.ts
import { TaskStatus } from '../../domain/value-objects/task-status.value-object';

export class GetTasksQuery {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
    public readonly filters: {
      status?: TaskStatus;
      assigneeId?: string;
      q?: string;
      label?: string;
      dueBefore?: Date;
      page: number;
      limit: number;
    },
  ) {}
}
