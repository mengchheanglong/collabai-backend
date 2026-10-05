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
import { DocumentExtractorService } from '../services/document-extractor.service';

@CommandHandler(CreateDocumentCommand)
export class CreateDocumentHandler implements ICommandHandler<CreateDocumentCommand> {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly repo: IDocumentRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projectRepo: IProjectRepository,
    private readonly events: EventEmitter2,
    private readonly extractor: DocumentExtractorService = new DocumentExtractorService(),
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

    let content = command.content ?? '';

    // If attachments are provided, extract text from supported file types (PDF, Word, Text, Markdown)
    if (command.attachments && command.attachments.length > 0) {
      for (const att of command.attachments) {
        try {
          const extractedText = await this.extractor.extractFromAttachment(att);
          if (extractedText && extractedText.trim()) {
            const isPlaceholder =
              !content ||
              content.trim() === '' ||
              /^#\s+.*\n\nUploaded\s+(PDF|Word|file)\s+document:/i.test(content.trim());

            if (isPlaceholder) {
              content = `# ${derivedTitle}\n\n${extractedText.trim()}`;
            } else if (!content.includes(extractedText.slice(0, 100))) {
              content = `${content.trim()}\n\n---\n### Extracted File Content (${att.name})\n\n${extractedText.trim()}`;
            }
          }
        } catch {
          // Non-blocking extraction error
        }
      }
    }

    const doc = DocumentEntity.create({
      id: uuidv4(),
      projectId: command.projectId,
      title: derivedTitle,
      content,
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
