// src/modules/activity/application/queries/list-project-activity.handler.ts
//
// Newest-first page of a project's activity feed. Caller must be an active project member.

import { ForbiddenException, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../shared/services/prisma.service';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../../projects/domain/repositories/project.repository.interface';
import { ListProjectActivityQuery } from './list-project-activity.query';
import {
  ACTIVITY_INCLUDE,
  ActivityResponse,
  toActivityResponse,
} from '../dtos/activity-response.dto';

export interface ActivityPage {
  items: ActivityResponse[];
  total: number;
  page: number;
  limit: number;
}

@QueryHandler(ListProjectActivityQuery)
export class ListProjectActivityHandler implements IQueryHandler<ListProjectActivityQuery> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: ListProjectActivityQuery): Promise<ActivityPage> {
    const membership = await this.projects.findMembership(
      query.projectId,
      query.userId,
    );
    if (!membership || !membership.isActive) {
      throw new ForbiddenException('You are not a member of this project');
    }

    const where = { projectId: query.projectId };
    const [rows, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        include: ACTIVITY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      items: rows.map(toActivityResponse),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
