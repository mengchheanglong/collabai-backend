// src/modules/ai/application/commands/propose-task-actions.handler.ts

import { Inject, Optional } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import { ProposeTaskActionsCommand } from './propose-task-actions.command';
import {
  AI_PROVIDER,
  type IAiProvider,
} from '../../domain/services/ai-provider.interface';
import { AiAccessService } from '../services/ai-access.service';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { RedisService } from '../../../../shared/services/redis.service';
import {
  AiTaskActionPlan,
  proposalPlanStore,
} from '../../infrastructure/storage/proposal-plan.store';

@CommandHandler(ProposeTaskActionsCommand)
export class ProposeTaskActionsHandler
  implements ICommandHandler<ProposeTaskActionsCommand>
{
  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: IAiProvider,
    private readonly access: AiAccessService,
    private readonly prisma: PrismaService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async execute(
    command: ProposeTaskActionsCommand,
  ): Promise<AiTaskActionPlan> {
    await this.access.requireMember(command.projectId, command.userId);

    const tasks = await this.prisma.task.findMany({
      where: {
        projectId: command.projectId,
        deletedAt: null,
      },
      include: {
        assignee: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const members = await this.prisma.projectMember.findMany({
      where: {
        projectId: command.projectId,
        isActive: true,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    const proposal = await this.aiProvider.proposeTaskActions({
      request: command.request,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigneeId: t.assignedTo,
        assigneeName: t.assignee?.name,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      })),
      members: members.map((m) => ({
        id: m.userId,
        name: m.user.name,
      })),
    });

    const planId = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const plan: AiTaskActionPlan = {
      id: planId,
      projectId: command.projectId,
      request: command.request,
      actions: proposal.actions.map((a, idx) => ({
        id: a.id || `action-${idx + 1}`,
        taskId: a.taskId,
        taskTitle: a.taskTitle,
        rationale: a.rationale,
        previous: a.previous,
        changes: a.changes,
      })),
      source: 'ai',
      status: 'pending',
      expiresAt,
    };

    proposalPlanStore.set(planId, plan);

    if (this.redis) {
      try {
        await this.redis.set(`ai:plan:${planId}`, JSON.stringify(plan), 900);
      } catch {
        // fail-open to in-memory store
      }
    }

    return plan;
  }
}
