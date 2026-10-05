// src/modules/activity/domain/activity-message.ts
//
// Pure helpers for the project activity feed: the job shape queued on `collabai.activity`
// and the human-readable line stored with each Activity row
// (e.g. "Dara created task Build login page").

export interface ActivityLogJob {
  /** Pre-generated Activity id — makes redelivered jobs idempotent. */
  id: string;
  projectId: string;
  actorId: string;
  entityType: string; // task | comment | document
  entityId?: string;
  action: string; // created | updated | moved | deleted
  oldValue?: string;
  newValue?: string;
  /** Display name of the affected item (task/document title), when known at publish time. */
  subject?: string;
  /** Resolve `subject` from this task's title in the worker (comments, moves). */
  subjectTaskId?: string;
}

export function activityType(entityType: string, action: string): string {
  return `${entityType}.${action}`;
}

function humanizeStatus(status: string | undefined): string {
  return (status ?? 'unknown').replace(/_/g, ' ');
}

export function buildActivityMessage(input: {
  actorName: string;
  entityType: string;
  action: string;
  subject?: string;
  oldValue?: string | null;
  newValue?: string | null;
}): string {
  const { actorName, entityType, action } = input;
  const subject = input.subject?.trim();

  switch (activityType(entityType, action)) {
    case 'task.created':
      return `${actorName} created task ${subject ?? 'a task'}`;
    case 'task.updated':
      return `${actorName} updated task ${subject ?? 'a task'}`;
    case 'task.moved':
      return `${actorName} moved task ${subject ?? 'a task'} from ${humanizeStatus(input.oldValue ?? undefined)} to ${humanizeStatus(input.newValue ?? undefined)}`;
    case 'task.deleted':
      return `${actorName} deleted task ${subject ?? 'a task'}`;
    case 'comment.created':
      return subject
        ? `${actorName} commented on ${subject}`
        : `${actorName} added a comment`;
    case 'comment.deleted':
      return subject
        ? `${actorName} deleted a comment on ${subject}`
        : `${actorName} deleted a comment`;
    case 'document.created':
    case 'document.updated':
    case 'document.deleted':
      return `${actorName} ${action} document ${subject ?? 'a document'}`;
    default:
      return `${actorName} ${action} ${entityType}${subject ? ` ${subject}` : ''}`;
  }
}
