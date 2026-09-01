// src/modules/ai/application/commands/suggest-subtasks.handler.ts
// Suggest subtasks for a title/description. If projectId is given, membership is required.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SuggestSubtasksCommand } from './suggest-subtasks.command';
import {
  AI_PROVIDER,
  type IAiProvider,
} from '../../domain/services/ai-provider.interface';
import { AiAccessService } from '../services/ai-access.service';

@CommandHandler(SuggestSubtasksCommand)
export class SuggestSubtasksHandler implements ICommandHandler<SuggestSubtasksCommand> {
  constructor(
    @Inject(AI_PROVIDER) private readonly ai: IAiProvider,
    private readonly access: AiAccessService,
  ) {}

  async execute(
    command: SuggestSubtasksCommand,
  ): Promise<{ subtasks: string[] }> {
    if (command.projectId) {
      await this.access.requireMember(command.projectId, command.userId);
    }
    const subtasks = await this.ai.suggestSubtasks({
      title: command.title,
      description: command.description,
      count: command.count,
    });
    return { subtasks };
  }
}
