// src/modules/ai/application/services/ai-access.service.ts
//
// Project-membership check for project-scoped AI calls (reuses the projects module's
// PROJECT_REPOSITORY).

import { Inject, Injectable } from '@nestjs/common';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../../projects/domain/repositories/project.repository.interface';
import {
  type ProjectRole,
  ProjectRoles,
  VIEW_ONLY_MESSAGE,
} from '../../../projects/domain/value-objects/project-role.value-object';
import {
  InsufficientAiPermissionError,
  NotProjectMemberError,
} from '../errors/ai.errors';

@Injectable()
export class AiAccessService {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
  ) {}

  async requireMember(projectId: string, userId: string): Promise<void> {
    const membership = await this.projects.findMembership(projectId, userId);
    if (!membership) throw new NotProjectMemberError();
  }

  /** The caller's project role (null when not a member). */
  async roleOf(projectId: string, userId: string): Promise<ProjectRole | null> {
    const membership = await this.projects.findMembership(projectId, userId);
    return membership?.role ?? null;
  }

  async requireWriter(projectId: string, userId: string): Promise<void> {
    const membership = await this.projects.findMembership(projectId, userId);
    if (!membership) throw new NotProjectMemberError();
    if (!ProjectRoles.canWriteContent(membership.role)) {
      throw new InsufficientAiPermissionError(VIEW_ONLY_MESSAGE);
    }
  }
}
