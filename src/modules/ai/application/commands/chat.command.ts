// src/modules/ai/application/commands/chat.command.ts
export class ChatCommand {
  constructor(
    public readonly userId: string,
    public readonly message: string,
    public readonly projectId?: string,
    public readonly history?: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>,
  ) {}
}
