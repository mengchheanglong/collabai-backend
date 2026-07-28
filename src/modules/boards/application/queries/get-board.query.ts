// src/modules/boards/application/queries/get-board.query.ts
export class GetBoardQuery {
  constructor(
    public readonly userId: string,
    public readonly boardId: string,
    public readonly includeTasks: boolean = false,
  ) {}
}
