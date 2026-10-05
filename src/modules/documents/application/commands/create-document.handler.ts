// src/modules/documents/application/commands/create-document.handler.ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { CreateDocumentCommand } from './create-document.command';
import {
  DOCUMENT_REPOSITORY,
  type IDocumentRepository,
  DocumentView,
} from '../../domain/repositories/document.repository.interface';
import {
  PROJECT_REPOSITORY,
  type IProjectRepository,
} from '../../../projects/domain/repositories/project.repository.interface';
import {
  ProjectRoles,
  VIEW_ONLY_MESSAGE,
} from '../../../projects/domain/value-objects/project-role.value-object';
import { DocumentEntity } from '../../domain/entities/document.entity';
import { DocumentForbiddenError, DocumentNotFoundError } from '../errors/document.errors';

@CommandHandler(CreateDocumentCommand)
export class CreateDocumentHandler implements ICommandHandler<CreateDocumentCommand> {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly repo: IDocumentRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projectRepo: IProjectRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(command: CreateDocumentCommand): Promise<DocumentView> {
    const membership = await this.projectRepo.findMembership(
      command.projectId,
      command.userId,
    );
    if (!membership || !membership.isActive) {
      throw new DocumentForbiddenError();
    }
    if (!ProjectRoles.canWriteContent(membership.role)) {
      throw new DocumentForbiddenError(VIEW_ONLY_MESSAGE);
    }

    const derivedTitle =
      command.title?.trim() ||
      command.attachments?.[0]?.name ||
      (command.fileType ? `Document.${command.fileType}` : 'Untitled document');

    const doc = DocumentEntity.create({
      id: uuidv4(),
      projectId: command.projectId,
      title: derivedTitle,
      content: command.content ?? '',
      attachments: command.attachments,
      fileType: command.fileType,
      createdById: command.userId,
    });

    await this.repo.create(doc);

    const view = await this.repo.findViewById(doc.id);
    if (!view) throw new DocumentNotFoundError();

    this.events.emit('document.created', {
      projectId: doc.projectId,
      documentId: doc.id,
      actorId: command.userId,
      document: view,
    });

    return view;
  }
}
