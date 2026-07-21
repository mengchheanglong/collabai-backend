// src/modules/comments/application/commands/add-comment.command.ts
export class AddCommentCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly taskId: string,
    public readonly body: string,
  ) {}
}
