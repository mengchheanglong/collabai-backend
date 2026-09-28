// src/modules/documents/application/queries/get-document.query.ts
export class GetDocumentQuery {
  constructor(
    public readonly userId: string,
    public readonly documentId: string,
  ) {}
}
