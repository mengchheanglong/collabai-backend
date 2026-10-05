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
import { ProjectAnalyticsController } from './presentation/controllers/project-analytics.controller';
import { InvitationsController } from './presentation/controllers/invitations.controller';

import { PROJECT_REPOSITORY } from './domain/repositories/project.repository.interface';
import { ProjectRepository } from './infrastructure/persistence/project.repository';
import { ProjectDomainService } from './domain/services/project.domain.service';

import { CreateProjectHandler } from './application/commands/create-project.handler';
import { UpdateProjectHandler } from './application/commands/update-project.handler';
import { DeleteProjectHandler } from './application/commands/delete-project.handler';
import { InviteMemberHandler } from './application/commands/invite-member.handler';
import { UpdateMemberRoleHandler } from './application/commands/update-member-role.handler';
import { RemoveMemberHandler } from './application/commands/remove-member.handler';
import { RevokeInvitationHandler } from './application/commands/revoke-invitation.handler';
import { ResendInvitationHandler } from './application/commands/resend-invitation.handler';
import { AcceptInvitationHandler } from './application/commands/accept-invitation.handler';

import { GetAllProjectsHandler } from './application/queries/get-all-projects.handler';
import { GetProjectHandler } from './application/queries/get-project.handler';
import { ListMembersHandler } from './application/queries/list-members.handler';
import { ListInvitationsHandler } from './application/queries/list-invitations.handler';
import { GetInvitationHandler } from './application/queries/get-invitation.handler';
import { GetProjectAnalyticsSummaryHandler } from './application/queries/get-project-analytics-summary.handler';
import { GetProjectAnalyticsBurndownHandler } from './application/queries/get-project-analytics-burndown.handler';
import { InvitationEventsListener } from './infrastructure/event-handlers/invitation-events.listener';

const CommandHandlers = [
  CreateProjectHandler,
  UpdateProjectHandler,
  DeleteProjectHandler,
  InviteMemberHandler,
  UpdateMemberRoleHandler,
  RemoveMemberHandler,
  RevokeInvitationHandler,
  ResendInvitationHandler,
  AcceptInvitationHandler,
];

const QueryHandlers = [
  GetAllProjectsHandler,
  GetProjectHandler,
  ListMembersHandler,
  ListInvitationsHandler,
  GetInvitationHandler,
  GetProjectAnalyticsSummaryHandler,
  GetProjectAnalyticsBurndownHandler,
];

@Module({
  imports: [CqrsModule, SharedModule, AuthModule],
  controllers: [
    ProjectsController,
    ProjectAnalyticsController,
    InvitationsController,
  ],
  providers: [
    { provide: PROJECT_REPOSITORY, useClass: ProjectRepository },
    ProjectDomainService,
    InvitationEventsListener,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [PROJECT_REPOSITORY],
})
export class ProjectsModule {}
