// src/modules/projects/application/commands/update-member-role.handler.ts
// Change a member's role. Enforces the privileged-role rules (only owners manage
// owner/admin roles) and last-owner protection.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateMemberRoleCommand } from './update-member-role.command';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
  ProjectView,
} from '../../domain/repositories/project.repository.interface';
import { ProjectRoles } from '../../domain/value-objects/project-role.value-object';
import { ProjectDomainService } from '../../domain/services/project.domain.service';
import {
  InsufficientProjectPermissionError,
  LastOwnerError,
  MemberNotFoundError,
  NotProjectMemberError,
  ProjectNotFoundError,
} from '../errors/project.errors';

@CommandHandler(UpdateMemberRoleCommand)
export class UpdateMemberRoleHandler implements ICommandHandler<UpdateMemberRoleCommand> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
    private readonly domain: ProjectDomainService,
  ) {}

  async execute(command: UpdateMemberRoleCommand): Promise<ProjectView> {
    const actor = await this.repo.findMembership(
      command.projectId,
      command.actingUserId,
    );
    if (!actor) throw new NotProjectMemberError();

    if (command.actingUserId === command.targetUserId) {
      throw new InsufficientProjectPermissionError(
        "You can't change your own role. Ask a project owner to do it.",
      );
    }
    if (!ProjectRoles.canManageMembers(actor.role)) {
      throw new InsufficientProjectPermissionError(
        'Only project owners and admins can change member roles.',
      );
    }

    const target = await this.repo.findMembership(
      command.projectId,
      command.targetUserId,
    );
    if (!target) throw new MemberNotFoundError();

    if (target.role === command.role) {
      // No-op change; nothing to validate or persist.
      const current = await this.repo.findViewById(command.projectId);
      if (!current) throw new ProjectNotFoundError();
      return current;
    }

    if (!this.domain.canAssignRole(actor.role, target.role, command.role)) {
      // Managers reach this only when an admin touches an owner/admin role.
      throw new InsufficientProjectPermissionError(
        'Only the project owner can grant, change or remove the owner and admin roles.',
      );
    }

    // Demoting/replacing the last owner would leave the project ownerless.
    if (target.role === 'owner' && command.role !== 'owner') {
      const owners = await this.repo.countOwners(command.projectId);
      if (this.domain.wouldLeaveNoOwner(target.role, owners)) {
        throw new LastOwnerError();
      }
    }

    await this.repo.updateMemberRole(
      command.projectId,
      command.targetUserId,
      command.role,
    );

    const view = await this.repo.findViewById(command.projectId);
    if (!view) throw new ProjectNotFoundError();
    return view;
  }
}
