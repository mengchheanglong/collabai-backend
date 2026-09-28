// src/modules/documents/application/commands/delete-document.command.ts
export class DeleteDocumentCommand {
  constructor(
    public readonly userId: string,
    public readonly documentId: string,
  ) {}
}
