// src/modules/projects/application/queries/get-invitation.handler.ts

import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetInvitationQuery } from './get-invitation.query';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';

export interface PublicInvitationDetails {
  id: string;
  projectId: string;
  email: string;
  role: string;
  projectName: string;
  projectDescription: string | null;
  inviterName?: string;
  isExpired: boolean;
}

@QueryHandler(GetInvitationQuery)
export class GetInvitationHandler implements IQueryHandler<GetInvitationQuery> {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repo: IProjectRepository,
  ) {}

  async execute(query: GetInvitationQuery): Promise<PublicInvitationDetails> {
    const inv = await this.repo.findInvitationByToken(query.token);
    if (!inv) {
      throw new NotFoundException('Invitation not found or has expired');
    }

    const isExpired = new Date() > new Date(inv.expiresAt);
    return {
      id: inv.id,
      projectId: inv.projectId,
      email: inv.email,
      role: inv.role,
      projectName: inv.project.name,
      projectDescription: inv.project.description,
      inviterName: inv.inviterName,
      isExpired,
    };
  }
}
