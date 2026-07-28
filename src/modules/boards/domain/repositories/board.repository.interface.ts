// src/modules/boards/domain/repositories/board.repository.interface.ts
//
// Port for board persistence + read models. The application layer depends only on this
// interface; the Prisma implementation is bound via BOARD_REPOSITORY in boards.module.ts.

import { BoardColumn, BoardEntity } from '../entities/board.entity';

export const BOARD_REPOSITORY = Symbol('BOARD_REPOSITORY');

/** Lightweight task shape for the "board + tasks" read. */
export interface TaskInBoardView {
  id: string;
  boardId: string | null;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  position: number;
  assigneeId: string | null;
  createdById: string;
  dueDate: Date | null;
  completedAt: Date | null;
  labels: string[];
  subtasks: { id: string; title: string; done: boolean }[];
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardView {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  columns: BoardColumn[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardWithTasksView extends BoardView {
  tasks: TaskInBoardView[];
}

export interface IBoardRepository {
  create(board: BoardEntity): Promise<void>;
  findById(id: string): Promise<BoardEntity | null>;
  findViewById(id: string): Promise<BoardView | null>;
  findViewWithTasks(id: string): Promise<BoardWithTasksView | null>;
  listForProject(projectId: string): Promise<BoardView[]>;
  update(board: BoardEntity): Promise<void>;
  delete(id: string): Promise<void>;
}
