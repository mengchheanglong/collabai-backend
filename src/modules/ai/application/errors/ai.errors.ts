// src/modules/ai/application/errors/ai.errors.ts
//
// Domain-specific AI errors. Each carries a stable `code`; the exception filter maps
// `code` -> HTTP status.

export abstract class AiError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Caller is not a member of the project the AI call is scoped to. */
export class NotProjectMemberError extends AiError {
  readonly code = 'NOT_PROJECT_MEMBER';
  constructor(message = 'You are not a member of this project') {
    super(message);
  }
}

/** The task referenced by an AI call does not exist. */
export class TaskNotFoundError extends AiError {
  readonly code = 'TASK_NOT_FOUND';
  constructor(message = 'Task not found') {
    super(message);
  }
}

/** The AI provider failed or is not configured. */
export class AiUnavailableError extends AiError {
  readonly code = 'AI_UNAVAILABLE';
  constructor(message = 'The AI service is currently unavailable') {
    super(message);
  }
}
