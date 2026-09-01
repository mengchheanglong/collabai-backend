// src/modules/notifications/application/commands/send-push-notification.handler.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SendPushNotificationCommand } from './send-push-notification.command';
import type { IPushSubscriptionRepository } from '../../domain/repositories/push-subscription.repository.interface';
import { PUSH_SUBSCRIPTION_REPOSITORY } from '../../domain/repositories/push-subscription.repository.interface';
import { WebPushService } from '../../infrastructure/push/web-push.service';

@Injectable()
@CommandHandler(SendPushNotificationCommand)
export class SendPushNotificationHandler
  implements ICommandHandler<SendPushNotificationCommand>
{
  private readonly logger = new Logger(SendPushNotificationHandler.name);

  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly repo: IPushSubscriptionRepository,
    private readonly webPush: WebPushService,
  ) {}

  async execute(command: SendPushNotificationCommand): Promise<void> {
    try {
      if (!command || !command.userId) {
        this.logger.warn('SendPushNotificationCommand missing userId. Skipping.');
        return;
      }

      const subscriptions = await this.repo.findByUserId(command.userId);
      if (!subscriptions || subscriptions.length === 0) {
        return;
      }

      const payload = {
        title: command.title || 'CollabAI Notification',
        body: command.body || '',
        data: {
          url: command.url || '/board',
          ...command.data,
        },
      };

      const results = await Promise.allSettled(
        subscriptions.map((sub) => this.webPush.sendNotification(sub, payload)),
      );

      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value === true,
      ).length;

      this.logger.debug(
        `Dispatched push notifications for user ${command.userId}: ${successful}/${subscriptions.length} delivered`,
      );
    } catch (err) {
      this.logger.error(
        `Unexpected error in SendPushNotificationHandler for user ${command?.userId}: ${(err as Error).message}`,
      );
    }
  }
}
