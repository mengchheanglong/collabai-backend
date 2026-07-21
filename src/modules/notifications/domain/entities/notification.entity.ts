// src/modules/notifications/domain/entities/notification.entity.ts
//
// A notification delivered to a single user. Maps to the Prisma `Notification` model
// (`message`→body, `isRead`→read). The originating entity is recorded generically via
// `relatedEntityType`/`relatedEntityId` (e.g. type 'task', the task id).

import { NotificationType } from '../value-objects/notification-type.value-object';

export interface NotificationProps {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationProps {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

export class NotificationEntity {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;

  private constructor(props: NotificationProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.type = props.type;
    this.title = props.title;
    this.message = props.message;
    this.relatedEntityType = props.relatedEntityType;
    this.relatedEntityId = props.relatedEntityId;
    this.isRead = props.isRead;
    this.readAt = props.readAt;
    this.createdAt = props.createdAt;
  }

  static create(props: CreateNotificationProps): NotificationEntity {
    return new NotificationEntity({
      id: props.id,
      userId: props.userId,
      type: props.type,
      title: props.title,
      message: props.message,
      relatedEntityType: props.relatedEntityType ?? null,
      relatedEntityId: props.relatedEntityId ?? null,
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: NotificationProps): NotificationEntity {
    return new NotificationEntity(props);
  }

  markRead(): void {
    if (this.isRead) return;
    this.isRead = true;
    this.readAt = new Date();
  }
}
