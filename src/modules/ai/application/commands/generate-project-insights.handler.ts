// src/modules/ai/application/commands/generate-project-insights.handler.ts

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GenerateProjectInsightsCommand } from './generate-project-insights.command';
import {
  AI_PROVIDER,
  type IAiProvider,
  ProjectInsightsInput,
  ProjectInsightsOutput,
} from '../../domain/services/ai-provider.interface';
import { AiAccessService } from '../services/ai-access.service';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { ProjectNotFoundError } from '../../../projects/application/errors/project.errors';

@CommandHandler(GenerateProjectInsightsCommand)
export class GenerateProjectInsightsHandler
  implements ICommandHandler<GenerateProjectInsightsCommand>
{
  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: IAiProvider,
    private readonly access: AiAccessService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    command: GenerateProjectInsightsCommand,
  ): Promise<any> {
    await this.access.requireMember(command.projectId, command.userId);

    const project = await this.prisma.project.findUnique({
      where: { id: command.projectId },
      select: { id: true, name: true, description: true },
    });
    if (!project) throw new ProjectNotFoundError();

    const tasks = await this.prisma.task.findMany({
      where: {
        projectId: command.projectId,
        deletedAt: null,
      },
      include: {
        assignee: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const totalTasks = tasks.length;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let todoTasks = 0;

    const overdueTasks: ProjectInsightsInput['overdueTasks'] = [];
    const upcomingTasks: ProjectInsightsInput['upcomingTasks'] = [];
    const workloadMap = new Map<string, { name: string; taskCount: number; overdueCount: number }>();

    for (const t of tasks) {
      if (t.status === 'done') {
        completedTasks++;
      } else if (t.status === 'in_progress') {
        inProgressTasks++;
      } else {
        todoTasks++;
      }

      const isOverdue = t.dueDate && new Date(t.dueDate) < now && t.status !== 'done';
      const isUpcoming = t.dueDate && new Date(t.dueDate) >= now && t.status !== 'done';

      const assigneeName = t.assignee?.name || 'Unassigned';

      if (isOverdue) {
        overdueTasks.push({
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.toISOString() : undefined,
          assignee: assigneeName,
        });
      }

      if (isUpcoming) {
        upcomingTasks.push({
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.toISOString() : undefined,
          assignee: assigneeName,
        });
      }

      if (t.status !== 'done') {
        const current = workloadMap.get(assigneeName) ?? {
          name: assigneeName,
          taskCount: 0,
          overdueCount: 0,
        };
        current.taskCount++;
        if (isOverdue) current.overdueCount++;
        workloadMap.set(assigneeName, current);
      }
    }

    // Sort overdue by priority/due date
    overdueTasks.sort((a, b) => (b.priority === 'urgent' ? 1 : -1));
    upcomingTasks.sort((a, b) => ((a.dueDate || '') > (b.dueDate || '') ? 1 : -1));

    const input: ProjectInsightsInput = {
      projectName: project.name,
      projectDescription: project.description ?? undefined,
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      overdueTasks: overdueTasks.slice(0, 10),
      upcomingTasks: upcomingTasks.slice(0, 10),
      assigneeWorkload: Array.from(workloadMap.values()).slice(0, 10),
    };

    const insights = await this.aiProvider.generateProjectInsights(input);
    return {
      projectId: command.projectId,
      projectName: project.name,
      generatedAt: now.toISOString(),
      source: 'ai' as const,
      healthScore: insights.healthScore,
      status: insights.status,
      summary: insights.summary,
      risks: insights.risks,
      nextBestActions: insights.nextBestActions,
      recommendations: insights.nextBestActions.map((nba, idx) => ({
        title: nba.title,
        rationale: nba.description,
        urgency: (nba.priority === 'urgent' ? 'high' : nba.priority === 'low' ? 'low' : 'medium') as 'high' | 'medium' | 'low',
        action: (nba.impact.toLowerCase().includes('workload')
          ? 'balance_workload'
          : nba.impact.toLowerCase().includes('review')
            ? 'review_task'
            : 'plan') as 'review_task' | 'balance_workload' | 'plan',
        taskIds: overdueTasks.length > 0 && idx === 0 ? [tasks[0]?.id].filter(Boolean) : [],
      })),
      insights,
    };
  }
}
