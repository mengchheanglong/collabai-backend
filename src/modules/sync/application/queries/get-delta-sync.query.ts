// src/modules/sync/application/queries/get-delta-sync.query.ts

export class GetDeltaSyncQuery {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
    public readonly since?: Date,
  ) {}
}
