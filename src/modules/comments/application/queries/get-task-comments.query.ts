// src/modules/comments/application/queries/get-task-comments.query.ts
export class GetTaskCommentsQuery {
  constructor(
    public readonly userId: string,
    public readonly taskId: string,
  ) {}
}
