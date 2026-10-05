// src/modules/ai/application/commands/propose-task-actions.handler.spec.ts

import { ProposeTaskActionsHandler } from './propose-task-actions.handler';
import { ProposeTaskActionsCommand } from './propose-task-actions.command';
import { StubAiProvider } from '../../infrastructure/providers/stub-ai.provider';
import { proposalPlanStore } from '../../infrastructure/storage/proposal-plan.store';

describe('ProposeTaskActionsHandler', () => {
  let handler: ProposeTaskActionsHandler;
  let mockAccess: any;
  let mockPrisma: any;
  let aiProvider: StubAiProvider;

  beforeEach(() => {
    aiProvider = new StubAiProvider();
    mockAccess = {
      requireMember: jest.fn().mockResolvedValue(undefined),
    };
    mockPrisma = {
      task: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'task-1',
            title: 'Fix payment timeout',
            status: 'todo',
            priority: 'medium',
            assigneeId: null,
            assignee: null,
            dueDate: new Date(Date.now() - 3600000),
          },
        ]),
      },
      projectMember: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-2',
            user: { id: 'user-2', name: 'Sarah Connor' },
          },
        ]),
      },
    };

    handler = new ProposeTaskActionsHandler(
      aiProvider,
      mockAccess,
      mockPrisma,
    );
  });

  it('proposes task action plan and stores it in memory', async () => {
    const command = new ProposeTaskActionsCommand(
      'user-1',
      '11111111-1111-4111-a111-111111111111',
      'Reassign overdue tasks to Sarah and set priority urgent',
    );

    const plan = await handler.execute(command);

    expect(mockAccess.requireMember).toHaveBeenCalledWith(
      '11111111-1111-4111-a111-111111111111',
      'user-1',
    );
    expect(plan.id).toBeDefined();
    expect(plan.projectId).toBe('11111111-1111-4111-a111-111111111111');
    expect(plan.status).toBe('pending');
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.actions[0].taskId).toBe('task-1');

    // Stored in in-memory plan store
    const stored = proposalPlanStore.get(plan.id);
    expect(stored).toBeDefined();
    expect(stored?.id).toBe(plan.id);
  });
});
