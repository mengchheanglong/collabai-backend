// src/modules/notifications/application/commands/unsubscribe-push.command.ts

export class UnsubscribePushCommand {
  constructor(
    public readonly userId: string,
    public readonly endpoint: string,
  ) {}
}
