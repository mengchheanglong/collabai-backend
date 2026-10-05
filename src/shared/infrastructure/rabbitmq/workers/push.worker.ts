// src/shared/infrastructure/rabbitmq/workers/push.worker.ts
//
// Consumes `collabai.notifications.push` (push.broadcast) and fans the notification out to
// every PushSubscription of the user via SendPushNotificationCommand (Web Push VAPID;
// 404/410 endpoints are pruned by WebPushService). Registered by NotificationsModule.

import { Injectable, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { RabbitMQService } from '../rabbitmq.service';
import { QUEUE } from '../rabbitmq.constants';
import { SendPushNotificationCommand } from '../../../../modules/notifications/application/commands/send-push-notification.command';

export interface PushBroadcastJob {
  userId: string;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, any>;
}

@Injectable()
export class PushWorker implements OnModuleInit {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly commandBus: CommandBus,
  ) {}

  onModuleInit(): void {
    this.rabbitmq.consume(QUEUE.PUSH, (payload) =>
      this.handle(payload as PushBroadcastJob),
    );
  }

  async handle(job: PushBroadcastJob): Promise<void> {
    await this.commandBus.execute(
      new SendPushNotificationCommand(
        job.userId,
        job.title,
        job.body,
        job.url,
        job.data,
      ),
    );
  }
}
