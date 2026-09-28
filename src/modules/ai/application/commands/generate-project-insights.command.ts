// src/modules/ai/application/commands/generate-project-insights.command.ts

export class GenerateProjectInsightsCommand {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
  ) {}
}
