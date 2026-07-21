// src/modules/tasks/domain/events/task-assigned.event.ts
// Emitted when a task gains a (new) assignee. Consumed by the notifications module later.
export class TaskAssignedEvent {
  static readonly eventName = 'task.assigned';
  constructor(
    public readonly taskId: string,
    public readonly projectId: string,
    public readonly assigneeId: string,
    public readonly assignedById: string,
    public readonly title: string,
  ) {}
}
