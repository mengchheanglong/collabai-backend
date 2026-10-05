// src/modules/ai/application/commands/generate-tasks.handler.ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GenerateTasksCommand } from './generate-tasks.command';
import {
  AI_PROVIDER,
  type IAiProvider,
  type StructuredTask,
} from '../../domain/services/ai-provider.interface';
import { AiAccessService } from '../services/ai-access.service';

@CommandHandler(GenerateTasksCommand)
export class GenerateTasksHandler implements ICommandHandler<GenerateTasksCommand> {
  constructor(
    @Inject(AI_PROVIDER) private readonly ai: IAiProvider,
    private readonly access: AiAccessService,
  ) {}

  async execute(
    command: GenerateTasksCommand,
  ): Promise<{ tasks: StructuredTask[] }> {
    // Generated content is meant to be written into the project — viewers can't use it.
    await this.access.requireWriter(command.projectId, command.userId);
    const tasks = await this.ai.generateTasks({
      prompt: command.prompt,
      count: command.count,
    });
    return { tasks };
  }
}
