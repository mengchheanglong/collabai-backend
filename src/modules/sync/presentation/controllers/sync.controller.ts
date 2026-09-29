// src/modules/sync/presentation/controllers/sync.controller.ts
//
// Delta Sync Controller for PWA offline-first synchronization.

import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { SyncQueryDto } from '../../application/dtos/sync-query.dto';
import { SyncResponseDto } from '../../application/dtos/sync-response.dto';
import { GetDeltaSyncQuery } from '../../application/queries/get-delta-sync.query';

@ApiTags('Sync')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    summary:
      'Get incremental delta sync for a project since last snapshot checkpoint',
  })
  async getSyncDelta(
    @CurrentUser('id') userId: string,
    @Query() query: SyncQueryDto,
  ): Promise<SyncResponseDto> {
    let sinceDate: Date | undefined;
    if (query.since) {
      sinceDate = new Date(query.since);
      if (isNaN(sinceDate.getTime())) {
        throw new BadRequestException('Invalid since timestamp format');
      }
    }
    return this.queryBus.execute(
      new GetDeltaSyncQuery(userId, query.projectId, sinceDate),
    );
  }
}
