// src/modules/projects/application/commands/resend-invitation.command.ts

export class ResendInvitationCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly projectId: string,
    public readonly invitationId: string,
  ) {}
}
