// src/modules/tasks/application/commands/delete-task.command.ts
export class DeleteTaskCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly taskId: string,
  ) {}
}
