import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { UploadsController } from './presentation/uploads.controller';
import { UploadsService } from './application/uploads.service';

@Module({ imports: [AuthModule, ProjectsModule, SharedModule], controllers: [UploadsController], providers: [UploadsService, JwtAuthGuard] })
export class UploadsModule {}
