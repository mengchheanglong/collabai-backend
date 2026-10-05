// src/modules/auth/domain/events/email-verified.event.ts
//
// Emitted after Flow 2 (email verification succeeds) — the user has proven they own
// `email`. The projects module uses it to turn pending invitations into memberships.

export class EmailVerifiedEvent {
  static readonly eventName = 'auth.email.verified';

  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}
