// src/modules/tasks/application/commands/move-task.command.ts
import { TaskStatus } from '../../domain/value-objects/task-status.value-object';

export class MoveTaskCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly taskId: string,
    public readonly status: TaskStatus,
    // Omitted -> append to the end of the destination column.
    public readonly position?: number,
  ) {}
}
