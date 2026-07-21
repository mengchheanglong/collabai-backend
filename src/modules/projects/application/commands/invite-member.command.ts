// src/modules/projects/application/commands/invite-member.command.ts
import { ProjectRole } from '../../domain/value-objects/project-role.value-object';

export class InviteMemberCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly projectId: string,
    public readonly email: string,
    public readonly role: Exclude<ProjectRole, 'owner'> = 'member',
  ) {}
}
