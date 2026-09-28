// src/modules/documents/domain/repositories/document.repository.interface.ts
import { DocumentEntity } from '../entities/document.entity';

export const DOCUMENT_REPOSITORY = Symbol('DOCUMENT_REPOSITORY');

export interface DocumentView {
  id: string;
  projectId: string;
  title: string;
  content: string;
  createdById: string;
  creatorName?: string | null;
  creatorEmail?: string | null;
  creatorAvatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocumentRepository {
  findById(id: string): Promise<DocumentEntity | null>;
  findViewById(id: string): Promise<DocumentView | null>;
  listByProjectId(projectId: string): Promise<DocumentView[]>;
  create(doc: DocumentEntity): Promise<void>;
  update(doc: DocumentEntity): Promise<void>;
  delete(id: string): Promise<void>;
}
