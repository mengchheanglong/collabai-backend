// src/modules/ai/application/commands/propose-task-actions.command.ts

export class ProposeTaskActionsCommand {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
    public readonly request: string,
  ) {}
}
