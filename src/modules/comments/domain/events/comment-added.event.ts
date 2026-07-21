// src/modules/comments/domain/events/comment-added.event.ts
export class CommentAddedEvent {
  static readonly eventName = 'comment.added';
  constructor(
    public readonly commentId: string,
    public readonly taskId: string,
    public readonly projectId: string,
    public readonly authorId: string,
  ) {}
}
