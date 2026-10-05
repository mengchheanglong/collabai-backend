// src/modules/documents/application/commands/update-document.handler.ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UpdateDocumentCommand } from './update-document.command';
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
import {
  DocumentConflictError,
  DocumentForbiddenError,
  DocumentNotFoundError,
} from '../errors/document.errors';

@CommandHandler(UpdateDocumentCommand)
export class UpdateDocumentHandler implements ICommandHandler<UpdateDocumentCommand> {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly repo: IDocumentRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projectRepo: IProjectRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(command: UpdateDocumentCommand): Promise<DocumentView> {
    const doc = await this.repo.findById(command.documentId);
    if (!doc) throw new DocumentNotFoundError();

    const membership = await this.projectRepo.findMembership(
      doc.projectId,
      command.userId,
    );
    if (!membership || !membership.isActive || !ProjectRoles.canWriteContent(membership.role)) {
      throw new DocumentForbiddenError();
    }

    if (command.expectedVersion !== undefined) {
      const currentVersion = Math.floor(doc.updatedAt.getTime() / 1000);
      if (command.expectedVersion !== currentVersion) {
        throw new DocumentConflictError();
      }
    }

    doc.update(command.fields);
    await this.repo.update(doc);

    const view = await this.repo.findViewById(doc.id);
    if (!view) throw new DocumentNotFoundError();

    this.events.emit('document.updated', {
      projectId: doc.projectId,
      documentId: doc.id,
      actorId: command.userId,
      document: view,
    });

    return view;
  }
}
