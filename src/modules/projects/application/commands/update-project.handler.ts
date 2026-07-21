// src/modules/projects/application/commands/update-project.handler.ts
// Update project metadata. Requires the actor to be an admin/owner member.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateProjectCommand } from './update-project.command';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
  ProjectView,
} from '../../domain/repositories/project.repository.interface';
import { ProjectRoles } from '../../domain/value-objects/project-role.value-object';
import {
  DuplicateProjectNameError,
  InsufficientProjectPermissionError,
  NotProjectMemberError,
  ProjectNotFoundError,
} from '../errors/project.errors';

@CommandHandler(UpdateProjectCommand)
export class UpdateProjectHandler
  implements ICommandHandler<UpdateProjectCommand>
{
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
  ) {}

  async execute(command: UpdateProjectCommand): Promise<ProjectView> {
    const membership = await this.repo.findMembership(
      command.projectId,
      command.actingUserId,
    );
    if (!membership) throw new NotProjectMemberError();
    if (!ProjectRoles.canEditProject(membership.role)) {
      throw new InsufficientProjectPermissionError();
    }

    const project = await this.repo.findById(command.projectId);
    if (!project) throw new ProjectNotFoundError();

    // Enforce unique name per owner when the name actually changes.
    const nextName = command.fields.name?.trim();
    if (nextName && nextName !== project.name) {
      if (await this.repo.existsByOwnerAndName(project.ownerId, nextName)) {
        throw new DuplicateProjectNameError();
      }
    }

    project.applyUpdate(command.fields);
    await this.repo.update(project);

    const view = await this.repo.findViewById(project.id);
    if (!view) throw new ProjectNotFoundError();
    return view;
  }
}
