// src/modules/projects/application/queries/list-members.handler.ts
// List a project's members. Caller must be a member.

import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListMembersQuery } from './list-members.query';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
  ProjectMemberView,
} from '../../domain/repositories/project.repository.interface';
import { NotProjectMemberError } from '../errors/project.errors';

@QueryHandler(ListMembersQuery)
export class ListMembersHandler implements IQueryHandler<ListMembersQuery> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
  ) {}

  async execute(query: ListMembersQuery): Promise<ProjectMemberView[]> {
    const membership = await this.repo.findMembership(
      query.projectId,
      query.userId,
    );
    if (!membership) throw new NotProjectMemberError();
    return this.repo.listMembers(query.projectId);
  }
}
