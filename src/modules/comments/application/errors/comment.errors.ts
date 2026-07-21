// src/modules/comments/application/errors/comment.errors.ts
//
// Domain-specific comment errors. Each carries a stable `code`; CommentExceptionFilter
// maps `code` -> HTTP status. Mirrors the auth/projects/tasks error pattern.

export abstract class CommentError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The task the comment targets does not exist. */
export class TaskNotFoundError extends CommentError {
  readonly code = 'TASK_NOT_FOUND';
  constructor(message = 'Task not found') {
    super(message);
  }
}

/** The comment does not exist. */
export class CommentNotFoundError extends CommentError {
  readonly code = 'COMMENT_NOT_FOUND';
  constructor(message = 'Comment not found') {
    super(message);
  }
}

/** Caller is not a member of the task's project. */
export class NotProjectMemberError extends CommentError {
  readonly code = 'NOT_PROJECT_MEMBER';
  constructor(message = 'You are not a member of this project') {
    super(message);
  }
}

/** Caller is a viewer — cannot post comments. */
export class CommentWriteForbiddenError extends CommentError {
  readonly code = 'COMMENT_WRITE_FORBIDDEN';
  constructor(message = 'You do not have permission to comment in this project') {
    super(message);
  }
}

/** Caller is neither the author nor a project moderator (owner/admin). */
export class CommentModerationForbiddenError extends CommentError {
  readonly code = 'COMMENT_MODERATION_FORBIDDEN';
  constructor(
    message = 'You can only edit or delete your own comments',
  ) {
    super(message);
  }
}
