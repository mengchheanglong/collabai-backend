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
import { PrismaService } from '../../../../shared/services/prisma.service';

@CommandHandler(GenerateTasksCommand)
export class GenerateTasksHandler implements ICommandHandler<GenerateTasksCommand> {
  constructor(
    @Inject(AI_PROVIDER) private readonly ai: IAiProvider,
    private readonly access: AiAccessService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    command: GenerateTasksCommand,
  ): Promise<{ tasks: StructuredTask[] }> {
    // Generated content is meant to be written into the project — viewers can't use it.
    if (command.projectId) {
      await this.access.requireWriter(command.projectId, command.userId);
    }
    let prompt = command.prompt;
    if (command.projectId) {
      const docs = await this.prisma.document.findMany({
        where: { projectId: command.projectId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { title: true, content: true },
      });
      if (docs.length > 0) {
        const docSnippets = docs
          .map((d) => `- "${d.title}": ${d.content.trim().slice(0, 400)}`)
          .join('\n');
        prompt = `${command.prompt}\n\nWorkspace Documentation Context:\n${docSnippets}`;
      }
    }
    const tasks = await this.ai.generateTasks({
      prompt,
      count: command.count,
    });
    return { tasks };
  }
}
