// src/modules/projects/projects.module.ts
//
// Wires the projects module: binds the repository port to its Prisma implementation,
// registers the pure domain service and all CQRS command/query handlers.
// SharedModule supplies PrismaService + JwtModule; AuthModule supplies the
// TokenBlacklistService that JwtAuthGuard depends on.

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectsController } from './presentation/controllers/projects.controller';

import { PROJECT_REPOSITORY } from './domain/repositories/project.repository.interface';
import { ProjectRepository } from './infrastructure/persistence/project.repository';
import { ProjectDomainService } from './domain/services/project.domain.service';

import { CreateProjectHandler } from './application/commands/create-project.handler';
import { UpdateProjectHandler } from './application/commands/update-project.handler';
import { DeleteProjectHandler } from './application/commands/delete-project.handler';
import { InviteMemberHandler } from './application/commands/invite-member.handler';
import { UpdateMemberRoleHandler } from './application/commands/update-member-role.handler';
import { RemoveMemberHandler } from './application/commands/remove-member.handler';
import { GetAllProjectsHandler } from './application/queries/get-all-projects.handler';
import { GetProjectHandler } from './application/queries/get-project.handler';
import { ListMembersHandler } from './application/queries/list-members.handler';

const CommandHandlers = [
  CreateProjectHandler,
  UpdateProjectHandler,
  DeleteProjectHandler,
  InviteMemberHandler,
  UpdateMemberRoleHandler,
  RemoveMemberHandler,
];

const QueryHandlers = [
  GetAllProjectsHandler,
  GetProjectHandler,
  ListMembersHandler,
];

@Module({
  imports: [CqrsModule, SharedModule, AuthModule],
  controllers: [ProjectsController],
  providers: [
    { provide: PROJECT_REPOSITORY, useClass: ProjectRepository },
    ProjectDomainService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [PROJECT_REPOSITORY],
})
export class ProjectsModule {}
