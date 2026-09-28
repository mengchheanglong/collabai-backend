// src/modules/projects/application/queries/list-invitations.query.ts

export class ListInvitationsQuery {
  constructor(
    public readonly actingUserId: string,
    public readonly projectId: string,
  ) {}
}
