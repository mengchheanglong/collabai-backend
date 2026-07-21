// src/modules/comments/application/commands/edit-comment.command.ts
export class EditCommentCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly commentId: string,
    public readonly body: string,
  ) {}
}
