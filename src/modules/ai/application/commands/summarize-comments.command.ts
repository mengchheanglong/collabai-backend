// src/modules/ai/application/commands/summarize-comments.command.ts
export class SummarizeCommentsCommand {
  constructor(
    public readonly userId: string,
    public readonly taskId: string,
  ) {}
}
