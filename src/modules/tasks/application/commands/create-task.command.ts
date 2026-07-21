// src/modules/tasks/application/commands/create-task.command.ts
import { TaskStatus } from '../../domain/value-objects/task-status.value-object';
import { TaskPriority } from '../../domain/value-objects/task-priority.value-object';

export class CreateTaskCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly projectId: string,
    public readonly title: string,
    public readonly description?: string,
    public readonly status?: TaskStatus,
    public readonly priority?: TaskPriority,
    public readonly assigneeId?: string,
    public readonly dueDate?: Date,
    public readonly labels?: string[],
  ) {}
}
