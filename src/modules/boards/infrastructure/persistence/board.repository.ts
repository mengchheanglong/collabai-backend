// src/modules/boards/infrastructure/persistence/board.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { isValidUuid } from '../../../../common/utils/uuid.util';
import { BoardColumn, BoardEntity } from '../../domain/entities/board.entity';
import {
  IBoardRepository,
  BoardView,
  BoardWithTasksView,
} from '../../domain/repositories/board.repository.interface';

@Injectable()
export class BoardRepository implements IBoardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(board: BoardEntity): Promise<void> {
    if (!isValidUuid(board.id) || !isValidUuid(board.projectId)) return;
    await this.prisma.board.create({
      data: {
        id: board.id,
        projectId: board.projectId,
        name: board.name,
        description: board.description,
        columns: board.columns as any,
      },
    });
  }

  async findById(id: string): Promise<BoardEntity | null> {
    if (!isValidUuid(id)) return null;
    const row = await this.prisma.board.findUnique({
      where: { id },
    });
    return row ? this.toDomain(row) : null;
  }

  async findViewById(id: string): Promise<BoardView | null> {
    if (!isValidUuid(id)) return null;
    const row = await this.prisma.board.findUnique({
      where: { id },
    });
    return row ? this.toView(row) : null;
  }

  async findViewWithTasks(id: string): Promise<BoardWithTasksView | null> {
    if (!isValidUuid(id)) return null;
    const row = await this.prisma.board.findUnique({
      where: { id },
      include: {
        tasks: {
          where: { deletedAt: null },
          include: {
            subtasks: { orderBy: { orderIndex: 'asc' } },
            labels: { include: { label: true } },
            _count: { select: { comments: { where: { deletedAt: null } } } },
          },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!row) return null;

    const view = this.toView(row);
    return {
      ...view,
      tasks: row.tasks.map((t) => ({
        id: t.id,
        boardId: t.boardId,
        projectId: t.projectId,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        position: t.position,
        assigneeId: t.assignedTo,
        createdById: t.createdBy,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        labels: t.labels.map((l) => l.label.name),
        subtasks: t.subtasks.map((s) => ({
          id: s.id,
          title: s.title,
          done: s.completed,
        })),
        commentCount: t._count.comments,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    };
  }

  async listForProject(projectId: string): Promise<BoardView[]> {
    if (!isValidUuid(projectId)) return [];
    const rows = await this.prisma.board.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toView(r));
  }

  async update(board: BoardEntity): Promise<void> {
    if (!isValidUuid(board.id)) return;
    await this.prisma.board.update({
      where: { id: board.id },
      data: {
        name: board.name,
        description: board.description,
        columns: board.columns as any,
      },
    });
  }

  async delete(id: string): Promise<void> {
    if (!isValidUuid(id)) return;
    await this.prisma.board.delete({ where: { id } });
  }

  private toDomain(row: any): BoardEntity {
    return BoardEntity.fromPersistence({
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description,
      columns: row.columns as BoardColumn[],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private toView(row: any): BoardView {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description,
      columns: row.columns as BoardColumn[],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
