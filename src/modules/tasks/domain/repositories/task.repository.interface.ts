// src/modules/tasks/domain/repositories/task.repository.interface.ts
//
// Port for task persistence (the Task aggregate: task row + its subtasks + label links).
// Bound to TASK_REPOSITORY in tasks.module.ts. Read models are denormalized shapes with
// subtasks, label names, and comment count folded in.

import { TaskEntity } from '../entities/task.entity';
import { SubtaskEntity } from '../entities/subtask.entity';
import { TaskStatus } from '../value-objects/task-status.value-object';
import { TaskPriority } from '../value-objects/task-priority.value-object';

export const TASK_REPOSITORY = Symbol('TASK_REPOSITORY');

export interface SubtaskView {
  id: string;
  title: string;
  done: boolean;
  orderIndex: number;
}

export interface TaskView {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  assigneeId: string | null;
  createdById: string;
  dueDate: Date | null;
  completedAt: Date | null;
  labels: string[];
  subtasks: SubtaskView[];
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskFilters {
  status?: TaskStatus;
  assigneeId?: string;
  q?: string;
  label?: string;
  dueBefore?: Date;
  page: number;
  limit: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ITaskRepository {
  create(task: TaskEntity): Promise<void>;
  findById(id: string): Promise<TaskEntity | null>;
  findViewById(id: string): Promise<TaskView | null>;
  update(task: TaskEntity): Promise<void>;
  delete(id: string): Promise<void>;

  list(projectId: string, filters: TaskFilters): Promise<Paginated<TaskView>>;

  /** Highest position currently used in a status column (for appending). 0 if empty. */
  maxPosition(projectId: string, status: TaskStatus): Promise<number>;

  /** Replace the task's labels with the given names (upserting per-project Label rows). */
  setLabels(
    taskId: string,
    projectId: string,
    createdById: string,
    labelNames: string[],
  ): Promise<void>;

  // ----- subtasks (part of the Task aggregate) -----
  addSubtask(subtask: SubtaskEntity): Promise<void>;
  findSubtask(subtaskId: string): Promise<SubtaskEntity | null>;
  updateSubtask(subtask: SubtaskEntity): Promise<void>;
  deleteSubtask(subtaskId: string): Promise<void>;
  maxSubtaskOrder(taskId: string): Promise<number>;
}
