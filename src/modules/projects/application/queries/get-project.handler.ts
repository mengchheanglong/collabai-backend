// src/modules/projects/application/queries/get-project.handler.ts
// Fetch one project with members. Caller must be a member.

import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetProjectQuery } from './get-project.query';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
  ProjectView,
} from '../../domain/repositories/project.repository.interface';
import {
  NotProjectMemberError,
  ProjectNotFoundError,
} from '../errors/project.errors';

@QueryHandler(GetProjectQuery)
export class GetProjectHandler implements IQueryHandler<GetProjectQuery> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
  ) {}

  async execute(query: GetProjectQuery): Promise<ProjectView> {
    const membership = await this.repo.findMembership(
      query.projectId,
      query.userId,
    );
    if (!membership) {
      // Distinguish "no such project" from "exists but you're not in it".
      const exists = await this.repo.findById(query.projectId);
      if (!exists) throw new ProjectNotFoundError();
      throw new NotProjectMemberError();
    }

    const view = await this.repo.findViewById(query.projectId);
    if (!view) throw new ProjectNotFoundError();
    return view;
  }
}
