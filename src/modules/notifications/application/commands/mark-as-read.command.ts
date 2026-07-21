// src/modules/notifications/application/commands/mark-as-read.command.ts
export class MarkAsReadCommand {
  constructor(
    public readonly userId: string,
    public readonly notificationId: string,
  ) {}
}
