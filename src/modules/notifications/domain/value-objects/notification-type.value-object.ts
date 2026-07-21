// src/modules/notifications/domain/value-objects/notification-type.value-object.ts
//
// The kinds of notification the system produces. Stored as a plain string column; this VO
// is the single source of allowed values.

export type NotificationType = 'task_assigned' | 'comment_mention';

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'task_assigned',
  'comment_mention',
];

export const NotificationTypes = {
  isValid(value: string): value is NotificationType {
    return (NOTIFICATION_TYPES as readonly string[]).includes(value);
  },
} as const;
