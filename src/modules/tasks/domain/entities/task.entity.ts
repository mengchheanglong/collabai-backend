// src/modules/tasks/domain/entities/task.entity.ts
//
// Task aggregate root. Owns its own state transitions (edit fields, move between kanban
// columns, (re)assign). `completedAt` is kept in sync with the `done` status here so the
// rule lives in one place. Subtasks and labels are managed alongside via the repository;
// this entity models the task row itself. Maps to the Prisma `Task` model
// (`assignedTo`→assigneeId, `createdBy`→createdById).

import {
  TaskStatus,
  TaskStatuses,
} from '../value-objects/task-status.value-object';
import { TaskPriority } from '../value-objects/task-priority.value-object';

export interface TaskProps {
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
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateTaskProps {
  id: string;
  projectId: string;
  title: string;
  createdById: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  position: number;
  assigneeId?: string | null;
  dueDate?: Date | null;
}

export class TaskEntity {
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
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  private constructor(props: TaskProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.title = props.title;
    this.description = props.description;
    this.status = props.status;
    this.priority = props.priority;
    this.position = props.position;
    this.assigneeId = props.assigneeId;
    this.createdById = props.createdById;
    this.dueDate = props.dueDate;
    this.completedAt = props.completedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: CreateTaskProps): TaskEntity {
    const now = new Date();
    const status = props.status ?? 'todo';
    return new TaskEntity({
      id: props.id,
      projectId: props.projectId,
      title: props.title.trim(),
      description: props.description?.trim() ?? null,
      status,
      priority: props.priority ?? 'medium',
      position: props.position,
      assigneeId: props.assigneeId ?? null,
      createdById: props.createdById,
      dueDate: props.dueDate ?? null,
      completedAt: TaskStatuses.isDone(status) ? now : null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static fromPersistence(props: TaskProps): TaskEntity {
    return new TaskEntity(props);
  }

  /** Partial edit of task fields (not status/position — see move()). */
  applyUpdate(patch: {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    assigneeId?: string | null;
    dueDate?: Date | null;
  }): void {
    if (patch.title !== undefined) this.title = patch.title.trim();
    if (patch.description !== undefined)
      this.description = patch.description?.trim() ?? null;
    if (patch.priority !== undefined) this.priority = patch.priority;
    if (patch.assigneeId !== undefined) this.assigneeId = patch.assigneeId;
    if (patch.dueDate !== undefined) this.dueDate = patch.dueDate;
    this.touch();
  }

  /** Move the task to a (possibly new) status/column at a given position. Keeps
   *  `completedAt` consistent with the done state. */
  move(status: TaskStatus, position: number): void {
    const wasDone = TaskStatuses.isDone(this.status);
    const willBeDone = TaskStatuses.isDone(status);
    this.status = status;
    this.position = position;
    if (willBeDone && !wasDone) this.completedAt = new Date();
    if (!willBeDone && wasDone) this.completedAt = null;
    this.touch();
  }

  private touch(): void {
    this.updatedAt = new Date();
  }
}
