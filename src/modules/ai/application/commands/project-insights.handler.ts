import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { AI_PROVIDER } from '../../domain/services/ai-provider.interface';
import type { IAiProvider, ProjectRecommendation } from '../../domain/services/ai-provider.interface';
import { AiAccessService } from '../services/ai-access.service';
import { ProjectInsightsCommand } from './project-insights.command';

@CommandHandler(ProjectInsightsCommand)
export class ProjectInsightsHandler implements ICommandHandler<ProjectInsightsCommand> {
  constructor(
    @Inject(AI_PROVIDER) private readonly ai: IAiProvider,
    private readonly access: AiAccessService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: ProjectInsightsCommand) {
    await this.access.requireMember(command.projectId, command.userId);
    const project = await this.prisma.project.findFirst({
      where: { id: command.projectId, deletedAt: null },
      select: { name: true, description: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
    const twentyEightDaysAgo = new Date(now.getTime() - 28 * 86400000);
    const [tasks, members, totalOpen, overdue, completedLast14Days, completedPrevious14Days, openByUser, overdueByUser] = await Promise.all([
      this.prisma.task.findMany({
        where: { projectId: command.projectId, deletedAt: null },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        take: 60,
        select: {
          id: true, title: true, status: true, priority: true, dueDate: true, assignedTo: true,
          assignee: { select: { name: true } },
          subtasks: { where: { completed: false }, select: { id: true } },
        },
      }),
      this.prisma.projectMember.findMany({
        where: { projectId: command.projectId, isActive: true, userId: { not: null } },
        orderBy: { joinedAt: 'asc' },
        take: 50,
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.task.count({ where: { projectId: command.projectId, deletedAt: null, status: { not: 'done' } } }),
      this.prisma.task.count({ where: { projectId: command.projectId, deletedAt: null, status: { not: 'done' }, dueDate: { lt: now } } }),
      this.prisma.task.count({ where: { projectId: command.projectId, deletedAt: null, status: 'done', completedAt: { gte: fourteenDaysAgo } } }),
      this.prisma.task.count({ where: { projectId: command.projectId, deletedAt: null, status: 'done', completedAt: { gte: twentyEightDaysAgo, lt: fourteenDaysAgo } } }),
      this.prisma.task.groupBy({ by: ['assignedTo'], where: { projectId: command.projectId, deletedAt: null, status: { not: 'done' }, assignedTo: { not: null } }, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['assignedTo'], where: { projectId: command.projectId, deletedAt: null, status: { not: 'done' }, dueDate: { lt: now }, assignedTo: { not: null } }, _count: { _all: true } }),
    ]);

    const workload = members.flatMap((member) => member.user ? [{
      member: member.user.name,
      openTasks: openByUser.find((row) => row.assignedTo === member.userId)?._count._all ?? 0,
      overdueTasks: overdueByUser.find((row) => row.assignedTo === member.userId)?._count._all ?? 0,
    }] : []);
    const result = await this.ai.recommendProjectActions({
      projectName: project.name,
      description: project.description ?? '',
      metrics: { totalOpen, overdue, completedLast14Days, completedPrevious14Days },
      workload,
      tasks: tasks.map((task) => ({
        id: task.id, title: task.title, status: task.status, priority: task.priority,
        dueDate: task.dueDate?.toISOString() ?? null,
        assignee: task.assignee?.name ?? null,
        openSubtasks: task.subtasks.length,
      })),
    });
    const allowedTaskIds = new Set(tasks.map((task) => task.id));
    const safeRecommendations = result.recommendations.slice(0, 5).map((item: ProjectRecommendation) => ({
      ...item,
      title: item.title.slice(0, 120),
      rationale: item.rationale.slice(0, 500),
      taskIds: item.taskIds.filter((id) => allowedTaskIds.has(id)).slice(0, 8),
    }));
    return { projectId: command.projectId, projectName: project.name, recommendations: safeRecommendations, generatedAt: now.toISOString(), source: result.source };
  }
}
