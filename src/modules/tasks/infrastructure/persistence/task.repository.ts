// src/modules/tasks/infrastructure/persistence/task.repository.ts
//
// Prisma implementation of ITaskRepository. Handles the task row, its subtasks, and its
// label links (upserting per-project Label rows). Maps DB columns `assignedTo`/`createdBy`
// to domain `assigneeId`/`createdById`.

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { TaskEntity } from '../../domain/entities/task.entity';
import { SubtaskEntity } from '../../domain/entities/subtask.entity';
import {
  ITaskRepository,
  Paginated,
  TaskFilters,
  TaskView,
} from '../../domain/repositories/task.repository.interface';
import {
  TaskStatus,
  TaskStatuses,
} from '../../domain/value-objects/task-status.value-object';
import {
  TaskPriority,
  TaskPriorities,
} from '../../domain/value-objects/task-priority.value-object';

type TaskRow = Prisma.TaskGetPayload<{
  include: {
    subtasks: true;
    labels: { include: { label: true } };
    _count: { select: { comments: true } };
  };
}>;

const taskInclude = {
  subtasks: { orderBy: { orderIndex: 'asc' as const } },
  labels: { include: { label: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TaskRepository implements ITaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(task: TaskEntity): Promise<void> {
    await this.prisma.task.create({ data: this.toCreateData(task) });
  }

  async findById(id: string): Promise<TaskEntity | null> {
    const row = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async findViewById(id: string): Promise<TaskView | null> {
    const row = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: taskInclude,
    });
    return row ? this.toView(row) : null;
  }

  async update(task: TaskEntity): Promise<void> {
    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        position: task.position,
        assignedTo: task.assigneeId,
        dueDate: task.dueDate,
        completedAt: task.completedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.task.delete({ where: { id } });
  }

  async list(
    projectId: string,
    filters: TaskFilters,
  ): Promise<Paginated<TaskView>> {
    const where: Prisma.TaskWhereInput = {
      projectId,
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.assigneeId ? { assignedTo: filters.assigneeId } : {}),
      ...(filters.q
        ? { title: { contains: filters.q, mode: 'insensitive' } }
        : {}),
      ...(filters.dueBefore ? { dueDate: { lte: filters.dueBefore } } : {}),
      ...(filters.label
        ? { labels: { some: { label: { name: filters.label } } } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [{ status: 'asc' }, { position: 'asc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toView(r)),
      total,
      page: filters.page,
      limit: filters.limit,
    };
  }

  async maxPosition(projectId: string, status: TaskStatus): Promise<number> {
    const result = await this.prisma.task.aggregate({
      where: { projectId, status, deletedAt: null },
      _max: { position: true },
    });
    return result._max.position ?? 0;
  }

  async setLabels(
    taskId: string,
    projectId: string,
    createdById: string,
    labelNames: string[],
  ): Promise<void> {
    const names = Array.from(
      new Set(labelNames.map((n) => n.trim()).filter((n) => n.length > 0)),
    );

    await this.prisma.$transaction(async (tx) => {
      const labelIds: string[] = [];
      for (const name of names) {
        const label = await tx.label.upsert({
          where: { projectId_name: { projectId, name } },
          create: { id: uuidv4(), projectId, name, createdBy: createdById },
          update: {},
          select: { id: true },
        });
        labelIds.push(label.id);
      }

      await tx.taskLabel.deleteMany({ where: { taskId } });
      if (labelIds.length > 0) {
        await tx.taskLabel.createMany({
          data: labelIds.map((labelId) => ({
            id: uuidv4(),
            taskId,
            labelId,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  // ----- subtasks -----

  async addSubtask(subtask: SubtaskEntity): Promise<void> {
    await this.prisma.subtask.create({
      data: {
        id: subtask.id,
        taskId: subtask.taskId,
        title: subtask.title,
        completed: subtask.done,
        completedAt: subtask.completedAt,
        orderIndex: subtask.orderIndex,
      },
    });
  }

  async findSubtask(subtaskId: string): Promise<SubtaskEntity | null> {
    const row = await this.prisma.subtask.findUnique({
      where: { id: subtaskId },
    });
    if (!row) return null;
    return SubtaskEntity.fromPersistence({
      id: row.id,
      taskId: row.taskId,
      title: row.title,
      done: row.completed,
      completedAt: row.completedAt,
      orderIndex: row.orderIndex,
    });
  }

  async updateSubtask(subtask: SubtaskEntity): Promise<void> {
    await this.prisma.subtask.update({
      where: { id: subtask.id },
      data: {
        title: subtask.title,
        completed: subtask.done,
        completedAt: subtask.completedAt,
      },
    });
  }

  async deleteSubtask(subtaskId: string): Promise<void> {
    await this.prisma.subtask.delete({ where: { id: subtaskId } });
  }

  async maxSubtaskOrder(taskId: string): Promise<number> {
    const result = await this.prisma.subtask.aggregate({
      where: { taskId },
      _max: { orderIndex: true },
    });
    return result._max.orderIndex ?? -1;
  }

  // ----- mappers -----

  private toCreateData(task: TaskEntity): Prisma.TaskUncheckedCreateInput {
    return {
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      position: task.position,
      assignedTo: task.assigneeId,
      createdBy: task.createdById,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
    };
  }

  private toDomain(row: {
    id: string;
    projectId: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    position: number;
    assignedTo: string | null;
    createdBy: string;
    dueDate: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): TaskEntity {
    return TaskEntity.fromPersistence({
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      description: row.description,
      status: this.asStatus(row.status),
      priority: this.asPriority(row.priority),
      position: row.position,
      assigneeId: row.assignedTo,
      createdById: row.createdBy,
      dueDate: row.dueDate,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  private toView(row: TaskRow): TaskView {
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      description: row.description,
      status: this.asStatus(row.status),
      priority: this.asPriority(row.priority),
      position: row.position,
      assigneeId: row.assignedTo,
      createdById: row.createdBy,
      dueDate: row.dueDate,
      completedAt: row.completedAt,
      labels: row.labels.map((l) => l.label.name),
      subtasks: row.subtasks.map((s) => ({
        id: s.id,
        title: s.title,
        done: s.completed,
        orderIndex: s.orderIndex,
      })),
      commentCount: row._count.comments,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private asStatus(value: string): TaskStatus {
    return TaskStatuses.isValid(value) ? value : 'todo';
  }

  private asPriority(value: string): TaskPriority {
    return TaskPriorities.isValid(value) ? value : 'medium';
  }
}
