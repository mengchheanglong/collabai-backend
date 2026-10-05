// src/shared/infrastructure/rabbitmq/workers/ai-insights.worker.spec.ts

import { AiInsightsWorker } from './ai-insights.worker';
import { GenerateProjectInsightsCommand } from '../../../../modules/ai/application/commands/generate-project-insights.command';
import { GenerateTasksCommand } from '../../../../modules/ai/application/commands/generate-tasks.command';

describe('AiInsightsWorker', () => {
  let commandBus: { execute: jest.Mock };
  let events: { emit: jest.Mock };
  let worker: AiInsightsWorker;
  const job = {
    jobId: 'job-1',
    userId: 'user-1',
    projectId: 'proj-1',
    requestedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    commandBus = { execute: jest.fn() };
    events = { emit: jest.fn() };
    worker = new AiInsightsWorker(
      { consume: jest.fn() } as any,
      commandBus as any,
      events as any,
    );
  });

  it('runs project insights and notifies the requester', async () => {
    commandBus.execute.mockResolvedValueOnce({ summary: 'Healthy' });

    await worker.handle({ ...job, type: 'project-insights' });

    expect(commandBus.execute).toHaveBeenCalledWith(
      new GenerateProjectInsightsCommand('user-1', 'proj-1'),
    );
    expect(events.emit).toHaveBeenCalledWith('ai.job.completed', {
      jobId: 'job-1',
      type: 'project-insights',
      userId: 'user-1',
      projectId: 'proj-1',
      result: { summary: 'Healthy' },
    });
  });

  it('runs task generation with the prompt and count', async () => {
    commandBus.execute.mockResolvedValueOnce({ tasks: [] });
    await worker.handle({
      ...job,
      type: 'generate-tasks',
      prompt: 'Auth flow',
      count: 3,
    });
    expect(commandBus.execute).toHaveBeenCalledWith(
      new GenerateTasksCommand('user-1', 'proj-1', 'Auth flow', 3),
    );
  });

  it('reports failures to the requester instead of throwing', async () => {
    commandBus.execute.mockRejectedValueOnce(new Error('Provider timeout'));
    await expect(
      worker.handle({ ...job, type: 'project-insights' }),
    ).resolves.toBeUndefined();
    expect(events.emit).toHaveBeenCalledWith(
      'ai.job.failed',
      expect.objectContaining({ jobId: 'job-1', error: 'Provider timeout' }),
    );
  });
});
