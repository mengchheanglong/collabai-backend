// src/modules/ai/application/services/ai-access.service.ts
//
// Project-membership check for project-scoped AI calls (reuses the projects module's
// PROJECT_REPOSITORY).

import { Inject, Injectable } from '@nestjs/common';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../../projects/domain/repositories/project.repository.interface';
import { NotProjectMemberError } from '../errors/ai.errors';

@Injectable()
export class AiAccessService {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
  ) {}

  async requireMember(projectId: string, userId: string): Promise<void> {
    const membership = await this.projects.findMembership(projectId, userId);
    if (!membership) throw new NotProjectMemberError();
  }
}
