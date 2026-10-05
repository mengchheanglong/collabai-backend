// src/modules/ai/application/commands/apply-task-actions.handler.ts

import { Injectable, Optional } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApplyTaskActionsCommand } from './apply-task-actions.command';
import { AiAccessService } from '../services/ai-access.service';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { RedisService } from '../../../../shared/services/redis.service';
import { ProposalNotFoundError } from '../errors/ai.errors';
import {
  AiTaskActionPlan,
  proposalPlanStore,
} from '../../infrastructure/storage/proposal-plan.store';
import { ProjectRoles } from '../../../projects/domain/value-objects/project-role.value-object';

export interface ApplyTaskActionsResult {
  planId: string;
  status: 'applied';
  appliedActionIds: string[];
  appliedAt: string;
}

@CommandHandler(ApplyTaskActionsCommand)
export class ApplyTaskActionsHandler
  implements ICommandHandler<ApplyTaskActionsCommand>
{
  constructor(
    private readonly access: AiAccessService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async execute(
    command: ApplyTaskActionsCommand,
  ): Promise<ApplyTaskActionsResult> {
    let plan: AiTaskActionPlan | null =
      proposalPlanStore.get(command.planId) ?? null;

    if (!plan && this.redis) {
      try {
        const raw = await this.redis.get(`ai:plan:${command.planId}`);
        if (raw) plan = JSON.parse(raw);
      } catch {
        // fail open
      }
    }

    if (!plan) {
      throw new ProposalNotFoundError();
    }

    await this.access.requireWriter(plan.projectId, command.userId);
    const actorRole = await this.access.roleOf(plan.projectId, command.userId);

    const targetActions =
      command.actionIds && command.actionIds.length > 0
        ? plan.actions.filter((a) => command.actionIds!.includes(a.id))
        : plan.actions;

    const appliedActionIds: string[] = [];

    for (const action of targetActions) {
      const updateData: any = {};
      if (action.changes.status) updateData.status = action.changes.status;
      if (action.changes.priority) updateData.priority = action.changes.priority;
      if (action.changes.assigneeId !== undefined) {
        updateData.assignedTo = action.changes.assigneeId;
      }
      if (action.changes.dueDate !== undefined) {
        updateData.dueDate = action.changes.dueDate
          ? new Date(action.changes.dueDate)
          : null;
      }

      if (Object.keys(updateData).length > 0) {
        // Only touch tasks of this plan's project (AI output is untrusted input).
        const current = await this.prisma.task.findFirst({
          where: { id: action.taskId, projectId: plan.projectId },
          select: { assignedTo: true },
        });
        if (!current) continue;
        // Same assignment rule as the task API: members can't give tasks to others.
        if (
          action.changes.assigneeId !== undefined &&
          !(
            actorRole &&
            ProjectRoles.canChangeAssignee(
              actorRole,
              command.userId,
              current.assignedTo ?? null,
              action.changes.assigneeId ?? null,
            )
          )
        ) {
          continue;
        }
        try {
          const updated = await this.prisma.task.update({
            where: { id: action.taskId },
            data: updateData,
            include: {
              assignee: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
          });

          // Broadcast real-time update
          this.events.emit('task.updated', {
            taskId: action.taskId,
            projectId: plan.projectId,
            actorId: command.userId,
            task: updated,
          });

          appliedActionIds.push(action.id);
        } catch {
          // Continue with remaining actions if a task was deleted concurrently
        }
      }
    }

    plan.status = 'applied';
    proposalPlanStore.set(plan.id, plan);

    return {
      planId: plan.id,
      status: 'applied',
      appliedActionIds,
      appliedAt: new Date().toISOString(),
    };
  }
}
