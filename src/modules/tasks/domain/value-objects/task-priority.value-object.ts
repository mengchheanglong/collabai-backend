// src/modules/tasks/domain/value-objects/task-priority.value-object.ts
//
// Task priority. Stored as a plain string column; this VO is the single source of the
// allowed values and validity check.

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export const TASK_PRIORITIES: readonly TaskPriority[] = [
  'low',
  'medium',
  'high',
  'urgent',
];

export const TaskPriorities = {
  isValid(value: string): value is TaskPriority {
    return (TASK_PRIORITIES as readonly string[]).includes(value);
  },
} as const;
