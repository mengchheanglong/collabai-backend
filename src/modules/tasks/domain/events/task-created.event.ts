// src/modules/tasks/domain/events/task-created.event.ts
export class TaskCreatedEvent {
  static readonly eventName = 'task.created';
  constructor(
    public readonly taskId: string,
    public readonly projectId: string,
    public readonly actorId: string,
    public readonly title: string,
  ) {}
}
