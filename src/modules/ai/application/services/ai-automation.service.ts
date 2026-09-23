import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { WorkspaceChangedEvent } from '../../../../shared/events/workspace-changed.event';
import { ProjectRoles } from '../../../projects/domain/value-objects/project-role.value-object';
import { AI_PROVIDER } from '../../domain/services/ai-provider.interface';
import type { IAiProvider, TaskActionContext, ProposedTaskAction } from '../../domain/services/ai-provider.interface';
import { Inject } from '@nestjs/common';
import { TASK_PRIORITIES } from '../../../tasks/domain/value-objects/task-priority.value-object';
import { TASK_STATUSES } from '../../../tasks/domain/value-objects/task-status.value-object';
import { type ITaskRepository, TASK_REPOSITORY } from '../../../tasks/domain/repositories/task.repository.interface';
import { toTaskResponse } from '../../../tasks/application/dtos/task-response.dto';

export interface StoredAction {
  id: string;
  taskId: string;
  taskTitle: string;
  rationale: string;
  previous: { status: string; priority: string; assigneeId: string | null; dueDate: string | null };
  changes: ProposedTaskAction['changes'];
}

@Injectable()
export class AiAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ai: IAiProvider,
    private readonly events: EventEmitter2,
    @Inject(TASK_REPOSITORY) private readonly taskRepository: ITaskRepository,
  ) {}

  async propose(userId: string, projectId: string, request: string) {
    await this.requireWriter(projectId, userId);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, name: true, description: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const tasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
      take: 100,
      select: { id: true, title: true, status: true, priority: true, dueDate: true, assignedTo: true, assignee: { select: { name: true } } },
    });
    const members = await this.prisma.projectMember.findMany({
      where: { projectId, isActive: true, userId: { not: null } },
      select: { userId: true, role: true, user: { select: { name: true } } },
    });
    const taskCounts = await this.prisma.task.groupBy({
      by: ['assignedTo'],
      where: { projectId, deletedAt: null, status: { not: 'done' }, assignedTo: { not: null } },
      _count: { _all: true },
    });
    const now = new Date();
    const [openTasks, overdueTasks, completedLast14Days] = await Promise.all([
      this.prisma.task.count({ where: { projectId, deletedAt: null, status: { not: 'done' } } }),
      this.prisma.task.count({ where: { projectId, deletedAt: null, status: { not: 'done' }, dueDate: { lt: now } } }),
      this.prisma.task.count({ where: { projectId, deletedAt: null, status: 'done', completedAt: { gte: new Date(now.getTime() - 14 * 86400000) } } }),
    ]);
    const context: TaskActionContext = {
      request: request.trim(),
      projectName: project.name,
      projectDescription: project.description ?? '',
      metrics: { openTasks, overdueTasks, completedLast14Days },
      members: members.flatMap((member) => member.userId && member.user
        ? [{ id: member.userId, name: member.user.name, openTasks: taskCounts.find((row) => row.assignedTo === member.userId)?._count._all ?? 0, overdueTasks: 0 }]
        : []),
      tasks: tasks.map((task) => ({ id: task.id, title: task.title, status: task.status, priority: task.priority, dueDate: task.dueDate?.toISOString() ?? null, assigneeId: task.assignedTo, assigneeName: task.assignee?.name ?? null })),
    };
    // Fill overdue workload while keeping the model context bounded to the listed project members.
    const overdueByMember = await this.prisma.task.groupBy({
      by: ['assignedTo'], where: { projectId, deletedAt: null, status: { not: 'done' }, dueDate: { lt: now }, assignedTo: { not: null } }, _count: { _all: true },
    });
    context.members = context.members.map((member) => ({ ...member, overdueTasks: overdueByMember.find((row) => row.assignedTo === member.id)?._count._all ?? 0 }));

    const result = await this.ai.proposeTaskActions(context);
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const memberIds = new Set(members.flatMap((member) => member.userId ? [member.userId] : []));
    const actions = this.validateProposals(result.actions, taskById, memberIds);
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
    const plan = await this.prisma.aiActionPlan.create({ data: {
      projectId,
      requestedBy: userId,
      request: request.trim(),
      actions: actions as unknown as Prisma.InputJsonValue,
      source: result.source,
      expiresAt,
    } });
    return { id: plan.id, projectId, request: plan.request, actions, source: result.source, status: plan.status, expiresAt: expiresAt.toISOString() };
  }

  async apply(userId: string, planId: string, actionIds: string[]) {
    const existing = await this.prisma.aiActionPlan.findFirst({ where: { id: planId, requestedBy: userId } });
    if (!existing) throw new NotFoundException('AI action plan not found');
    await this.requireWriter(existing.projectId, userId);
    const selectedIds = new Set(actionIds);
    const stored = this.readActions(existing.actions);
    if (!actionIds.length || actionIds.some((id) => !stored.some((action) => action.id === id))) {
      throw new BadRequestException('Select one or more actions from this plan');
    }
    const selected = stored.filter((action) => selectedIds.has(action.id));
    const result = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.aiActionPlan.findFirst({ where: { id: planId, requestedBy: userId, status: 'pending', expiresAt: { gt: new Date() } } });
      if (!plan) throw new ConflictException('This plan has expired or has already been applied');
      const membership = await tx.projectMember.findFirst({ where: { projectId: plan.projectId, userId, isActive: true, project: { deletedAt: null } } });
      if (!membership || !ProjectRoles.isValid(membership.role) || !ProjectRoles.canWriteContent(membership.role)) throw new ForbiddenException('You may not apply task changes in this project');
      const tasks = await tx.task.findMany({ where: { id: { in: selected.map((action) => action.taskId) }, projectId: plan.projectId, deletedAt: null } });
      const byId = new Map(tasks.map((task) => [task.id, task]));
      const normalized = selected.map((action) => {
        const task = byId.get(action.taskId);
        if (!task || task.status !== action.previous.status || task.priority !== action.previous.priority || task.assignedTo !== action.previous.assigneeId || (task.dueDate?.toISOString() ?? null) !== action.previous.dueDate) {
          throw new ConflictException(`Task "${action.taskTitle}" changed after this plan was prepared. Generate a new plan.`);
        }
        return { action, task };
      });
      const now = new Date();
      const updates = [] as Array<{ action: StoredAction; task: (typeof tasks)[number] }>;
      const positions = new Map<string, number>();
      for (const { action, task } of normalized) {
        const changes = action.changes;
        if (changes.assigneeId && !await tx.projectMember.findFirst({ where: { projectId: plan.projectId, userId: changes.assigneeId, isActive: true } })) throw new ConflictException('A proposed assignee is no longer a project member');
        const data: Prisma.TaskUncheckedUpdateInput = {};
        if (changes.priority !== undefined) data.priority = changes.priority;
        if (changes.assigneeId !== undefined) data.assignedTo = changes.assigneeId;
        if (changes.dueDate !== undefined) data.dueDate = changes.dueDate ? new Date(changes.dueDate) : null;
        if (changes.status !== undefined && changes.status !== task.status) {
          data.status = changes.status;
          data.completedAt = changes.status === 'done' ? now : null;
          const key = changes.status;
          let next = positions.get(key);
          if (next === undefined) {
            const max = await tx.task.aggregate({ where: { projectId: plan.projectId, status: key, deletedAt: null }, _max: { position: true } });
            next = max._max.position ?? 0;
          }
          next += 1000;
          positions.set(key, next);
          data.position = next;
        }
        const updated = await tx.task.update({ where: { id: task.id }, data: { ...data, updatedAt: now } });
        updates.push({ action, task: updated });
      }
      const activity = await tx.activity.create({
        data: {
          projectId: plan.projectId,
          userId,
          entityType: 'ai',
          entityId: plan.id,
          action: 'approved_plan_applied',
          oldValue: JSON.stringify(selected.map((action) => ({ taskId: action.taskId, ...action.previous }))),
          newValue: JSON.stringify(selected.map((action) => ({ taskId: action.taskId, ...action.changes }))),
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      await tx.aiActionPlan.update({ where: { id: plan.id }, data: { status: 'applied', appliedAt: now } });
      return { projectId: plan.projectId, updates, activity };
    });

    for (const { action } of result.updates) {
      const view = await this.taskRepository.findViewById(action.taskId);
      if (view) this.events.emit(WorkspaceChangedEvent.eventName, new WorkspaceChangedEvent('task:updated', result.projectId, userId, { task: toTaskResponse(view), auditRecorded: true }));
    }
    const activity = result.activity;
    this.events.emit(WorkspaceChangedEvent.eventName, new WorkspaceChangedEvent('activity:created', result.projectId, userId, {
      auditRecorded: true,
      activity: { _id: activity.id, projectId: activity.projectId, actorId: activity.userId, actor: { _id: activity.user.id, name: activity.user.name, email: activity.user.email }, type: 'ai.approved_plan_applied', entityType: 'ai', entityId: planId, message: `${activity.user.name} approved and applied an AI task plan`, details: { previous: JSON.parse(activity.oldValue ?? '[]'), applied: JSON.parse(activity.newValue ?? '[]') }, createdAt: activity.createdAt.toISOString() },
    }));
    return { planId, status: 'applied', appliedActionIds: selected.map((action) => action.id), appliedAt: new Date().toISOString() };
  }

  private async requireWriter(projectId: string, userId: string): Promise<void> {
    const member = await this.prisma.projectMember.findFirst({ where: { projectId, userId, isActive: true, project: { deletedAt: null } } });
    if (!member) throw new NotFoundException('Project not found');
    if (!ProjectRoles.isValid(member.role) || !ProjectRoles.canWriteContent(member.role)) throw new ForbiddenException('Only project writers can propose or apply AI actions');
  }

  private validateProposals(proposals: ProposedTaskAction[], tasks: Map<string, { id: string; title: string; status: string; priority: string; dueDate: Date | null; assignedTo: string | null }>, memberIds: Set<string>): StoredAction[] {
    const result: StoredAction[] = [];
    for (const proposal of proposals.slice(0, 5)) {
      const task = tasks.get(proposal.taskId);
      if (!task || result.some((item) => item.taskId === task.id) || !proposal.rationale?.trim()) continue;
      const changes = proposal.changes as Record<string, unknown>;
      const keys = Object.keys(changes);
      if (!keys.length || keys.some((key) => !['status', 'priority', 'assigneeId', 'dueDate'].includes(key))) continue;
      if (changes.status !== undefined && (typeof changes.status !== 'string' || !(TASK_STATUSES as readonly string[]).includes(changes.status))) continue;
      if (changes.priority !== undefined && (typeof changes.priority !== 'string' || !(TASK_PRIORITIES as readonly string[]).includes(changes.priority))) continue;
      if (changes.assigneeId !== undefined && changes.assigneeId !== null && (typeof changes.assigneeId !== 'string' || !memberIds.has(changes.assigneeId))) continue;
      if (changes.dueDate !== undefined && changes.dueDate !== null && (typeof changes.dueDate !== 'string' || Number.isNaN(Date.parse(changes.dueDate)))) continue;
      if (keys.every((key) => changes[key] === (key === 'assigneeId' ? task.assignedTo : key === 'dueDate' ? task.dueDate?.toISOString() ?? null : (task as unknown as Record<string, unknown>)[key]))) continue;
      result.push({
        id: randomUUID(), taskId: task.id, taskTitle: task.title,
        rationale: proposal.rationale.trim().slice(0, 500),
        previous: { status: task.status, priority: task.priority, assigneeId: task.assignedTo, dueDate: task.dueDate?.toISOString() ?? null },
        changes: {
          ...(typeof changes.status === 'string' ? { status: changes.status } : {}),
          ...(typeof changes.priority === 'string' ? { priority: changes.priority } : {}),
          ...(changes.assigneeId === null || typeof changes.assigneeId === 'string' ? { assigneeId: changes.assigneeId } : {}),
          ...(changes.dueDate === null || typeof changes.dueDate === 'string' ? { dueDate: changes.dueDate } : {}),
        },
      });
    }
    return result;
  }

  private readActions(value: Prisma.JsonValue): StoredAction[] {
    if (!Array.isArray(value)) throw new ConflictException('This plan has invalid action data');
    return value as unknown as StoredAction[];
  }
}
