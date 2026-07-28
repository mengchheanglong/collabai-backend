// src/modules/boards/application/commands/create-board.command.ts
export class CreateBoardCommand {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
    public readonly name: string,
    public readonly description?: string | null,
  ) {}
}
