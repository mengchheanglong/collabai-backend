// src/modules/projects/application/commands/accept-invitation.handler.ts

import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import { AcceptInvitationCommand } from './accept-invitation.command';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
  ProjectView,
} from '../../domain/repositories/project.repository.interface';
import { ProjectMemberEntity } from '../../domain/entities/project-member.entity';
import { ProjectRoles } from '../../domain/value-objects/project-role.value-object';
import { ProjectNotFoundError } from '../errors/project.errors';

@CommandHandler(AcceptInvitationCommand)
export class AcceptInvitationHandler
  implements ICommandHandler<AcceptInvitationCommand>
{
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
  ) {}

  async execute(command: AcceptInvitationCommand): Promise<{ project: ProjectView; message: string }> {
    const inv = await this.repo.findInvitationByToken(command.token);
    if (!inv) {
      throw new NotFoundException('Invitation not found or has been revoked');
    }

    if (new Date() > new Date(inv.expiresAt)) {
      await this.repo.deleteInvitation(inv.id);
      throw new BadRequestException('This invitation link has expired');
    }

    const existingMembership = await this.repo.findMembership(
      inv.projectId,
      command.userId,
    );

    if (!existingMembership) {
      const role = ProjectRoles.isValid(inv.role) ? inv.role : 'member';
      const member = ProjectMemberEntity.create({
        id: uuidv4(),
        projectId: inv.projectId,
        userId: command.userId,
        role,
        invitedBy: inv.invitedBy,
      });
      await this.repo.addMember(member);
    }

    await this.repo.deleteInvitation(inv.id);

    const project = await this.repo.findViewById(inv.projectId);
    if (!project) throw new ProjectNotFoundError();

    return {
      project,
      message: 'Successfully joined the project',
    };
  }
}
