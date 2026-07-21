// src/modules/projects/application/commands/create-project.command.ts
export class CreateProjectCommand {
  constructor(
    public readonly ownerId: string,
    public readonly name: string,
    public readonly description?: string,
    public readonly color?: string,
    public readonly icon?: string,
  ) {}
}
