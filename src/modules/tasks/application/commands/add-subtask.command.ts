// src/modules/tasks/application/commands/add-subtask.command.ts
export class AddSubtaskCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly taskId: string,
    public readonly title: string,
  ) {}
}
