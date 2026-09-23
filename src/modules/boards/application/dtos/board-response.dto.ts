// src/modules/boards/application/dtos/board-response.dto.ts
//
// Response shapes + mappers from repository read models to API output.
// Per contract: uses `_id` per API-CONTRACT.md BoardDto.

import {
  BoardView,
  BoardWithTasksView,
  TaskInBoardView,
} from '../../domain/repositories/board.repository.interface';

export interface BoardColumnResponse {
  key: string;
  title: string;
  position: number;
}

export interface SubtaskInBoardResponse {
  id?: string;
  _id: string;
  title: string;
  done: boolean;
}

export interface TaskInBoardResponse {
  id?: string;
  _id: string;
  projectId: string;
  boardId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  position: number;
  assigneeId: string | null;
  createdById: string;
  dueDate: string | null;
  labels: string[];
  subtasks: SubtaskInBoardResponse[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoardResponse {
  id?: string;
  _id: string;
  projectId: string;
  name: string;
  description: string | null;
  columns: BoardColumnResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface BoardWithTasksResponse extends BoardResponse {
  tasks: TaskInBoardResponse[];
}

export function toBoardResponse(v: BoardView): BoardResponse {
  return {
    id: v.id,
    _id: v.id,
    projectId: v.projectId,
    name: v.name,
    description: v.description,
    columns: v.columns.map((c) => ({
      key: c.key,
      title: c.title,
      position: c.position,
    })),
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

export function toTaskInBoardResponse(t: TaskInBoardView): TaskInBoardResponse {
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
    labels: t.labels,
    subtasks: t.subtasks.map((s) => ({
      id: s.id,
      _id: s.id,
      title: s.title,
      done: s.done,
    })),
    commentCount: t.commentCount,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function toBoardWithTasksResponse(
  v: BoardWithTasksView,
): BoardWithTasksResponse {
  return {
    ...toBoardResponse(v),
    tasks: v.tasks.map(toTaskInBoardResponse),
  };
}
