// src/modules/projects/application/commands/accept-invitation.command.ts

export class AcceptInvitationCommand {
  constructor(
    public readonly userId: string,
    public readonly token: string,
  ) {}
}
