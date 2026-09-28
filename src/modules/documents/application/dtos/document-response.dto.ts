// src/modules/documents/application/dtos/document-response.dto.ts
import { DocumentView } from '../../domain/repositories/document.repository.interface';

export interface DocumentResponseDto {
  _id: string;
  id: string;
  projectId: string;
  title: string;
  content: string;
  createdById: string;
  version: number;
  canEdit?: boolean;
  creator?: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export function toDocumentResponse(view: DocumentView): DocumentResponseDto {
  return {
    _id: view.id,
    id: view.id,
    projectId: view.projectId,
    title: view.title,
    content: view.content,
    createdById: view.createdById,
    version: Math.floor(view.updatedAt.getTime() / 1000),
    canEdit: true,
    creator: view.createdById
      ? {
          id: view.createdById,
          name: view.creatorName ?? null,
          email: view.creatorEmail ?? null,
          avatarUrl: view.creatorAvatarUrl ?? null,
        }
      : null,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}
