// src/modules/documents/application/commands/update-document.command.ts
export class UpdateDocumentCommand {
  constructor(
    public readonly userId: string,
    public readonly documentId: string,
    public readonly fields: {
      title?: string;
      content?: string;
      attachments?: any[];
      fileType?: string;
    },
    public readonly expectedVersion?: number,
  ) {}
}
