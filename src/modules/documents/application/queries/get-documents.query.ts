// src/modules/documents/application/queries/get-documents.query.ts
export class GetDocumentsQuery {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
  ) {}
}
