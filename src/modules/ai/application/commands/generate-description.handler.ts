// src/modules/ai/application/commands/generate-description.handler.ts
// Generate/improve/shorten a task description. Membership required when projectId is given.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GenerateDescriptionCommand } from './generate-description.command';
import {
  AI_PROVIDER,
  type IAiProvider,
} from '../../domain/services/ai-provider.interface';
import { AiAccessService } from '../services/ai-access.service';

@CommandHandler(GenerateDescriptionCommand)
export class GenerateDescriptionHandler
  implements ICommandHandler<GenerateDescriptionCommand>
{
  constructor(
    @Inject(AI_PROVIDER) private readonly ai: IAiProvider,
    private readonly access: AiAccessService,
  ) {}

  async execute(
    command: GenerateDescriptionCommand,
  ): Promise<{ description: string }> {
    if (command.projectId) {
      await this.access.requireMember(command.projectId, command.userId);
    }
    const description = await this.ai.generateDescription({
      title: command.title,
      mode: command.mode,
      currentDescription: command.currentDescription,
    });
    return { description };
  }
}
