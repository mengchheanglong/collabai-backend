// src/modules/ai/application/commands/enqueue-ai-job.handler.spec.ts

import { EnqueueAiJobHandler } from './enqueue-ai-job.handler';
import { EnqueueAiJobCommand } from './enqueue-ai-job.command';
import { NotProjectMemberError } from '../errors/ai.errors';

describe('EnqueueAiJobHandler', () => {
  let access: { requireMember: jest.Mock };
  let bus: { publish: jest.Mock };
  let handler: EnqueueAiJobHandler;

  beforeEach(() => {
    access = { requireMember: jest.fn().mockResolvedValue(undefined) };
    bus = { publish: jest.fn().mockResolvedValue(undefined) };
    handler = new EnqueueAiJobHandler(access as any, bus);
  });

  it('queues the job and returns its id', async () => {
    const res = await handler.execute(
      new EnqueueAiJobCommand(
        'user-1',
        'generate-tasks',
        'proj-1',
        'Auth flow',
        3,
      ),
    );

    expect(res).toEqual({
      jobId: expect.any(String),
      type: 'generate-tasks',
      status: 'queued',
    });
    expect(bus.publish).toHaveBeenCalledWith('ai.generate-tasks', {
      jobId: res.jobId,
      type: 'generate-tasks',
      userId: 'user-1',
      projectId: 'proj-1',
      prompt: 'Auth flow',
      count: 3,
      requestedAt: expect.any(String),
    });
  });

  it('routes project insights to ai.project-insights', async () => {
    await handler.execute(
      new EnqueueAiJobCommand('user-1', 'project-insights', 'proj-1'),
    );
    expect(bus.publish.mock.calls[0][0]).toBe('ai.project-insights');
  });

  it('rejects non-members before queueing', async () => {
    access.requireMember.mockRejectedValueOnce(new NotProjectMemberError());
    await expect(
      handler.execute(
        new EnqueueAiJobCommand('user-9', 'project-insights', 'proj-1'),
      ),
    ).rejects.toThrow(NotProjectMemberError);
    expect(bus.publish).not.toHaveBeenCalled();
  });
});
