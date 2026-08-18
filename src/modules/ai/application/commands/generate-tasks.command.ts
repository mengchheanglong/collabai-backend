// src/modules/ai/application/commands/generate-tasks.command.ts
export class GenerateTasksCommand {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
    public readonly prompt: string,
    public readonly count: number = 5,
  ) {}
}
