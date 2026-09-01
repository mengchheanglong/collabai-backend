// src/modules/notifications/application/commands/subscribe-push.command.ts

export class SubscribePushCommand {
  constructor(
    public readonly userId: string,
    public readonly endpoint: string,
    public readonly p256dh: string,
    public readonly auth: string,
    public readonly userAgent?: string | null,
  ) {}
}
