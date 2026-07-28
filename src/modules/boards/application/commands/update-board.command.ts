// src/modules/boards/application/commands/update-board.command.ts
export class UpdateBoardCommand {
  constructor(
    public readonly userId: string,
    public readonly boardId: string,
    public readonly patch: { name?: string; description?: string | null },
  ) {}
}
