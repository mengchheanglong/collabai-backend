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

import { NOTIFICATION_REPOSITORY } from './domain/repositories/notification.repository.interface';
import { NotificationRepository } from './infrastructure/persistence/notification.repository';
import { NotificationDomainService } from './domain/services/notification.domain.service';
import { NotificationEventsListener } from './infrastructure/event-handlers/notification-events.listener';

import { CreateNotificationHandler } from './application/commands/create-notification.handler';
import { MarkAsReadHandler } from './application/commands/mark-as-read.handler';
import { MarkAllReadHandler } from './application/commands/mark-all-read.handler';
import { GetUserNotificationsHandler } from './application/queries/get-user-notifications.handler';

const CommandHandlers = [
  CreateNotificationHandler,
  MarkAsReadHandler,
  MarkAllReadHandler,
];

const QueryHandlers = [GetUserNotificationsHandler];

@Module({
  imports: [CqrsModule, SharedModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationRepository },
    NotificationDomainService,
    NotificationEventsListener,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [NOTIFICATION_REPOSITORY],
})
export class NotificationsModule {}
