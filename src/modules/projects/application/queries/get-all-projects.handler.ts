// src/modules/projects/application/queries/get-all-projects.handler.ts
// List the projects the current user belongs to (paginated, optional name search).

import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetAllProjectsQuery } from './get-all-projects.query';
import {
  type IProjectRepository,
  Paginated,
  PROJECT_REPOSITORY,
  ProjectView,
} from '../../domain/repositories/project.repository.interface';

@QueryHandler(GetAllProjectsQuery)
export class GetAllProjectsHandler
  implements IQueryHandler<GetAllProjectsQuery>
{
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
  ) {}

  async execute(query: GetAllProjectsQuery): Promise<Paginated<ProjectView>> {
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    return this.repo.listForUser(query.userId, { q: query.q, page, limit });
  }
}
