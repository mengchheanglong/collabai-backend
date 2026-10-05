// src/shared/infrastructure/rabbitmq/rabbitmq.module.ts
//
// Provides the background job bus:
//   - RabbitMQService  (connection, topology, publish, consume, in-process fallback)
//   - EVENT_BUS token  (alias of RabbitMQService for the IEventBus interface)
//
// Publishers inject EVENT_BUS. Workers live next to this module (./workers) but are
// registered by the module that owns their dependencies:
//   EmailWorker → SharedModule, PushWorker → NotificationsModule,
//   ActivityLogWorker → ActivityModule, AiJobsWorker → AiModule.

import { Module } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { EVENT_BUS } from '../../event-bus/event-bus.interface';

@Module({
  providers: [
    RabbitMQService,
    { provide: EVENT_BUS, useExisting: RabbitMQService },
  ],
  exports: [RabbitMQService, EVENT_BUS],
})
export class RabbitMQModule {}
