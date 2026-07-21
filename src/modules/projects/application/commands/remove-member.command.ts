// src/modules/projects/application/commands/remove-member.command.ts
export class RemoveMemberCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly projectId: string,
    public readonly targetUserId: string,
  ) {}
}
