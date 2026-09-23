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
import { ProjectInvitationsService } from '../../application/project-invitations.service';
import { UpdateMemberRoleCommand } from '../../application/commands/update-member-role.command';
import { RemoveMemberCommand } from '../../application/commands/remove-member.command';
import { GetAllProjectsQuery } from '../../application/queries/get-all-projects.query';
import { GetProjectQuery } from '../../application/queries/get-project.query';
import { ListMembersQuery } from '../../application/queries/list-members.query';

import { CreateProjectDto } from '../../application/dtos/create-project.dto';
import { UpdateProjectDto } from '../../application/dtos/update-project.dto';
import { InviteMemberDto } from '../../application/dtos/invite-member.dto';
import { AcceptInvitationDto } from '../../application/dtos/accept-invitation.dto';
import { UpdateMemberRoleDto } from '../../application/dtos/update-member-role.dto';
import {
  toMemberResponse,
  toProjectResponse,
} from '../../application/dtos/project-response.dto';

@ApiTags('Projects')
@ApiBearerAuth('access-token')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@UseFilters(ProjectExceptionFilter)
export class ProjectsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly invitations: ProjectInvitationsService,
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
    return { members: members.map(toMemberResponse) };
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
    const invitation = await this.invitations.invite(projectId, userId, dto.email, dto.role ?? 'member');
    return { invitation, message: invitation.pending ? 'Invitation sent' : 'Member added' };
  }

  @Get(':projectId/invitations')
  async listInvitations(@CurrentUser('id') userId: string, @Param('projectId') projectId: string) {
    return { invitations: await this.invitations.list(projectId, userId) };
  }

  @Post(':projectId/invitations/:invitationId/resend')
  async resendInvitation(@CurrentUser('id') userId: string, @Param('projectId') projectId: string, @Param('invitationId') invitationId: string) {
    return this.invitations.resend(projectId, invitationId, userId);
  }

  @Delete(':projectId/invitations/:invitationId')
  async revokeInvitation(@CurrentUser('id') userId: string, @Param('projectId') projectId: string, @Param('invitationId') invitationId: string) {
    return this.invitations.revoke(projectId, invitationId, userId);
  }

  @Post('invitations/accept')
  async acceptInvitation(@CurrentUser('id') userId: string, @Body() dto: AcceptInvitationDto) {
    return { invitation: await this.invitations.accept(dto.token, userId) };
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
}
