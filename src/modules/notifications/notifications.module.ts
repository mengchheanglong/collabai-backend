// src/modules/notifications/notifications.module.ts
//
// Wires the notifications module. Binds the repository port, registers the pure
// NotificationDomainService, the event listener that consumes task/comment domain events,
// and the CQRS handlers. Imports SharedModule (Prisma) + AuthModule (JwtAuthGuard).

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './presentation/controllers/notifications.controller';
import { PushNotificationsController } from './presentation/controllers/push-notifications.controller';

import { NOTIFICATION_REPOSITORY } from './domain/repositories/notification.repository.interface';
import { NotificationRepository } from './infrastructure/persistence/notification.repository';
import { PUSH_SUBSCRIPTION_REPOSITORY } from './domain/repositories/push-subscription.repository.interface';
import { PushSubscriptionRepository } from './infrastructure/persistence/push-subscription.repository';
import { NotificationDomainService } from './domain/services/notification.domain.service';
import { NotificationEventsListener } from './infrastructure/event-handlers/notification-events.listener';
import { WebPushService } from './infrastructure/push/web-push.service';

import { CreateNotificationHandler } from './application/commands/create-notification.handler';
import { MarkAsReadHandler } from './application/commands/mark-as-read.handler';
import { MarkAllReadHandler } from './application/commands/mark-all-read.handler';
import { SubscribePushHandler } from './application/commands/subscribe-push.handler';
import { UnsubscribePushHandler } from './application/commands/unsubscribe-push.handler';
import { SendPushNotificationHandler } from './application/commands/send-push-notification.handler';

import { GetUserNotificationsHandler } from './application/queries/get-user-notifications.handler';
import { GetVapidPublicKeyHandler } from './application/queries/get-vapid-public-key.handler';

const CommandHandlers = [
  CreateNotificationHandler,
  MarkAsReadHandler,
  MarkAllReadHandler,
  SubscribePushHandler,
  UnsubscribePushHandler,
  SendPushNotificationHandler,
];

const QueryHandlers = [
  GetUserNotificationsHandler,
  GetVapidPublicKeyHandler,
];

@Module({
  imports: [CqrsModule, SharedModule, AuthModule],
  controllers: [NotificationsController, PushNotificationsController],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationRepository },
    {
      provide: PUSH_SUBSCRIPTION_REPOSITORY,
      useClass: PushSubscriptionRepository,
    },
    NotificationDomainService,
    NotificationEventsListener,
    WebPushService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [
    NOTIFICATION_REPOSITORY,
    PUSH_SUBSCRIPTION_REPOSITORY,
    WebPushService,
  ],
})
export class NotificationsModule {}
