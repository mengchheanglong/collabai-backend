// src/modules/documents/application/queries/get-documents.handler.ts
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetDocumentsQuery } from './get-documents.query';
import {
  DOCUMENT_REPOSITORY,
  type IDocumentRepository,
  DocumentView,
} from '../../domain/repositories/document.repository.interface';
import {
  PROJECT_REPOSITORY,
  type IProjectRepository,
} from '../../../projects/domain/repositories/project.repository.interface';
import { DocumentForbiddenError } from '../errors/document.errors';

@QueryHandler(GetDocumentsQuery)
export class GetDocumentsHandler implements IQueryHandler<GetDocumentsQuery> {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly repo: IDocumentRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projectRepo: IProjectRepository,
  ) {}

  async execute(query: GetDocumentsQuery): Promise<DocumentView[]> {
    const membership = await this.projectRepo.findMembership(
      query.projectId,
      query.userId,
    );
    if (!membership || !membership.isActive) {
      throw new DocumentForbiddenError();
    }

    return this.repo.listByProjectId(query.projectId);
  }
}
