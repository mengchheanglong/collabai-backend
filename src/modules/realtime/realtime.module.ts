import { ActivityController } from './activity.controller';
import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { CommentsModule } from '../comments/comments.module';
import { EventsGateway } from './events.gateway';
import { RealtimeListener } from './realtime.listener';
@Module({ imports: [SharedModule, AuthModule, TasksModule, CommentsModule], providers: [EventsGateway, RealtimeListener], controllers: [ActivityController] })
export class RealtimeModule {}
