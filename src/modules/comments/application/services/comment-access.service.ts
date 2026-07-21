// src/modules/comments/application/services/comment-access.service.ts
//
// Bridges comments to project membership/authorization (reusing the projects module's
// PROJECT_REPOSITORY). Also resolves mentioned emails to member user ids.

import { Inject, Injectable } from '@nestjs/common';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../../projects/domain/repositories/project.repository.interface';
import { ProjectRoles } from '../../../projects/domain/value-objects/project-role.value-object';
import {
  CommentModerationForbiddenError,
  CommentWriteForbiddenError,
  NotProjectMemberError,
} from '../errors/comment.errors';

@Injectable()
export class CommentAccessService {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
  ) {}

  /** Throws unless `userId` is a member of `projectId`. */
  async requireMember(projectId: string, userId: string): Promise<void> {
    const membership = await this.projects.findMembership(projectId, userId);
    if (!membership) throw new NotProjectMemberError();
  }

  /** Throws unless `userId` is a member who may write (not a viewer). */
  async requireWriter(projectId: string, userId: string): Promise<void> {
    const membership = await this.projects.findMembership(projectId, userId);
    if (!membership) throw new NotProjectMemberError();
    if (!ProjectRoles.canWriteContent(membership.role)) {
      throw new CommentWriteForbiddenError();
    }
  }

  /**
   * Throws unless `userId` is the comment's author or a project moderator (owner/admin).
   * Requires the caller to still be a project member.
   */
  async requireAuthorOrModerator(
    projectId: string,
    userId: string,
    authorId: string,
  ): Promise<void> {
    const membership = await this.projects.findMembership(projectId, userId);
    if (!membership) throw new NotProjectMemberError();
    if (userId === authorId) return;
    if (ProjectRoles.canManageMembers(membership.role)) return; // moderator
    throw new CommentModerationForbiddenError();
  }

  /** Resolve mentioned emails to the user ids of matching project members. */
  async resolveMentionedMemberIds(
    projectId: string,
    emails: string[],
  ): Promise<string[]> {
    if (emails.length === 0) return [];
    const wanted = new Set(emails.map((e) => e.toLowerCase()));
    const members = await this.projects.listMembers(projectId);
    return members
      .filter((m) => wanted.has(m.email.toLowerCase()))
      .map((m) => m.userId);
  }
}
