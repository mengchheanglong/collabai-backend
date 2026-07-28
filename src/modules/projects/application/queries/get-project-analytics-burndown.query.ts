// src/modules/projects/application/queries/get-project-analytics-burndown.query.ts
export class GetProjectAnalyticsBurndownQuery {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
    public readonly days: number = 14,
  ) {}
}
