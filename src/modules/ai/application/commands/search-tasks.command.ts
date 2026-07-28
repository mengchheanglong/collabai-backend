// src/modules/ai/application/commands/search-tasks.command.ts
export class SearchTasksCommand {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
    public readonly query: string,
  ) {}
}
