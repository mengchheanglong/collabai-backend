// src/modules/projects/application/commands/create-project.handler.ts
// Create a project; the creator is inserted as its owner member atomically.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import { CreateProjectCommand } from './create-project.command';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
  ProjectView,
} from '../../domain/repositories/project.repository.interface';
import { ProjectEntity } from '../../domain/entities/project.entity';
import { ProjectMemberEntity } from '../../domain/entities/project-member.entity';
import {
  DuplicateProjectNameError,
  ProjectNotFoundError,
} from '../errors/project.errors';

@CommandHandler(CreateProjectCommand)
export class CreateProjectHandler
  implements ICommandHandler<CreateProjectCommand>
{
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
  ) {}

  async execute(command: CreateProjectCommand): Promise<ProjectView> {
    const name = command.name.trim();
    if (await this.repo.existsByOwnerAndName(command.ownerId, name)) {
      throw new DuplicateProjectNameError();
    }

    const project = ProjectEntity.create({
      id: uuidv4(),
      ownerId: command.ownerId,
      name,
      description: command.description,
      color: command.color,
      icon: command.icon,
    });
    const owner = ProjectMemberEntity.create({
      id: uuidv4(),
      projectId: project.id,
      userId: command.ownerId,
      role: 'owner',
    });

    await this.repo.createWithOwner(project, owner);

    const view = await this.repo.findViewById(project.id);
    if (!view) throw new ProjectNotFoundError();
    return view;
  }
}
