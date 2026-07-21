// src/modules/projects/application/commands/delete-project.handler.ts
// Delete a project. Owner only. Prisma cascade removes members/tasks/comments/activities.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteProjectCommand } from './delete-project.command';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import { ProjectRoles } from '../../domain/value-objects/project-role.value-object';
import {
  InsufficientProjectPermissionError,
  NotProjectMemberError,
} from '../errors/project.errors';

@CommandHandler(DeleteProjectCommand)
export class DeleteProjectHandler
  implements ICommandHandler<DeleteProjectCommand>
{
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
  ) {}

  async execute(command: DeleteProjectCommand): Promise<void> {
    const membership = await this.repo.findMembership(
      command.projectId,
      command.actingUserId,
    );
    if (!membership) throw new NotProjectMemberError();
    if (!ProjectRoles.canDeleteProject(membership.role)) {
      throw new InsufficientProjectPermissionError('Only the owner can delete a project');
    }

    await this.repo.delete(command.projectId);
  }
}
