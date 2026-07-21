// src/modules/comments/application/commands/delete-comment.command.ts
export class DeleteCommentCommand {
  constructor(
    public readonly actingUserId: string,
    public readonly commentId: string,
  ) {}
}
