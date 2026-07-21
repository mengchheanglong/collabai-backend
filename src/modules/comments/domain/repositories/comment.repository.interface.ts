// src/modules/comments/domain/repositories/comment.repository.interface.ts
//
// Port for comment persistence. Bound to COMMENT_REPOSITORY in comments.module.ts.
// `CommentView` embeds the author (joined User) and the derived projectId (from the task).

import { CommentEntity } from '../entities/comment.entity';

export const COMMENT_REPOSITORY = Symbol('COMMENT_REPOSITORY');

export interface CommentAuthorView {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface CommentView {
  id: string;
  taskId: string;
  projectId: string;
  authorId: string;
  author: CommentAuthorView;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
}

export interface ICommentRepository {
  /** projectId of the (non-deleted) task, or null if the task doesn't exist. */
  getTaskProjectId(taskId: string): Promise<string | null>;

  create(comment: CommentEntity): Promise<void>;
  findById(id: string): Promise<CommentEntity | null>;
  findViewById(id: string): Promise<CommentView | null>;
  listForTask(taskId: string): Promise<CommentView[]>;
  update(comment: CommentEntity): Promise<void>;
  delete(id: string): Promise<void>;
}
