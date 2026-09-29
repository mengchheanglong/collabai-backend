// src/modules/ai/application/commands/generate-project-insights.handler.spec.ts

import { GenerateProjectInsightsHandler } from './generate-project-insights.handler';
import { GenerateProjectInsightsCommand } from './generate-project-insights.command';
import { StubAiProvider } from '../../infrastructure/providers/stub-ai.provider';

describe('GenerateProjectInsightsHandler', () => {
  let handler: GenerateProjectInsightsHandler;
  let mockAccess: any;
  let mockPrisma: any;
  let aiProvider: StubAiProvider;

  beforeEach(() => {
    aiProvider = new StubAiProvider();
    mockAccess = {
      requireMember: jest.fn().mockResolvedValue(undefined),
    };
    mockPrisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-a111-111111111111',
          name: 'Core Project',
          description: 'Production platform',
        }),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'task-1',
            title: 'Fix auth cookies',
            status: 'done',
            priority: 'high',
            dueDate: new Date(Date.now() - 86400000),
            assignee: { name: 'Alice' },
          },
          {
            id: 'task-2',
            title: 'Implement realtime sockets',
            status: 'in_progress',
            priority: 'urgent',
            dueDate: new Date(Date.now() + 86400000),
            assignee: { name: 'Bob' },
          },
          {
            id: 'task-3',
            title: 'Deploy to Render',
            status: 'todo',
            priority: 'medium',
            dueDate: null,
            assignee: null,
          },
        ]),
      },
    };

    handler = new GenerateProjectInsightsHandler(
      aiProvider,
      mockAccess,
      mockPrisma,
    );
  });

  it('generates project health insights and next-best actions', async () => {
    const result = await handler.execute(
      new GenerateProjectInsightsCommand('user-1', '11111111-1111-4111-a111-111111111111'),
    );

    expect(mockAccess.requireMember).toHaveBeenCalledWith(
      '11111111-1111-4111-a111-111111111111',
      'user-1',
    );
    expect(result.insights).toBeDefined();
    expect(result.insights.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.insights.healthScore).toBeLessThanOrEqual(100);
    expect(result.insights.recommendations.length).toBeGreaterThan(0);
    expect(result.insights.nextBestActions.length).toBeGreaterThan(0);
  });
});
