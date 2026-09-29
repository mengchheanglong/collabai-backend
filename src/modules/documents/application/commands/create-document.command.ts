// src/modules/documents/application/commands/create-document.command.ts
export class CreateDocumentCommand {
  constructor(
    public readonly userId: string,
    public readonly projectId: string,
    public readonly title: string,
    public readonly content?: string,
    public readonly attachments?: any[],
    public readonly fileType?: string,
  ) {}
}
