// src/modules/projects/application/queries/get-project-analytics-summary.handler.ts
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { GetProjectAnalyticsSummaryQuery } from './get-project-analytics-summary.query';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import { NotProjectMemberError, ProjectNotFoundError } from '../errors/project.errors';

export interface ProjectAnalyticsSummary {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  overdueTasks: number;
  completionRate: number;
  tasksByUser: Array<{
    userId: string;
    name: string;
    total: number;
    done: number;
  }>;
  tasksByPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
}

@QueryHandler(GetProjectAnalyticsSummaryQuery)
export class GetProjectAnalyticsSummaryHandler
  implements IQueryHandler<GetProjectAnalyticsSummaryQuery>
{
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetProjectAnalyticsSummaryQuery): Promise<ProjectAnalyticsSummary> {
    const membership = await this.repo.findMembership(query.projectId, query.userId);
    if (!membership) {
      const exists = await this.repo.findById(query.projectId);
      if (!exists) throw new ProjectNotFoundError();
      throw new NotProjectMemberError();
    }

    const { projectId } = query;

    const [totalTasks, completedTasks, inProgressTasks, todoTasks, overdueTasks] = await Promise.all([
      this.prisma.task.count({ where: { projectId, deletedAt: null } }),
      this.prisma.task.count({ where: { projectId, status: 'done', deletedAt: null } }),
      this.prisma.task.count({ where: { projectId, status: 'in_progress', deletedAt: null } }),
      this.prisma.task.count({ where: { projectId, status: 'todo', deletedAt: null } }),
      this.prisma.task.count({ where: { projectId, status: { not: 'done' }, dueDate: { lt: new Date() }, deletedAt: null } }),
    ]);

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const [low, medium, high, urgent] = await Promise.all([
      this.prisma.task.count({ where: { projectId, priority: 'low', deletedAt: null } }),
      this.prisma.task.count({ where: { projectId, priority: 'medium', deletedAt: null } }),
      this.prisma.task.count({ where: { projectId, priority: 'high', deletedAt: null } }),
      this.prisma.task.count({ where: { projectId, priority: 'urgent', deletedAt: null } }),
    ]);

    // Tasks by user
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true }
    });
    const users = members.map(m => m.user);

    const tasksByUser = await Promise.all(
      users.map(async (user) => {
        const [total, done] = await Promise.all([
          this.prisma.task.count({ where: { projectId, assignedTo: user.id, deletedAt: null } }),
          this.prisma.task.count({ where: { projectId, assignedTo: user.id, status: 'done', deletedAt: null } }),
        ]);
        return {
          userId: user.id,
          name: user.name,
          total,
          done,
        };
      })
    );

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      overdueTasks,
      completionRate,
      tasksByUser,
      tasksByPriority: { low, medium, high, urgent },
    };
  }
}
