// src/modules/projects/application/commands/revoke-invitation.handler.ts

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RevokeInvitationCommand } from './revoke-invitation.command';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import { ProjectRoles } from '../../domain/value-objects/project-role.value-object';
import {
  InsufficientProjectPermissionError,
  NotProjectMemberError,
} from '../errors/project.errors';

@CommandHandler(RevokeInvitationCommand)
export class RevokeInvitationHandler
  implements ICommandHandler<RevokeInvitationCommand>
{
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
  ) {}

  async execute(command: RevokeInvitationCommand): Promise<void> {
    const actor = await this.repo.findMembership(
      command.projectId,
      command.actingUserId,
    );
    if (!actor) throw new NotProjectMemberError();
    if (!ProjectRoles.canManageMembers(actor.role)) {
      throw new InsufficientProjectPermissionError(
        'Only project owners and admins can revoke invitations.',
      );
    }

    const invitation = await this.repo.findInvitationById(command.invitationId);
    if (!invitation || invitation.projectId !== command.projectId) {
      return;
    }

    await this.repo.deleteInvitation(command.invitationId);
  }
}
