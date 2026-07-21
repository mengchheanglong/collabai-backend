// src/modules/projects/application/queries/get-all-projects.query.ts
export class GetAllProjectsQuery {
  constructor(
    public readonly userId: string,
    public readonly page: number = 1,
    public readonly limit: number = 20,
    public readonly q?: string,
  ) {}
}
