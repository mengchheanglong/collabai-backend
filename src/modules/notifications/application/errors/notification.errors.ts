// src/modules/notifications/application/errors/notification.errors.ts
//
// Domain-specific notification errors. Each carries a stable `code`; the exception filter
// maps `code` -> HTTP status.

export abstract class NotificationError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Notification does not exist. */
export class NotificationNotFoundError extends NotificationError {
  readonly code = 'NOTIFICATION_NOT_FOUND';
  constructor(message = 'Notification not found') {
    super(message);
  }
}

/** The notification belongs to a different user. */
export class NotificationForbiddenError extends NotificationError {
  readonly code = 'NOTIFICATION_FORBIDDEN';
  constructor(message = 'This notification does not belong to you') {
    super(message);
  }
}
