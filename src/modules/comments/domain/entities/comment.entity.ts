// src/modules/comments/domain/entities/comment.entity.ts
//
// Comment on a task. Maps to the Prisma `Comment` model (`content`→body, `userId`→authorId).
// The project is derived from the task (Comment has no projectId column), so it is not part
// of this entity. `editedAt` is stamped on the first and subsequent edits.

export interface CommentProps {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}

export interface CreateCommentProps {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
}

export class CommentEntity {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;

  private constructor(props: CommentProps) {
    this.id = props.id;
    this.taskId = props.taskId;
    this.authorId = props.authorId;
    this.body = props.body;
    this.createdAt = props.createdAt;
    this.editedAt = props.editedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: CreateCommentProps): CommentEntity {
    return new CommentEntity({
      id: props.id,
      taskId: props.taskId,
      authorId: props.authorId,
      body: props.body.trim(),
      createdAt: new Date(),
      editedAt: null,
      deletedAt: null,
    });
  }

  static fromPersistence(props: CommentProps): CommentEntity {
    return new CommentEntity(props);
  }

  edit(body: string): void {
    this.body = body.trim();
    this.editedAt = new Date();
  }
}
