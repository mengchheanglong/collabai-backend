// src/modules/notifications/presentation/controllers/push-notifications.controller.ts
//
// REST endpoints for Web Push notification subscription management.

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { SubscribePushDto } from '../../application/dtos/subscribe-push.dto';
import { UnsubscribePushDto } from '../../application/dtos/unsubscribe-push.dto';
import { SubscribePushCommand } from '../../application/commands/subscribe-push.command';
import { UnsubscribePushCommand } from '../../application/commands/unsubscribe-push.command';
import { SendPushNotificationCommand } from '../../application/commands/send-push-notification.command';
import { GetVapidPublicKeyQuery } from '../../application/queries/get-vapid-public-key.query';

@ApiTags('Push Notifications')
@Controller('notifications/push')
export class PushNotificationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('public-key')
  @ApiOperation({
    summary: 'Get VAPID public key for browser PushManager subscription',
  })
  async getPublicKey(): Promise<{ publicKey: string }> {
    return this.queryBus.execute(new GetVapidPublicKeyQuery());
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Register or update browser web push subscription for current user',
  })
  async subscribe(
    @CurrentUser('id') userId: string,
    @Body() dto: SubscribePushDto,
  ): Promise<{ success: boolean }> {
    await this.commandBus.execute(
      new SubscribePushCommand(
        userId,
        dto.endpoint,
        dto.keys.p256dh,
        dto.keys.auth,
        dto.userAgent,
      ),
    );
    return { success: true };
  }

  @Post('unsubscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove browser web push subscription',
  })
  async unsubscribe(
    @CurrentUser('id') userId: string,
    @Body() dto: UnsubscribePushDto,
  ): Promise<{ success: boolean }> {
    await this.commandBus.execute(
      new UnsubscribePushCommand(userId, dto.endpoint),
    );
    return { success: true };
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a test push notification to the current user',
  })
  async testPush(
    @CurrentUser('id') userId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.commandBus.execute(
      new SendPushNotificationCommand(
        userId,
        'CollabAI PWA Test Notification',
        'Web Push is working seamlessly on your device!',
        '/board',
        { test: true, timestamp: Date.now() },
      ),
    );
    return {
      success: true,
      message: 'Test push notification dispatched',
    };
  }
}
