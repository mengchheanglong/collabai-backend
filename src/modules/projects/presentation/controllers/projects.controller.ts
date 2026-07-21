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

import { CreateProjectCommand } from '../../application/commands/create-project.command';
import { UpdateProjectCommand } from '../../application/commands/update-project.command';
import { DeleteProjectCommand } from '../../application/commands/delete-project.command';
import { InviteMemberCommand } from '../../application/commands/invite-member.command';
import { UpdateMemberRoleCommand } from '../../application/commands/update-member-role.command';
import { RemoveMemberCommand } from '../../application/commands/remove-member.command';
import { GetAllProjectsQuery } from '../../application/queries/get-all-projects.query';
import { GetProjectQuery } from '../../application/queries/get-project.query';
import { ListMembersQuery } from '../../application/queries/list-members.query';

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
    const result = (await this.queryBus.execute(
      new GetAllProjectsQuery(userId, toInt(page, 1), toInt(limit, 20), q),
    )) as Paginated<ProjectView>;

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
    const view = (await this.commandBus.execute(
      new CreateProjectCommand(
        userId,
        dto.name,
        dto.description,
        dto.color,
        dto.icon,
      ),
    )) as ProjectView;
    return { project: toProjectResponse(view) };
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get a project with its members' })
  async get(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
  ) {
    const view = (await this.queryBus.execute(
      new GetProjectQuery(userId, projectId),
    )) as ProjectView;
    return { project: toProjectResponse(view) };
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'Update project metadata (admin/owner)' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const view = (await this.commandBus.execute(
      new UpdateProjectCommand(userId, projectId, {
        name: dto.name,
        description: dto.description,
        color: dto.color,
        icon: dto.icon,
      }),
    )) as ProjectView;
    return { project: toProjectResponse(view) };
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Delete a project (owner only)' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
  ) {
    await this.commandBus.execute(new DeleteProjectCommand(userId, projectId));
    return { success: true, message: 'Project deleted' };
  }

  // ----- membership -----

  @Get(':projectId/members')
  @ApiOperation({ summary: 'List project members' })
  async listMembers(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
  ) {
    const members = (await this.queryBus.execute(
      new ListMembersQuery(userId, projectId),
    )) as ProjectMemberView[];
    return { members: members.map(toMemberResponse) };
  }

  @Post(':projectId/members')
  @HttpCode(201)
  @ApiOperation({ summary: 'Add an existing user to the project (admin/owner)' })
  async addMember(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: InviteMemberDto,
  ) {
    const view = (await this.commandBus.execute(
      new InviteMemberCommand(userId, projectId, dto.email, dto.role ?? 'member'),
    )) as ProjectView;
    return { project: toProjectResponse(view), message: 'Member added' };
  }

  @Patch(':projectId/members/:memberUserId')
  @ApiOperation({ summary: 'Change a member role (admin/owner)' })
  async updateMemberRole(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const view = (await this.commandBus.execute(
      new UpdateMemberRoleCommand(userId, projectId, memberUserId, dto.role),
    )) as ProjectView;
    return { project: toProjectResponse(view) };
  }

  @Delete(':projectId/members/:memberUserId')
  @ApiOperation({ summary: 'Remove a member (admin/owner, or leave yourself)' })
  async removeMember(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    const view = (await this.commandBus.execute(
      new RemoveMemberCommand(userId, projectId, memberUserId),
    )) as ProjectView;
    return { project: toProjectResponse(view), message: 'Member removed' };
  }
}

function toInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
