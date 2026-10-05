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
          documents: {
            take: 15,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              title: true,
              content: true,
              fileType: true,
              attachments: true,
              updatedAt: true,
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

        const documentsSummary =
          project.documents && project.documents.length > 0
            ? project.documents
                .map((d, i) => {
                  const attachments = Array.isArray(d.attachments) ? d.attachments : [];
                  const validAttachments = attachments.filter(
                    (a: any) => a && typeof a === 'object' && a.name,
                  );
                  const attNames = validAttachments
                    .map(
                      (a: any) =>
                        `${a.name}${a.size ? ` (${Math.round(a.size / 1024)} KB)` : ''}`,
                    )
                    .join(', ');
                  const attInfo = attNames ? ` [Attached file(s): ${attNames}]` : '';
                  const cleanContent = d.content.trim();
                  const snippet = cleanContent
                    ? cleanContent.length > 8000
                      ? `${cleanContent.slice(0, 8000)}... [truncated]`
                      : cleanContent
                    : `Uploaded file document: "${d.title}"${attInfo}`;
                  const format = d.fileType
                    ? ` [Format: ${d.fileType.toUpperCase()}]`
                    : '';
                  return `### Document ${i + 1}: "${d.title}"${format}${attInfo} (ID: ${d.id})\n${snippet}`;
                })
                .join('\n\n')
            : 'No documentation recorded yet.';

        context = {
          projectName: project.name,
          projectDescription: project.description ?? '',
          membersSummary: membersSummary || 'No members listed.',
          tasksSummary: tasksSummary || 'No tasks created yet.',
          documentsSummary,
          documents: project.documents.map((d) => ({
            id: d.id,
            title: d.title,
            content: d.content,
            fileType: d.fileType,
            updatedAt: d.updatedAt,
          })),
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
