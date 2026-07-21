// src/modules/tasks/application/commands/update-task.command.ts
import { TaskPriority } from '../../domain/value-objects/task-priority.value-object';

export interface UpdateTaskFields {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  // `undefined` = leave unchanged, `null` = unassign.
  assigneeId?: string | null;
  dueDate?: Date | null;
}

export class UpdateTaskCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly taskId: string,
    public readonly fields: UpdateTaskFields,
    public readonly labels?: string[],
  ) {}
}
