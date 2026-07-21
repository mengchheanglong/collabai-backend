// src/modules/projects/application/errors/project.errors.ts
//
// Domain-specific project errors. Each carries a stable `code`; ProjectExceptionFilter
// maps `code` -> HTTP status. Handlers throw these instead of HttpExceptions so the
// application layer stays transport-agnostic (mirrors the auth module's error pattern).

export abstract class ProjectError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Project does not exist (or the caller is not allowed to know it exists). */
export class ProjectNotFoundError extends ProjectError {
  readonly code = 'PROJECT_NOT_FOUND';
  constructor(message = 'Project not found') {
    super(message);
  }
}

/** Caller is authenticated but not a member of the project. */
export class NotProjectMemberError extends ProjectError {
  readonly code = 'NOT_PROJECT_MEMBER';
  constructor(message = 'You are not a member of this project') {
    super(message);
  }
}

/** Caller is a member but lacks the role required for the action. */
export class InsufficientProjectPermissionError extends ProjectError {
  readonly code = 'INSUFFICIENT_PROJECT_PERMISSION';
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
  }
}

/** The owner already has a project with this name (unique [ownerId, name]). */
export class DuplicateProjectNameError extends ProjectError {
  readonly code = 'DUPLICATE_PROJECT_NAME';
  constructor(message = 'You already have a project with this name') {
    super(message);
  }
}

/** Tried to add a user who is already a member. */
export class MemberAlreadyExistsError extends ProjectError {
  readonly code = 'MEMBER_ALREADY_EXISTS';
  constructor(message = 'User is already a member of this project') {
    super(message);
  }
}

/** Referenced membership does not exist. */
export class MemberNotFoundError extends ProjectError {
  readonly code = 'MEMBER_NOT_FOUND';
  constructor(message = 'Member not found in this project') {
    super(message);
  }
}

/** The user being invited does not exist. */
export class InviteeNotFoundError extends ProjectError {
  readonly code = 'INVITEE_NOT_FOUND';
  constructor(message = 'No user found with that email') {
    super(message);
  }
}

/** Provided role is not one of owner/admin/member/viewer. */
export class InvalidProjectRoleError extends ProjectError {
  readonly code = 'INVALID_PROJECT_ROLE';
  constructor(message = 'Invalid project role') {
    super(message);
  }
}

/**
 * Blocked because it would leave the project with no owner (e.g. the sole owner
 * demoting or removing themselves).
 */
export class LastOwnerError extends ProjectError {
  readonly code = 'LAST_OWNER';
  constructor(
    message = 'The project must have at least one owner. Assign another owner first.',
  ) {
    super(message);
  }
}
