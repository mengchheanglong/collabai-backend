// src/modules/projects/application/commands/update-member-role.command.ts
import { ProjectRole } from '../../domain/value-objects/project-role.value-object';

export class UpdateMemberRoleCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly projectId: string,
    public readonly targetUserId: string,
    public readonly role: ProjectRole,
  ) {}
}
