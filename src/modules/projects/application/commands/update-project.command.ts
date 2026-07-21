// src/modules/projects/application/commands/update-project.command.ts
export interface UpdateProjectFields {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

export class UpdateProjectCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly projectId: string,
    public readonly fields: UpdateProjectFields,
  ) {}
}
