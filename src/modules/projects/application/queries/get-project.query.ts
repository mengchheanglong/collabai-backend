// src/modules/projects/application/queries/get-project.query.ts
export class GetProjectQuery {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
  ) {}
}
