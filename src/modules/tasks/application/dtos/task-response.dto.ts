// src/modules/tasks/application/dtos/task-response.dto.ts
//
// Mapper from the TaskView read model to API response shape (plain mapper, matching the
// auth/projects style).

import {
  SubtaskView,
  TaskView,
} from '../../domain/repositories/task.repository.interface';
import { TaskPriority } from '../../domain/value-objects/task-priority.value-object';
import { TaskStatus } from '../../domain/value-objects/task-status.value-object';

export interface SubtaskResponse {
  id: string;
  _id?: string;
  title: string;
  done: boolean;
}

export interface TaskResponse {
  id: string;
  _id?: string;
  projectId: string;
  boardId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  assigneeId: string | null;
  createdById: string;
  dueDate: string | null;
  completedAt: string | null;
  labels: string[];
  subtasks: SubtaskResponse[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

function toSubtaskResponse(s: SubtaskView): SubtaskResponse {
  return { id: s.id, _id: s.id, title: s.title, done: s.done };
}

export function toTaskResponse(t: TaskView): TaskResponse {
  return {
    id: t.id,
    _id: t.id,
    projectId: t.projectId,
    boardId: t.boardId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    position: t.position,
    assigneeId: t.assigneeId,
    createdById: t.createdById,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    labels: t.labels,
    subtasks: t.subtasks.map(toSubtaskResponse),
    commentCount: t.commentCount,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
