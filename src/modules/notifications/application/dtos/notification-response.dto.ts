// src/modules/notifications/application/dtos/notification-response.dto.ts
// Mapper from NotificationEntity to API response shape (`message`→body, `isRead`→read;
// `taskId` surfaced when the related entity is a task).

import { NotificationEntity } from '../../domain/entities/notification.entity';
import { NotificationType } from '../../domain/value-objects/notification-type.value-object';

export interface NotificationResponse {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  taskId: string | null;
  createdAt: string;
}

export function toNotificationResponse(
  n: NotificationEntity,
): NotificationResponse {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    body: n.message,
    read: n.isRead,
    taskId: n.relatedEntityType === 'task' ? n.relatedEntityId : null,
    createdAt: n.createdAt.toISOString(),
  };
}
