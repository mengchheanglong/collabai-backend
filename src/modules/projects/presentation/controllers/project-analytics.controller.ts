// src/modules/projects/presentation/controllers/project-analytics.controller.ts
//
// Analytics endpoints for the project. Uses CQRS queries with Prisma aggregations
// for the dashboard summary and burndown chart data.

import { Controller, Get, Param, Query, UseGuards, UseFilters } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { ProjectExceptionFilter } from '../exception-filters/project-exception.filter';
import { GetProjectAnalyticsSummaryQuery } from '../../application/queries/get-project-analytics-summary.query';
import { GetProjectAnalyticsBurndownQuery } from '../../application/queries/get-project-analytics-burndown.query';
import type { ProjectAnalyticsSummary } from '../../application/queries/get-project-analytics-summary.handler';
import type { BurndownPoint } from '../../application/queries/get-project-analytics-burndown.handler';

@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@Controller('projects/:projectId/analytics')
@UseGuards(JwtAuthGuard)
@UseFilters(ProjectExceptionFilter)
export class ProjectAnalyticsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get project task analytics summary' })
  async getSummary(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
  ): Promise<ProjectAnalyticsSummary> {
    return this.queryBus.execute(new GetProjectAnalyticsSummaryQuery(userId, projectId));
  }

  @Get('burndown')
  @ApiOperation({ summary: 'Get project burndown chart data' })
  async getBurndown(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Query('days') days?: string,
  ): Promise<BurndownPoint[]> {
    const daysNum = Math.min(Math.max(parseInt(days ?? '14', 10) || 14, 1), 60);
    return this.queryBus.execute(
      new GetProjectAnalyticsBurndownQuery(userId, projectId, daysNum),
    );
  }
}
