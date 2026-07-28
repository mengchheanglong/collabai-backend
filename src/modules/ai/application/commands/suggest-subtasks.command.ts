// src/modules/ai/application/commands/suggest-subtasks.command.ts
export class SuggestSubtasksCommand {
  constructor(
    public readonly userId: string,
    public readonly title: string,
    public readonly count: number,
    public readonly description?: string,
    public readonly projectId?: string,
  ) {}
}
