// src/modules/projects/application/queries/get-project-analytics-burndown.handler.ts
//
// Builds a burndown chart array: for each day in the specified window,
// total remaining tasks (not done) and cumulative completed tasks.

import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { GetProjectAnalyticsBurndownQuery } from './get-project-analytics-burndown.query';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import {
  NotProjectMemberError,
  ProjectNotFoundError,
} from '../errors/project.errors';

export interface BurndownPoint {
  date: string;
  remainingTasks: number;
  completedTasks: number;
}

@QueryHandler(GetProjectAnalyticsBurndownQuery)
export class GetProjectAnalyticsBurndownHandler implements IQueryHandler<GetProjectAnalyticsBurndownQuery> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    query: GetProjectAnalyticsBurndownQuery,
  ): Promise<BurndownPoint[]> {
    const membership = await this.repo.findMembership(
      query.projectId,
      query.userId,
    );
    if (!membership) {
      const exists = await this.repo.findById(query.projectId);
      if (!exists) throw new ProjectNotFoundError();
      throw new NotProjectMemberError();
    }

    const days = Math.min(query.days, 60);
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    // Fetch all relevant tasks: created before the end of the window (not deleted)
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId: query.projectId,
        deletedAt: null,
        createdAt: { lte: now },
      },
      select: {
        status: true,
        completedAt: true,
        createdAt: true,
      },
    });

    const result: BurndownPoint[] = [];

    for (let i = 0; i < days; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      const dateStr = day.toISOString().split('T')[0];

      // Tasks that existed by end of this day
      const tasksOnDay = tasks.filter((t) => t.createdAt <= dayEnd);

      // Tasks completed by end of this day
      const completed = tasksOnDay.filter(
        (t) =>
          t.status === 'done' &&
          t.completedAt != null &&
          t.completedAt <= dayEnd,
      );
      const completedTasks = completed.length;
      const remainingTasks = tasksOnDay.length - completedTasks;

      result.push({ date: dateStr, remainingTasks, completedTasks });
    }

    return result;
  }
}
