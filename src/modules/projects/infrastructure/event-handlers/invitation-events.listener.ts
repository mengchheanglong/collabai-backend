// src/modules/projects/infrastructure/event-handlers/invitation-events.listener.ts
//
// When a user verifies their email, every pending (non-expired) invitation sent to that
// address becomes a membership — so someone invited before they had an account sees the
// project right after signing up, without having to click the invite link again.
// Only a *verified* email is trusted here; registration alone proves nothing.

import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EmailVerifiedEvent } from '../../../auth/domain/events/email-verified.event';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import { ProjectMemberEntity } from '../../domain/entities/project-member.entity';
import { ProjectRoles } from '../../domain/value-objects/project-role.value-object';

@Injectable()
export class InvitationEventsListener {
  private readonly logger = new Logger(InvitationEventsListener.name);

  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
    private readonly events: EventEmitter2,
  ) {}

  @OnEvent(EmailVerifiedEvent.eventName)
  async onEmailVerified(event: EmailVerifiedEvent): Promise<void> {
    let invitations;
    try {
      invitations = await this.repo.listInvitationsByEmail(event.email);
    } catch (err) {
      this.logger.error(
        `Could not load pending invitations for ${event.email}: ${(err as Error).message}`,
      );
      return;
    }

    const now = Date.now();
    for (const inv of invitations) {
      if (new Date(inv.expiresAt).getTime() < now) continue; // expired — admin must resend
      try {
        const existing = await this.repo.findMembership(inv.projectId, event.userId);
        if (!existing) {
          const role = ProjectRoles.isValid(inv.role) ? inv.role : 'member';
          await this.repo.addMember(
            ProjectMemberEntity.create({
              id: uuidv4(),
              projectId: inv.projectId,
              userId: event.userId,
              role,
              invitedBy: inv.invitedBy,
            }),
          );
          this.events.emit('member.added', {
            projectId: inv.projectId,
            actorId: inv.invitedBy,
            userId: event.userId,
            role,
          });
        }
        await this.repo.deleteInvitation(inv.id);
      } catch (err) {
        this.logger.error(
          `Could not accept invitation ${inv.id} for ${event.email}: ${(err as Error).message}`,
        );
      }
    }
  }
}
