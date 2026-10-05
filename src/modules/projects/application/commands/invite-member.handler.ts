// src/modules/projects/application/commands/invite-member.handler.ts
// Add an existing user to a project. Actor must be admin/owner; assigning `admin`
// requires the actor to be an owner. For MVP the user is added directly (no pending
// invitation token).

import { Inject, Optional } from '@nestjs/common';
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
  MemberAlreadyExistsError,
  NotProjectMemberError,
  ProjectNotFoundError,
} from '../errors/project.errors';
import {
  EVENT_BUS,
  type IEventBus,
} from '../../../../shared/event-bus/event-bus.interface';
import { ROUTING_KEY } from '../../../../shared/infrastructure/rabbitmq/rabbitmq.constants';

@CommandHandler(InviteMemberCommand)
export class InviteMemberHandler implements ICommandHandler<InviteMemberCommand> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
    private readonly domain: ProjectDomainService,
    @Optional() @Inject(EVENT_BUS) private readonly bus?: IEventBus,
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

    const project = await this.repo.findViewById(command.projectId);
    if (!project) throw new ProjectNotFoundError();

    const email = command.email.toLowerCase().trim();
    const invitee = await this.repo.findUserByEmail(email);

    const frontendOrigin =
      process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim() ||
      'http://localhost:4200';
    const inviterMember = project.members.find(
      (m) => m.userId === command.actingUserId,
    );
    const inviterName = inviterMember?.name || 'A team member';

    if (invitee) {
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

      await this.bus?.publish(ROUTING_KEY.EMAIL_PROJECT_INVITATION, {
        to: email,
        projectName: project.name,
        inviterName,
        inviteUrl: `${frontendOrigin}/board/${command.projectId}`,
      });
    } else {
      // User is not yet registered: generate token and send invitation
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await this.repo.createInvitation({
        id: uuidv4(),
        projectId: command.projectId,
        email,
        role: command.role,
        token,
        invitedBy: command.actingUserId,
        expiresAt,
      });

      await this.bus?.publish(ROUTING_KEY.EMAIL_PROJECT_INVITATION, {
        to: email,
        projectName: project.name,
        inviterName,
        inviteUrl: `${frontendOrigin}/accept-invite?token=${token}`,
      });
    }

    const view = await this.repo.findViewById(command.projectId);
    if (!view) throw new ProjectNotFoundError();
    return view;
  }
}
