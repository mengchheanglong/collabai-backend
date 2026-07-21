// src/modules/projects/application/queries/list-members.query.ts
export class ListMembersQuery {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
  ) {}
}
