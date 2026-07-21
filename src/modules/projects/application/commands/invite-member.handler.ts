// src/modules/projects/application/commands/invite-member.handler.ts
// Add an existing user to a project. Actor must be admin/owner; assigning `admin`
// requires the actor to be an owner. For MVP the user is added directly (no pending
// invitation token).

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import { InviteMemberCommand } from './invite-member.command';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
  ProjectView,
} from '../../domain/repositories/project.repository.interface';
import { ProjectMemberEntity } from '../../domain/entities/project-member.entity';
import { ProjectRoles } from '../../domain/value-objects/project-role.value-object';
import { ProjectDomainService } from '../../domain/services/project.domain.service';
import {
  InsufficientProjectPermissionError,
  InviteeNotFoundError,
  MemberAlreadyExistsError,
  NotProjectMemberError,
  ProjectNotFoundError,
} from '../errors/project.errors';

@CommandHandler(InviteMemberCommand)
export class InviteMemberHandler
  implements ICommandHandler<InviteMemberCommand>
{
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
    private readonly domain: ProjectDomainService,
  ) {}

  async execute(command: InviteMemberCommand): Promise<ProjectView> {
    const actor = await this.repo.findMembership(
      command.projectId,
      command.actingUserId,
    );
    if (!actor) throw new NotProjectMemberError();
    if (!ProjectRoles.canManageMembers(actor.role)) {
      throw new InsufficientProjectPermissionError();
    }
    // Adding at `admin` (a privileged role) requires the actor to be an owner.
    if (!this.domain.canAssignRole(actor.role, 'viewer', command.role)) {
      throw new InsufficientProjectPermissionError(
        'Only an owner can grant the admin role',
      );
    }

    const invitee = await this.repo.findUserByEmail(command.email);
    if (!invitee) throw new InviteeNotFoundError();

    const existing = await this.repo.findMembership(
      command.projectId,
      invitee.id,
    );
    if (existing) throw new MemberAlreadyExistsError();

    const member = ProjectMemberEntity.create({
      id: uuidv4(),
      projectId: command.projectId,
      userId: invitee.id,
      role: command.role,
      invitedBy: command.actingUserId,
    });
    await this.repo.addMember(member);

    const view = await this.repo.findViewById(command.projectId);
    if (!view) throw new ProjectNotFoundError();
    return view;
  }
}
