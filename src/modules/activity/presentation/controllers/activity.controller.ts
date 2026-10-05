// src/modules/activity/presentation/controllers/activity.controller.ts
//
// GET /projects/:projectId/activity — API-CONTRACT.md §9. Rows are written asynchronously
// by ActivityLogWorker from the `collabai.activity` queue.

import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { parsePaginationParams } from '../../../../common/utils/pagination.util';
import { ListProjectActivityQuery } from '../../application/queries/list-project-activity.query';
import { ActivityPage } from '../../application/queries/list-project-activity.handler';

@ApiTags('Activity')
@ApiBearerAuth('access-token')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':projectId/activity')
  @ApiOperation({ summary: 'List recent project activity (newest first)' })
  async list(
    @CurrentUser('id') userId: string,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { page: parsedPage, limit: parsedLimit } = parsePaginationParams(
      page,
      limit,
      30,
    );
    const result: ActivityPage = await this.queryBus.execute(
      new ListProjectActivityQuery(userId, projectId, parsedPage, parsedLimit),
    );

    return {
      items: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
      },
    };
  }
}
