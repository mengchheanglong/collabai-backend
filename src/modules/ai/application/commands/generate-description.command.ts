// src/modules/ai/application/commands/generate-description.command.ts
import { DescriptionMode } from '../../domain/services/ai-provider.interface';

export class GenerateDescriptionCommand {
  constructor(
    public readonly userId: string,
    public readonly title: string,
    public readonly mode: DescriptionMode,
    public readonly currentDescription?: string,
    public readonly projectId?: string,
  ) {}
}
