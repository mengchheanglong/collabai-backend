// src/modules/documents/documents.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';

import { DOCUMENT_REPOSITORY } from './domain/repositories/document.repository.interface';
import { DocumentRepository } from './infrastructure/persistence/document.repository';

import { DocumentsController } from './presentation/controllers/documents.controller';

import { CreateDocumentHandler } from './application/commands/create-document.handler';
import { UpdateDocumentHandler } from './application/commands/update-document.handler';
import { DeleteDocumentHandler } from './application/commands/delete-document.handler';
import { GetDocumentsHandler } from './application/queries/get-documents.handler';
import { GetDocumentHandler } from './application/queries/get-document.handler';

const CommandHandlers = [
  CreateDocumentHandler,
  UpdateDocumentHandler,
  DeleteDocumentHandler,
];

const QueryHandlers = [GetDocumentsHandler, GetDocumentHandler];

@Module({
  imports: [CqrsModule, SharedModule, AuthModule, ProjectsModule],
  controllers: [DocumentsController],
  providers: [
    { provide: DOCUMENT_REPOSITORY, useClass: DocumentRepository },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [DOCUMENT_REPOSITORY],
})
export class DocumentsModule {}
