// src/modules/tasks/application/errors/task.errors.ts
//
// Domain-specific task errors. Each carries a stable `code`; TaskExceptionFilter maps
// `code` -> HTTP status. Mirrors the auth/projects error pattern.

import {
  ASSIGN_FORBIDDEN_MESSAGE,
  VIEW_ONLY_MESSAGE,
} from '../../../projects/domain/value-objects/project-role.value-object';

export abstract class TaskError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Task does not exist (or the caller cannot access its project). */
export class TaskNotFoundError extends TaskError {
  readonly code = 'TASK_NOT_FOUND';
  constructor(message = 'Task not found') {
    super(message);
  }
}

/** Subtask does not exist on the task. */
export class SubtaskNotFoundError extends TaskError {
  readonly code = 'SUBTASK_NOT_FOUND';
  constructor(message = 'Subtask not found') {
    super(message);
  }
}

/** Caller is not a member of the task's project. */
export class NotProjectMemberError extends TaskError {
  readonly code = 'NOT_PROJECT_MEMBER';
  constructor(message = 'You are not a member of this project') {
    super(message);
  }
}

/** Caller is a member but a viewer — content is read-only for viewers. */
export class TaskWriteForbiddenError extends TaskError {
  readonly code = 'TASK_WRITE_FORBIDDEN';
  constructor(
    message = VIEW_ONLY_MESSAGE,
  ) {
    super(message);
  }
}

/** The requested assignee is not a member of the project. */
export class AssigneeNotMemberError extends TaskError {
  readonly code = 'ASSIGNEE_NOT_MEMBER';
  constructor(message = 'The assignee must be a member of the project') {
    super(message);
  }
}

/** Provided status/priority value is not valid. */
export class InvalidTaskFieldError extends TaskError {
  readonly code = 'INVALID_TASK_FIELD';
  constructor(message = 'Invalid task field value') {
    super(message);
  }
}

/** A member tried to assign a task to someone else (only owners/admins may). */
export class TaskAssignForbiddenError extends TaskError {
  readonly code = 'TASK_ASSIGN_FORBIDDEN';
  constructor(message = ASSIGN_FORBIDDEN_MESSAGE) {
    super(message);
  }
}
