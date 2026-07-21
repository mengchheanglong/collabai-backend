// src/modules/projects/application/commands/remove-member.handler.ts
// Remove a member (or leave the project yourself). Managers can remove others; anyone
// may remove themselves. The last owner cannot be removed.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RemoveMemberCommand } from './remove-member.command';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
  ProjectView,
} from '../../domain/repositories/project.repository.interface';
import { ProjectDomainService } from '../../domain/services/project.domain.service';
import {
  InsufficientProjectPermissionError,
  LastOwnerError,
  MemberNotFoundError,
  NotProjectMemberError,
  ProjectNotFoundError,
} from '../errors/project.errors';

@CommandHandler(RemoveMemberCommand)
export class RemoveMemberHandler
  implements ICommandHandler<RemoveMemberCommand>
{
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
    private readonly domain: ProjectDomainService,
  ) {}

  async execute(command: RemoveMemberCommand): Promise<ProjectView> {
    const actor = await this.repo.findMembership(
      command.projectId,
      command.actingUserId,
    );
    if (!actor) throw new NotProjectMemberError();

    const target = await this.repo.findMembership(
      command.projectId,
      command.targetUserId,
    );
    if (!target) throw new MemberNotFoundError();

    if (
      !this.domain.canRemoveMember(
        command.actingUserId,
        actor.role,
        command.targetUserId,
        target.role,
      )
    ) {
      throw new InsufficientProjectPermissionError();
    }

    // Never orphan the project — the last owner cannot be removed (must transfer first).
    if (target.role === 'owner') {
      const owners = await this.repo.countOwners(command.projectId);
      if (this.domain.wouldLeaveNoOwner(target.role, owners)) {
        throw new LastOwnerError(
          'Cannot remove the last owner. Assign another owner first.',
        );
      }
    }

    await this.repo.removeMember(command.projectId, command.targetUserId);

    const view = await this.repo.findViewById(command.projectId);
    if (!view) throw new ProjectNotFoundError();
    return view;
  }
}
