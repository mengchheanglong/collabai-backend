import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { DocsController } from './presentation/docs.controller';
import { DocsService } from './application/docs.service';
import { DocsHandlers } from './application/docs.handlers';
@Module({
  imports: [CqrsModule, SharedModule, AuthModule],
  controllers: [DocsController],
  providers: [DocsService, ...DocsHandlers],
})
export class DocsModule {}
