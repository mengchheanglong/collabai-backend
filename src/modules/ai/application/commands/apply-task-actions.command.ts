// src/modules/ai/application/commands/apply-task-actions.command.ts

export class ApplyTaskActionsCommand {
  constructor(
    public readonly userId: string,
    public readonly planId: string,
    public readonly actionIds?: string[],
  ) {}
}
