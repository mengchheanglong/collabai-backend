// src/modules/projects/application/commands/resend-invitation.handler.ts

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import { ResendInvitationCommand } from './resend-invitation.command';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import { ProjectRoles } from '../../domain/value-objects/project-role.value-object';
import {
  InsufficientProjectPermissionError,
  NotProjectMemberError,
  ProjectNotFoundError,
} from '../errors/project.errors';
import { EmailService } from '../../../../shared/services/email.service';

@CommandHandler(ResendInvitationCommand)
export class ResendInvitationHandler implements ICommandHandler<ResendInvitationCommand> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(command: ResendInvitationCommand): Promise<void> {
    const actor = await this.repo.findMembership(
      command.projectId,
      command.actingUserId,
    );
    if (!actor) throw new NotProjectMemberError();
    if (!ProjectRoles.canManageMembers(actor.role)) {
      throw new InsufficientProjectPermissionError();
    }

    const invitation = await this.repo.findInvitationById(command.invitationId);
    if (!invitation || invitation.projectId !== command.projectId) {
      return;
    }

    const project = await this.repo.findViewById(command.projectId);
    if (!project) throw new ProjectNotFoundError();

    // Regenerate fresh token and extend expiration by 7 days
    const freshToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.repo.createInvitation({
      id: invitation.id,
      projectId: command.projectId,
      email: invitation.email,
      role: invitation.role,
      token: freshToken,
      invitedBy: command.actingUserId,
      expiresAt,
    });

    const frontendOrigin =
      process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim() ||
      'http://localhost:4200';
    const inviteUrl = `${frontendOrigin}/accept-invite?token=${freshToken}`;
    const inviterName = invitation.inviterName || 'A team member';

    await this.emailService.sendProjectInvitation(
      invitation.email,
      project.name,
      inviterName,
      inviteUrl,
    );
  }
}
