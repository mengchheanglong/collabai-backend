// src/modules/users/application/queries/search-users.query.ts
export class SearchUsersQuery {
  constructor(
    public readonly term: string,
    public readonly limit: number,
  ) {}
}
