// src/modules/ai/application/commands/chat.handler.ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../shared/services/prisma.service';
import {
  AI_PROVIDER,
  type ChatContext,
  type IAiProvider,
} from '../../domain/services/ai-provider.interface';
import { AiAccessService } from '../services/ai-access.service';
import { ChatCommand } from './chat.command';

@CommandHandler(ChatCommand)
export class ChatHandler implements ICommandHandler<ChatCommand> {
  constructor(
    @Inject(AI_PROVIDER) private readonly ai: IAiProvider,
    private readonly access: AiAccessService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: ChatCommand): Promise<{ reply: string }> {
    let context: ChatContext | undefined;

    if (command.projectId) {
      await this.access.requireMember(command.projectId, command.userId);

      const project = await this.prisma.project.findUnique({
        where: { id: command.projectId },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          tasks: {
            take: 25,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              assignee: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (project) {
        const membersSummary = project.members
          .map((m) => `- ${m.user.name} (${m.role}, email: ${m.user.email})`)
          .join('\n');

        const tasksSummary = project.tasks
          .map((t) => {
            const assigned = t.assignee
              ? `assigned to ${t.assignee.name}`
              : 'unassigned';
            return `- [${t.status.toUpperCase()}] ${t.title} (Priority: ${t.priority}, ${assigned})`;
          })
          .join('\n');

        context = {
          projectName: project.name,
          projectDescription: project.description ?? '',
          membersSummary: membersSummary || 'No members listed.',
          tasksSummary: tasksSummary || 'No tasks created yet.',
        };
      }
    }

    const reply = await this.ai.chat({
      message: command.message,
      context,
      history: command.history,
    });

    return { reply };
  }
}
