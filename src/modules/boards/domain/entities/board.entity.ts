// src/modules/boards/domain/entities/board.entity.ts
//
// Board aggregate. A Board belongs to one Project and holds an ordered list of columns
// (stored as JSON). Maps 1:1 to the Prisma `Board` model.

export interface BoardColumn {
  key: string;   // 'todo' | 'in_progress' | 'done'
  title: string;
  position: number;
}

export const DEFAULT_COLUMNS: BoardColumn[] = [
  { key: 'todo', title: 'To Do', position: 0 },
  { key: 'in_progress', title: 'In Progress', position: 1 },
  { key: 'done', title: 'Done', position: 2 },
];

export interface BoardProps {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  columns: BoardColumn[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBoardProps {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
}

export class BoardEntity {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  columns: BoardColumn[];
  createdAt: Date;
  updatedAt: Date;

  private constructor(props: BoardProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.name = props.name;
    this.description = props.description;
    this.columns = props.columns;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: CreateBoardProps): BoardEntity {
    const now = new Date();
    return new BoardEntity({
      id: props.id,
      projectId: props.projectId,
      name: props.name.trim(),
      description: props.description?.trim() ?? null,
      columns: DEFAULT_COLUMNS,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: BoardProps): BoardEntity {
    return new BoardEntity(props);
  }

  applyUpdate(patch: { name?: string; description?: string | null }): void {
    if (patch.name !== undefined) this.name = patch.name.trim();
    if (patch.description !== undefined)
      this.description = patch.description?.trim() ?? null;
    this.updatedAt = new Date();
  }
}
