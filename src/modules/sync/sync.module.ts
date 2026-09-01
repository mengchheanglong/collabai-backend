// src/modules/sync/sync.module.ts

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { SyncController } from './presentation/controllers/sync.controller';
import { GetDeltaSyncHandler } from './application/queries/get-delta-sync.handler';

const QueryHandlers = [GetDeltaSyncHandler];

@Module({
  imports: [CqrsModule, SharedModule, AuthModule],
  controllers: [SyncController],
  providers: [...QueryHandlers],
  exports: [...QueryHandlers],
})
export class SyncModule {}
