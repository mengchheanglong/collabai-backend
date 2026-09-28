// src/modules/projects/application/commands/revoke-invitation.command.ts

export class RevokeInvitationCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly projectId: string,
    public readonly invitationId: string,
  ) {}
}
