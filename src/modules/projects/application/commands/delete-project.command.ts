// src/modules/projects/application/commands/delete-project.command.ts
export class DeleteProjectCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly projectId: string,
  ) {}
}
