// src/modules/documents/application/commands/delete-document.handler.ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeleteDocumentCommand } from './delete-document.command';
import {
  DOCUMENT_REPOSITORY,
  type IDocumentRepository,
} from '../../domain/repositories/document.repository.interface';
import {
  PROJECT_REPOSITORY,
  type IProjectRepository,
} from '../../../projects/domain/repositories/project.repository.interface';
import { DocumentForbiddenError, DocumentNotFoundError } from '../errors/document.errors';

@CommandHandler(DeleteDocumentCommand)
export class DeleteDocumentHandler implements ICommandHandler<DeleteDocumentCommand> {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly repo: IDocumentRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projectRepo: IProjectRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(command: DeleteDocumentCommand): Promise<void> {
    const doc = await this.repo.findById(command.documentId);
    if (!doc) throw new DocumentNotFoundError();

    const membership = await this.projectRepo.findMembership(
      doc.projectId,
      command.userId,
    );
    if (!membership || !membership.isActive) {
      throw new DocumentForbiddenError();
    }

    const projectId = doc.projectId;
    await this.repo.delete(command.documentId);

    this.events.emit('document.deleted', {
      projectId,
      documentId: command.documentId,
      actorId: command.userId,
    });
  }
}
