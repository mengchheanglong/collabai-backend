// src/modules/documents/domain/entities/document.entity.ts
export interface DocumentAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  uploadedAt: string;
}

export interface DocumentProps {
  id: string;
  projectId: string;
  title: string;
  content: string;
  attachments?: DocumentAttachment[];
  fileType?: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentProps {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  attachments?: DocumentAttachment[];
  fileType?: string | null;
  createdById: string;
}

export class DocumentEntity {
  id: string;
  projectId: string;
  title: string;
  content: string;
  attachments: DocumentAttachment[];
  fileType: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;

  private constructor(props: DocumentProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.title = props.title;
    this.content = props.content;
    this.attachments = props.attachments ?? [];
    this.fileType = props.fileType ?? null;
    this.createdById = props.createdById;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: CreateDocumentProps): DocumentEntity {
    const now = new Date();
    return new DocumentEntity({
      id: props.id,
      projectId: props.projectId,
      title: props.title.trim(),
      content: props.content ?? '',
      attachments: props.attachments ?? [],
      fileType: props.fileType ?? null,
      createdById: props.createdById,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: DocumentProps): DocumentEntity {
    return new DocumentEntity(props);
  }

  update(fields: {
    title?: string;
    content?: string;
    attachments?: DocumentAttachment[];
    fileType?: string | null;
  }): void {
    if (fields.title !== undefined) {
      this.title = fields.title.trim();
    }
    if (fields.content !== undefined) {
      this.content = fields.content;
    }
    if (fields.attachments !== undefined) {
      this.attachments = fields.attachments;
    }
    if (fields.fileType !== undefined) {
      this.fileType = fields.fileType;
    }
    this.updatedAt = new Date();
  }
}
