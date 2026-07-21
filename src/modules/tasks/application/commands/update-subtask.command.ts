// src/modules/tasks/application/commands/update-subtask.command.ts
export class UpdateSubtaskCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly taskId: string,
    public readonly subtaskId: string,
    public readonly title?: string,
    public readonly done?: boolean,
  ) {}
}
