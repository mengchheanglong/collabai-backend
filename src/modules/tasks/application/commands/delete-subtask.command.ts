// src/modules/tasks/application/commands/delete-subtask.command.ts
export class DeleteSubtaskCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly taskId: string,
    public readonly subtaskId: string,
  ) {}
}
