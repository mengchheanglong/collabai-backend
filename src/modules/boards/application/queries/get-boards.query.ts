// src/modules/boards/application/queries/get-boards.query.ts
export class GetBoardsQuery {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
  ) {}
}
