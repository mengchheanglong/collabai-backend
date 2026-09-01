// src/modules/sync/application/queries/get-delta-sync.handler.ts

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { isValidUuid } from '../../../../common/utils/uuid.util';
import { GetDeltaSyncQuery } from './get-delta-sync.query';
import { SyncResponseDto } from '../dtos/sync-response.dto';

function formatTask(task: any) {
  return {
    id: task.id,
    _id: task.id,
    projectId: task.projectId,
    boardId: task.boardId ?? null,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    position: task.position,
    assigneeId: task.assignedTo ?? task.assigneeId ?? null,
    createdById: task.createdBy ?? task.createdById,
    dueDate: task.dueDate
      ? task.dueDate instanceof Date
        ? task.dueDate.toISOString()
        : task.dueDate
      : null,
    completedAt: task.completedAt
      ? task.completedAt instanceof Date
        ? task.completedAt.toISOString()
        : task.completedAt
      : null,
    labels: Array.isArray(task.labels)
      ? task.labels.map((l: any) =>
          typeof l === 'string' ? l : (l.label?.name ?? l.name ?? l),
        )
      : [],
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.map((s: any) => ({
          id: s.id,
          _id: s.id,
          title: s.title,
          done:
            s.done !== undefined
              ? Boolean(s.done)
              : s.completed !== undefined
                ? Boolean(s.completed)
                : false,
          completed:
            s.done !== undefined
              ? Boolean(s.done)
              : s.completed !== undefined
                ? Boolean(s.completed)
                : false,
          orderIndex: s.orderIndex ?? 0,
        }))
      : [],
    commentCount:
      task._count?.comments ??
      (typeof task.commentCount === 'number' ? task.commentCount : 0),
    createdAt:
      task.createdAt instanceof Date
        ? task.createdAt.toISOString()
        : task.createdAt,
    updatedAt:
      task.updatedAt instanceof Date
        ? task.updatedAt.toISOString()
        : task.updatedAt,
    assignee: task.assignee
      ? {
          id: task.assignee.id,
          _id: task.assignee.id,
          name: task.assignee.name,
          email: task.assignee.email,
          avatarUrl: task.assignee.avatarUrl ?? null,
        }
      : null,
    creator: task.creator
      ? {
          id: task.creator.id,
          _id: task.creator.id,
          name: task.creator.name,
          email: task.creator.email,
          avatarUrl: task.creator.avatarUrl ?? null,
        }
      : null,
  };
}

function formatComment(c: any, projectId: string) {
  return {
    id: c.id,
    _id: c.id,
    taskId: c.taskId,
    projectId: c.task?.projectId ?? projectId,
    authorId: c.userId ?? c.authorId,
    author: c.user
      ? {
          id: c.user.id,
          _id: c.user.id,
          name: c.user.name,
          email: c.user.email,
          avatarUrl: c.user.avatarUrl ?? null,
        }
      : (c.author ?? null),
    body: c.content ?? c.body,
    createdAt:
      c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    editedAt: c.editedAt
      ? c.editedAt instanceof Date
        ? c.editedAt.toISOString()
        : c.editedAt
      : null,
  };
}

function formatBoard(b: any) {
  return {
    id: b.id,
    _id: b.id,
    projectId: b.projectId,
    name: b.name,
    description: b.description ?? null,
    columns: b.columns,
    createdAt:
      b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
    updatedAt:
      b.updatedAt instanceof Date ? b.updatedAt.toISOString() : b.updatedAt,
  };
}

@Injectable()
@QueryHandler(GetDeltaSyncQuery)
export class GetDeltaSyncHandler implements IQueryHandler<GetDeltaSyncQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetDeltaSyncQuery): Promise<SyncResponseDto> {
    const { userId, projectId, since } = query;

    // 1. Validate UUID format
    if (!isValidUuid(projectId)) {
      throw new NotFoundException('Project not found');
    }

    // 2. Validate timestamp format
    if (since !== undefined && isNaN(since.getTime())) {
      throw new BadRequestException('Invalid since timestamp');
    }

    // 3. Verify project access & multi-tenant isolation
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
      include: {
        members: {
          where: { userId, isActive: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isOwner = project.ownerId === userId;
    const isMember = project.members.length > 0;
    if (!isOwner && !isMember) {
      throw new ForbiddenException('Access denied to this project');
    }

    const now = new Date();
    const serverTime = now.toISOString();

    // 4. Skewed future timestamps: Return empty deltas with server checkpoint to correct client clock
    if (since && since.getTime() > now.getTime()) {
      return {
        serverTime,
        tasks: {
          upserted: [],
          deletedIds: [],
        },
        comments: {
          upserted: [],
          deletedIds: [],
        },
        boards: {
          upserted: [],
        },
      };
    }

    // 5. Initial full snapshot if 'since' is missing
    if (!since) {
      const [tasks, boards, comments] = await Promise.all([
        this.prisma.task.findMany({
          where: { projectId, deletedAt: null },
          include: {
            subtasks: { orderBy: { orderIndex: 'asc' } },
            labels: { include: { label: true } },
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            creator: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            _count: {
              select: { comments: { where: { deletedAt: null } } },
            },
          },
          orderBy: { position: 'asc' },
        }),
        this.prisma.board.findMany({
          where: { projectId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.comment.findMany({
          where: { task: { projectId }, deletedAt: null },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            task: {
              select: { projectId: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      return {
        serverTime,
        tasks: {
          upserted: tasks.map(formatTask),
          deletedIds: [],
        },
        comments: {
          upserted: comments.map((c) => formatComment(c, projectId)),
          deletedIds: [],
        },
        boards: {
          upserted: boards.map(formatBoard),
        },
      };
    }

    // 6. Incremental Delta Sync (modified since checkpoint)
    const [
      upsertedTasks,
      deletedTasks,
      upsertedBoards,
      upsertedComments,
      deletedComments,
    ] = await Promise.all([
      // Upserted tasks
      this.prisma.task.findMany({
        where: {
          projectId,
          updatedAt: { gt: since },
          deletedAt: null,
        },
        include: {
          subtasks: { orderBy: { orderIndex: 'asc' } },
          labels: { include: { label: true } },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          creator: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          _count: {
            select: { comments: { where: { deletedAt: null } } },
          },
        },
      }),

      // Deleted tasks
      this.prisma.task.findMany({
        where: {
          projectId,
          deletedAt: { gt: since },
        },
        select: { id: true },
      }),

      // Upserted boards
      this.prisma.board.findMany({
        where: {
          projectId,
          updatedAt: { gt: since },
        },
      }),

      // Upserted comments
      this.prisma.comment.findMany({
        where: {
          task: { projectId },
          deletedAt: null,
          OR: [{ createdAt: { gt: since } }, { editedAt: { gt: since } }],
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          task: {
            select: { projectId: true },
          },
        },
      }),

      // Deleted comments
      this.prisma.comment.findMany({
        where: {
          task: { projectId },
          deletedAt: { gt: since },
        },
        select: { id: true },
      }),
    ]);

    return {
      serverTime,
      tasks: {
        upserted: upsertedTasks.map(formatTask),
        deletedIds: deletedTasks.map((t) => t.id),
      },
      comments: {
        upserted: upsertedComments.map((c) => formatComment(c, projectId)),
        deletedIds: deletedComments.map((c) => c.id),
      },
      boards: {
        upserted: upsertedBoards.map(formatBoard),
      },
    };
  }
}
