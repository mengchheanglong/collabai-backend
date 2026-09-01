// src/modules/notifications/application/commands/send-push-notification.command.ts

export class SendPushNotificationCommand {
  constructor(
    public readonly userId: string,
    public readonly title: string,
    public readonly body: string,
    public readonly url?: string,
    public readonly data?: Record<string, any>,
  ) {}
}
