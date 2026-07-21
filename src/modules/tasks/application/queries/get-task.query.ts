// src/modules/tasks/application/queries/get-task.query.ts
export class GetTaskQuery {
  constructor(
    public readonly userId: string,
    public readonly taskId: string,
  ) {}
}
