// src/modules/comments/infrastructure/persistence/comment.repository.ts
//
// Prisma implementation of ICommentRepository. Maps DB columns `content`→body,
// `userId`→authorId. The project is derived from the comment's task. Comments are hard
// deleted so the task's `_count.comments` stays accurate.

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { CommentEntity } from '../../domain/entities/comment.entity';
import {
  CommentView,
  ICommentRepository,
} from '../../domain/repositories/comment.repository.interface';

type CommentRow = Prisma.CommentGetPayload<{
  include: { user: true; task: { select: { projectId: true } } };
}>;

const commentInclude = {
  user: true,
  task: { select: { projectId: true } },
} satisfies Prisma.CommentInclude;

@Injectable()
export class CommentRepository implements ICommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getTaskProjectId(taskId: string): Promise<string | null> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { projectId: true },
    });
    return task?.projectId ?? null;
  }

  async create(comment: CommentEntity): Promise<void> {
    await this.prisma.comment.create({
      data: {
        id: comment.id,
        taskId: comment.taskId,
        userId: comment.authorId,
        content: comment.body,
        createdAt: comment.createdAt,
        editedAt: comment.editedAt,
      },
    });
  }

  async findById(id: string): Promise<CommentEntity | null> {
    const row = await this.prisma.comment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) return null;
    return CommentEntity.fromPersistence({
      id: row.id,
      taskId: row.taskId,
      authorId: row.userId,
      body: row.content,
      createdAt: row.createdAt,
      editedAt: row.editedAt,
      deletedAt: row.deletedAt,
    });
  }

  async findViewById(id: string): Promise<CommentView | null> {
    const row = await this.prisma.comment.findFirst({
      where: { id, deletedAt: null },
      include: commentInclude,
    });
    return row ? this.toView(row) : null;
  }

  async listForTask(taskId: string): Promise<CommentView[]> {
    const rows = await this.prisma.comment.findMany({
      where: { taskId, deletedAt: null },
      include: commentInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toView(r));
  }

  async update(comment: CommentEntity): Promise<void> {
    await this.prisma.comment.update({
      where: { id: comment.id },
      data: { content: comment.body, editedAt: comment.editedAt },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.comment.delete({ where: { id } });
  }

  private toView(row: CommentRow): CommentView {
    return {
      id: row.id,
      taskId: row.taskId,
      projectId: row.task.projectId,
      authorId: row.userId,
      author: {
        id: row.user.id,
        name: row.user.name,
        email: row.user.email,
        avatarUrl: row.user.avatarUrl ?? null,
      },
      body: row.content,
      createdAt: row.createdAt,
      editedAt: row.editedAt,
    };
  }
}
