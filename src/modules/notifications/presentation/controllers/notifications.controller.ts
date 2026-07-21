// src/modules/notifications/presentation/controllers/notifications.controller.ts
//
// REST surface for the current user's notifications. All routes require a valid access
// token; a user only ever sees/mutates their own notifications (enforced in handlers).

import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { NotificationExceptionFilter } from '../exception-filters/notification-exception.filter';

import { GetUserNotificationsQuery } from '../../application/queries/get-user-notifications.query';
import { MarkAsReadCommand } from '../../application/commands/mark-as-read.command';
import { MarkAllReadCommand } from '../../application/commands/mark-all-read.command';
import { toNotificationResponse } from '../../application/dtos/notification-response.dto';
import {
  Paginated,
} from '../../domain/repositories/notification.repository.interface';
import { NotificationEntity } from '../../domain/entities/notification.entity';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@UseFilters(NotificationExceptionFilter)
export class NotificationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: "List the current user's notifications (newest first)" })
  async list(
    @CurrentUser('id') userId: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = (await this.queryBus.execute(
      new GetUserNotificationsQuery(
        userId,
        unreadOnly === 'true',
        toInt(page, 1),
        toInt(limit, 20),
      ),
    )) as Paginated<NotificationEntity>;

    return {
      items: result.items.map(toNotificationResponse),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
      },
    };
  }

  // Static route registered before the parameterised one.
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentUser('id') userId: string) {
    return this.commandBus.execute(new MarkAllReadCommand(userId));
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  async markRead(
    @CurrentUser('id') userId: string,
    @Param('notificationId') notificationId: string,
  ) {
    await this.commandBus.execute(
      new MarkAsReadCommand(userId, notificationId),
    );
    return { read: true };
  }
}

function toInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
