// src/modules/projects/application/queries/list-invitations.handler.ts

import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListInvitationsQuery } from './list-invitations.query';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
  ProjectInvitationView,
} from '../../domain/repositories/project.repository.interface';
import { NotProjectMemberError } from '../errors/project.errors';

@QueryHandler(ListInvitationsQuery)
export class ListInvitationsHandler
  implements IQueryHandler<ListInvitationsQuery>
{
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
  ) {}

  async execute(query: ListInvitationsQuery): Promise<ProjectInvitationView[]> {
    const actor = await this.repo.findMembership(
      query.projectId,
      query.actingUserId,
    );
    if (!actor) throw new NotProjectMemberError();

    return this.repo.listInvitations(query.projectId);
  }
}
