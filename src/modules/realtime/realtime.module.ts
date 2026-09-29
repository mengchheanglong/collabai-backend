// src/modules/realtime/realtime.module.ts
import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [SharedModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class RealtimeModule {}
