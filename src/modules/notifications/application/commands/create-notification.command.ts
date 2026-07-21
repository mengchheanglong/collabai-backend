// src/modules/notifications/application/commands/create-notification.command.ts
// Internal command — dispatched by event listeners, not exposed via HTTP.
import { NotificationType } from '../../domain/value-objects/notification-type.value-object';

export class CreateNotificationCommand {
  constructor(
    public readonly userId: string,
    public readonly type: NotificationType,
    public readonly title: string,
    public readonly message: string,
    public readonly relatedEntityType?: string,
    public readonly relatedEntityId?: string,
  ) {}
}
