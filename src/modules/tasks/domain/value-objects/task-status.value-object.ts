// src/modules/tasks/domain/value-objects/task-status.value-object.ts
//
// Kanban status of a task and the small rules attached to it.

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export const TASK_STATUSES: readonly TaskStatus[] = [
  'todo',
  'in_progress',
  'done',
];

export const TaskStatuses = {
  isValid(value: string): value is TaskStatus {
    return (TASK_STATUSES as readonly string[]).includes(value);
  },

  isDone(value: TaskStatus): boolean {
    return value === 'done';
  },
} as const;
