// src/modules/tasks/application/services/task-access.service.ts
//
// Bridges the tasks module to project membership/authorization. Tasks live inside a
// project, so every task operation is gated by the caller's project role. Reuses the
// projects module's PROJECT_REPOSITORY (exported by ProjectsModule) rather than querying
// membership tables directly.

import { Inject, Injectable } from '@nestjs/common';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../../projects/domain/repositories/project.repository.interface';
import { ProjectRoles } from '../../../projects/domain/value-objects/project-role.value-object';
import {
  NotProjectMemberError,
  TaskWriteForbiddenError,
} from '../errors/task.errors';

@Injectable()
export class TaskAccessService {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
  ) {}

  /** Throws unless `userId` is a member of `projectId`. */
  async requireMember(projectId: string, userId: string): Promise<void> {
    const membership = await this.projects.findMembership(projectId, userId);
    if (!membership) throw new NotProjectMemberError();
  }

  /** Throws unless `userId` is a member who may modify content (not a viewer). */
  async requireWriter(projectId: string, userId: string): Promise<void> {
    const membership = await this.projects.findMembership(projectId, userId);
    if (!membership) throw new NotProjectMemberError();
    if (!ProjectRoles.canWriteContent(membership.role)) {
      throw new TaskWriteForbiddenError();
    }
  }

  /** True when `userId` is a member of `projectId` (used to validate assignees). */
  async isMember(projectId: string, userId: string): Promise<boolean> {
    return (await this.projects.findMembership(projectId, userId)) !== null;
  }
}
