// src/modules/activity/application/queries/list-project-activity.query.ts

export class ListProjectActivityQuery {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
    public readonly page: number,
    public readonly limit: number,
  ) {}
}
