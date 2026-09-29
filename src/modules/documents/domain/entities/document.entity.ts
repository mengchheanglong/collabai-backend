// src/modules/documents/domain/entities/document.entity.ts
export interface DocumentProps {
  id: string;
  projectId: string;
  title: string;
  content: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentProps {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  createdById: string;
}

export class DocumentEntity {
  id: string;
  projectId: string;
  title: string;
  content: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;

  private constructor(props: DocumentProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.title = props.title;
    this.content = props.content;
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
      createdById: props.createdById,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: DocumentProps): DocumentEntity {
    return new DocumentEntity(props);
  }

  update(fields: { title?: string; content?: string }): void {
    if (fields.title !== undefined) {
      this.title = fields.title.trim();
    }
    if (fields.content !== undefined) {
      this.content = fields.content;
    }
    this.updatedAt = new Date();
  }
}
