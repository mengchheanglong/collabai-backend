// src/modules/ai/application/commands/apply-task-actions.handler.spec.ts

import { ApplyTaskActionsHandler } from './apply-task-actions.handler';
import { ApplyTaskActionsCommand } from './apply-task-actions.command';
import { ProposalNotFoundError } from '../errors/ai.errors';
import {
  AiTaskActionPlan,
  proposalPlanStore,
} from '../../infrastructure/storage/proposal-plan.store';

describe('ApplyTaskActionsHandler', () => {
  let handler: ApplyTaskActionsHandler;
  let mockAccess: any;
  let mockPrisma: any;
  let mockEvents: any;

  beforeEach(() => {
    mockAccess = {
      requireWriter: jest.fn().mockResolvedValue(undefined),
      roleOf: jest.fn().mockResolvedValue('admin'),
    };
    mockPrisma = {
      task: {
        findFirst: jest.fn().mockResolvedValue({ assignedTo: null }),
        update: jest.fn().mockImplementation(({ where, data }) => ({
          id: where.id,
          title: 'Fix payment timeout',
          ...data,
          assignee: { id: data.assigneeId, name: 'Sarah', avatarUrl: null },
        })),
      },
    };
    mockEvents = {
      emit: jest.fn(),
    };

    handler = new ApplyTaskActionsHandler(
      mockAccess,
      mockPrisma,
      mockEvents,
    );
  });

  it('throws ProposalNotFoundError when plan is missing', async () => {
    const command = new ApplyTaskActionsCommand('user-1', 'nonexistent-plan');
    await expect(handler.execute(command)).rejects.toThrow(ProposalNotFoundError);
  });

  it('applies task actions, emits real-time events, and returns applied summary', async () => {
    const planId = 'test-plan-123';
    const plan: AiTaskActionPlan = {
      id: planId,
      projectId: 'project-123',
      request: 'Reassign overdue tasks to Sarah',
      actions: [
        {
          id: 'action-1',
          taskId: 'task-1',
          taskTitle: 'Fix payment timeout',
          rationale: 'Overdue task reassigned',
          previous: { status: 'todo', priority: 'medium', assigneeId: null, dueDate: null },
          changes: { priority: 'urgent', assigneeId: 'user-2' },
        },
      ],
      source: 'ai',
      status: 'pending',
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    };

    proposalPlanStore.set(planId, plan);

    const command = new ApplyTaskActionsCommand('user-1', planId, ['action-1']);
    const result = await handler.execute(command);

    expect(mockAccess.requireWriter).toHaveBeenCalledWith('project-123', 'user-1');
    expect(mockPrisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          priority: 'urgent',
          assignedTo: 'user-2',
        }),
      }),
    );
    expect(mockEvents.emit).toHaveBeenCalledWith(
      'task.updated',
      expect.objectContaining({
        taskId: 'task-1',
        projectId: 'project-123',
        actorId: 'user-1',
      }),
    );
    expect(result.planId).toBe(planId);
    expect(result.status).toBe('applied');
    expect(result.appliedActionIds).toContain('action-1');
  });

  const planWith = (id: string, changes: any): AiTaskActionPlan => ({
    id,
    projectId: 'project-123',
    request: 'Reassign tasks',
    actions: [
      {
        id: 'action-1',
        taskId: 'task-1',
        taskTitle: 'Fix payment timeout',
        rationale: 'test',
        previous: { status: 'todo', priority: 'medium', assigneeId: null, dueDate: null },
        changes,
      },
    ],
    source: 'ai',
    status: 'pending',
    expiresAt: new Date(Date.now() + 900000).toISOString(),
  });

  it("skips an AI reassignment a member isn't allowed to make", async () => {
    mockAccess.roleOf.mockResolvedValueOnce('member');
    mockPrisma.task.findFirst.mockResolvedValueOnce({ assignedTo: 'user-9' });
    proposalPlanStore.set('plan-member', planWith('plan-member', { assigneeId: 'user-2' }));

    const result = await handler.execute(
      new ApplyTaskActionsCommand('user-1', 'plan-member', ['action-1']),
    );

    expect(mockPrisma.task.update).not.toHaveBeenCalled();
    expect(result.appliedActionIds).toEqual([]);
  });

  it('never touches a task outside the plan project', async () => {
    mockPrisma.task.findFirst.mockResolvedValueOnce(null);
    proposalPlanStore.set('plan-other', planWith('plan-other', { priority: 'high' }));

    const result = await handler.execute(
      new ApplyTaskActionsCommand('user-1', 'plan-other', ['action-1']),
    );

    expect(mockPrisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-1', projectId: 'project-123' } }),
    );
    expect(mockPrisma.task.update).not.toHaveBeenCalled();
    expect(result.appliedActionIds).toEqual([]);
  });
});
