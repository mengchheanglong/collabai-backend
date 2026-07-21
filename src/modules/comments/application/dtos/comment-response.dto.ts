// src/modules/comments/application/dtos/comment-response.dto.ts
// Mapper from CommentView read model to API response shape.

import { CommentView } from '../../domain/repositories/comment.repository.interface';

export interface CommentResponse {
  id: string;
  taskId: string;
  projectId: string;
  authorId: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  body: string;
  createdAt: string;
  editedAt: string | null;
}

export function toCommentResponse(c: CommentView): CommentResponse {
  return {
    id: c.id,
    taskId: c.taskId,
    projectId: c.projectId,
    authorId: c.authorId,
    author: {
      id: c.author.id,
      name: c.author.name,
      email: c.author.email,
      avatarUrl: c.author.avatarUrl,
    },
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt ? c.editedAt.toISOString() : null,
  };
}
