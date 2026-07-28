// src/modules/boards/application/commands/delete-board.command.ts
export class DeleteBoardCommand {
  constructor(
    public readonly userId: string,
    public readonly boardId: string,
  ) {}
}
