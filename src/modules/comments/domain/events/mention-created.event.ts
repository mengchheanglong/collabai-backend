// src/modules/comments/domain/events/mention-created.event.ts
// Emitted once per mentioned project member. Consumed by the notifications module later.
export class MentionCreatedEvent {
  static readonly eventName = 'comment.mention.created';
  constructor(
    public readonly mentionedUserId: string,
    public readonly commentId: string,
    public readonly taskId: string,
    public readonly projectId: string,
    public readonly authorId: string,
  ) {}
}
