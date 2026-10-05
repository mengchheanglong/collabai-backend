// src/modules/projects/application/commands/accept-invitation.command.ts

export class AcceptInvitationCommand {
  constructor(
    public readonly userId: string,
    public readonly token: string,
    /** Email of the signed-in user — must match the invited address. */
    public readonly userEmail: string,
  ) {}
}
