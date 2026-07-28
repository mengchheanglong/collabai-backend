// src/modules/projects/application/queries/get-project-analytics-summary.query.ts
export class GetProjectAnalyticsSummaryQuery {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
  ) {}
}
