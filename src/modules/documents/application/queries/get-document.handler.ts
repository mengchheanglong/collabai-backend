// src/modules/documents/application/queries/get-document.handler.ts
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetDocumentQuery } from './get-document.query';
import {
  DOCUMENT_REPOSITORY,
  type IDocumentRepository,
  DocumentView,
} from '../../domain/repositories/document.repository.interface';
import {
  PROJECT_REPOSITORY,
  type IProjectRepository,
} from '../../../projects/domain/repositories/project.repository.interface';
import { ProjectRoles } from '../../../projects/domain/value-objects/project-role.value-object';
import { DocumentForbiddenError, DocumentNotFoundError } from '../errors/document.errors';

@QueryHandler(GetDocumentQuery)
export class GetDocumentHandler implements IQueryHandler<GetDocumentQuery> {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly repo: IDocumentRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projectRepo: IProjectRepository,
  ) {}

  async execute(query: GetDocumentQuery): Promise<DocumentView & { canEdit: boolean }> {
    const view = await this.repo.findViewById(query.documentId);
    if (!view) throw new DocumentNotFoundError();

    const membership = await this.projectRepo.findMembership(
      view.projectId,
      query.userId,
    );
    if (!membership || !membership.isActive) {
      throw new DocumentForbiddenError();
    }

    const canEdit = ProjectRoles.canWriteContent(membership.role);
    return { ...view, canEdit };
  }
}
