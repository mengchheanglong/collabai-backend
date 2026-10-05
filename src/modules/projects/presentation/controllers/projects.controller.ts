// src/modules/projects/presentation/controllers/projects.controller.ts
//
// REST surface for the projects module. Every route requires a valid access token
// (JwtAuthGuard) and resolves the caller via @CurrentUser('id'). Handlers do the
// authorization (membership/role); this layer just dispatches CQRS messages and maps
// the domain read models to response DTOs. Domain errors -> ProjectExceptionFilter.

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { ProjectExceptionFilter } from '../exception-filters/project-exception.filter';

import { parsePaginationParams } from '../../../../common/utils/pagination.util';
import { CreateProjectCommand } from '../../application/commands/create-project.command';
import { UpdateProjectCommand } from '../../application/commands/update-project.command';
import { DeleteProjectCommand } from '../../application/commands/delete-project.command';
import { InviteMemberCommand } from '../../application/commands/invite-member.command';
import { UpdateMemberRoleCommand } from '../../application/commands/update-member-role.command';
import { RemoveMemberCommand } from '../../application/commands/remove-member.command';
import { GetAllProjectsQuery } from '../../application/queries/get-all-projects.query';
import { GetProjectQuery } from '../../application/queries/get-project.query';
import { ListMembersQuery } from '../../application/queries/list-members.query';
import { ListInvitationsQuery } from '../../application/queries/list-invitations.query';
import { RevokeInvitationCommand } from '../../application/commands/revoke-invitation.command';
import { ResendInvitationCommand } from '../../application/commands/resend-invitation.command';
import { AcceptInvitationCommand } from '../../application/commands/accept-invitation.command';

import { CreateProjectDto } from '../../application/dtos/create-project.dto';
import { UpdateProjectDto } from '../../application/dtos/update-project.dto';
import { InviteMemberDto } from '../../application/dtos/invite-member.dto';
import { UpdateMemberRoleDto } from '../../application/dtos/update-member-role.dto';
import {
  toMemberResponse,
  toProjectResponse,
} from '../../application/dtos/project-response.dto';
import {
  Paginated,
  ProjectMemberView,
  ProjectView,
} from '../../domain/repositories/project.repository.interface';

@ApiTags('Projects')
@ApiBearerAuth('access-token')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@UseFilters(ProjectExceptionFilter)
export class ProjectsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List projects the current user belongs to' })
  async list(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    const { page: parsedPage, limit: parsedLimit } = parsePaginationParams(
      page,
      limit,
      20,
    );
    const result = await this.queryBus.execute(
      new GetAllProjectsQuery(userId, parsedPage, parsedLimit, q),
    );

    return {
      items: result.items.map(toProjectResponse),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
      },
    };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a project (creator becomes owner)' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    const view = await this.commandBus.execute(
      new CreateProjectCommand(
        userId,
        dto.name,
        dto.description,
        dto.color,
        dto.icon,
      ),
    );
    return { project: toProjectResponse(view) };
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get a project with its members' })
  async get(
    @CurrentUser('id') userId: string,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    const view = await this.queryBus.execute(
      new GetProjectQuery(userId, projectId),
    );
    return { project: toProjectResponse(view) };
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'Update project metadata (admin/owner)' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const view = await this.commandBus.execute(
      new UpdateProjectCommand(userId, projectId, {
        name: dto.name,
        description: dto.description,
        color: dto.color,
        icon: dto.icon,
      }),
    );
    return { project: toProjectResponse(view) };
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Delete a project (owner only)' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    await this.commandBus.execute(new DeleteProjectCommand(userId, projectId));
    return { success: true, message: 'Project deleted' };
  }

  // ----- membership -----

  @Get(':projectId/members')
  @ApiOperation({ summary: 'List project members' })
  async listMembers(
    @CurrentUser('id') userId: string,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    const members = await this.queryBus.execute(
      new ListMembersQuery(userId, projectId),
    );
    const invitations = await this.queryBus.execute(
      new ListInvitationsQuery(userId, projectId),
    );
    const memberResponses = (members || []).map(toMemberResponse);
    const pendingResponses = (invitations || []).map((inv: any) => ({
      userId: null,
      invitationId: inv.id,
      role: inv.role,
      name: inv.email.split('@')[0],
      email: inv.email,
      avatarUrl: null,
      joinedAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : null,
      pending: true,
      invitationExpiresAt: inv.expiresAt ? new Date(inv.expiresAt).toISOString() : null,
    }));
    return { members: [...memberResponses, ...pendingResponses] };
  }

  @Post(':projectId/members')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Add an existing user to the project (admin/owner)',
  })
  async addMember(
    @CurrentUser('id') userId: string,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() dto: InviteMemberDto,
  ) {
    const view = await this.commandBus.execute(
      new InviteMemberCommand(
        userId,
        projectId,
        dto.email,
        dto.role ?? 'member',
      ),
    );
    return { project: toProjectResponse(view), message: 'Member added' };
  }

  @Patch(':projectId/members/:memberUserId')
  @ApiOperation({ summary: 'Change a member role (admin/owner)' })
  async updateMemberRole(
    @CurrentUser('id') userId: string,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('memberUserId', new ParseUUIDPipe({ version: '4' }))
    memberUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const view = await this.commandBus.execute(
      new UpdateMemberRoleCommand(userId, projectId, memberUserId, dto.role),
    );
    return { project: toProjectResponse(view) };
  }

  @Delete(':projectId/members/:memberUserId')
  @ApiOperation({ summary: 'Remove a member (admin/owner, or leave yourself)' })
  async removeMember(
    @CurrentUser('id') userId: string,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('memberUserId', new ParseUUIDPipe({ version: '4' }))
    memberUserId: string,
  ) {
    const view = await this.commandBus.execute(
      new RemoveMemberCommand(userId, projectId, memberUserId),
    );
    return { project: toProjectResponse(view), message: 'Member removed' };
  }

  // ----- invitations -----

  @Get(':projectId/invitations')
  @ApiOperation({ summary: 'List pending project invitations' })
  async listInvitations(
    @CurrentUser('id') userId: string,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    const invitations = await this.queryBus.execute(
      new ListInvitationsQuery(userId, projectId),
    );
    return { invitations };
  }

  @Delete(':projectId/invitations/:invitationId')
  @ApiOperation({ summary: 'Revoke a pending project invitation' })
  async revokeInvitation(
    @CurrentUser('id') userId: string,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('invitationId', new ParseUUIDPipe({ version: '4' }))
    invitationId: string,
  ) {
    await this.commandBus.execute(
      new RevokeInvitationCommand(userId, projectId, invitationId),
    );
    return { success: true, message: 'Invitation revoked' };
  }

  @Post(':projectId/invitations/:invitationId/resend')
  @ApiOperation({ summary: 'Resend a project invitation email' })
  async resendInvitation(
    @CurrentUser('id') userId: string,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('invitationId', new ParseUUIDPipe({ version: '4' }))
    invitationId: string,
  ) {
    await this.commandBus.execute(
      new ResendInvitationCommand(userId, projectId, invitationId),
    );
    return { success: true, message: 'Invitation resent' };
  }

  @Post('invitations/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept project invitation via body token (requires auth)' })
  async acceptInvitation(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail: string,
    @Body('token') token: string,
  ) {
    const result = await this.commandBus.execute(
      new AcceptInvitationCommand(userId, token, userEmail),
    );
    return result;
  }
}
