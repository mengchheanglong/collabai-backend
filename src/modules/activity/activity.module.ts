// src/modules/activity/activity.module.ts
//
// Project activity feed (plan Phase 6 / API-CONTRACT.md §9):
//   domain events → ActivityEventsListener → `collabai.activity` queue
//   → ActivityLogWorker (persist + `activity.created`) → EventsGateway `activity:created`
//   GET /projects/:projectId/activity → ListProjectActivityHandler

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { ActivityController } from './presentation/controllers/activity.controller';
import { ListProjectActivityHandler } from './application/queries/list-project-activity.handler';
import { ActivityEventsListener } from './infrastructure/event-handlers/activity-events.listener';
import { ActivityLogWorker } from '../../shared/infrastructure/rabbitmq/workers/activity-log.worker';

@Module({
  imports: [CqrsModule, SharedModule, AuthModule, ProjectsModule],
  controllers: [ActivityController],
  providers: [
    ListProjectActivityHandler,
    ActivityEventsListener,
    ActivityLogWorker,
  ],
})
export class ActivityModule {}
