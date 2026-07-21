// src/modules/tasks/domain/events/task-moved.event.ts
import { TaskStatus } from '../value-objects/task-status.value-object';

export class TaskMovedEvent {
  static readonly eventName = 'task.moved';
  constructor(
    public readonly taskId: string,
    public readonly projectId: string,
    public readonly actorId: string,
    public readonly fromStatus: TaskStatus,
    public readonly toStatus: TaskStatus,
    public readonly position: number,
  ) {}
}
