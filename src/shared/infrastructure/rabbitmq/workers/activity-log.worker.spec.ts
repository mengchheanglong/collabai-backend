// src/shared/infrastructure/rabbitmq/workers/activity-log.worker.spec.ts

import { Prisma } from '@prisma/client';
import { ActivityLogWorker } from './activity-log.worker';
import { QUEUE } from '../rabbitmq.constants';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: 'test',
  });

const minimalJob = {
  id: 'a',
  projectId: 'p',
  actorId: 'u',
  entityType: 'task',
  action: 'created',
};

describe('ActivityLogWorker', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  let prisma: any;
  let events: { emit: jest.Mock };
  let rabbitmq: { consume: jest.Mock };
  let worker: ActivityLogWorker;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ name: 'Dara' }) },
      task: {
        findUnique: jest.fn().mockResolvedValue({ title: 'Build login page' }),
      },
      activity: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...data,
            createdAt,
            user: { id: data.userId, name: 'Dara', email: 'dara@example.com' },
          }),
        ),
      },
    };
    events = { emit: jest.fn() };
    rabbitmq = { consume: jest.fn() };
    worker = new ActivityLogWorker(rabbitmq as any, prisma, events as any);
  });

  it('registers on the activity queue', () => {
    worker.onModuleInit();
    expect(rabbitmq.consume).toHaveBeenCalledWith(
      QUEUE.ACTIVITY,
      expect.any(Function),
    );
  });

  it('persists the activity with its message and broadcasts activity.created', async () => {
    await worker.handle({
      id: 'act-1',
      projectId: 'proj-1',
      actorId: 'user-1',
      entityType: 'task',
      entityId: 'task-1',
      action: 'created',
      subject: 'Build login page',
    });

    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'act-1',
          projectId: 'proj-1',
          userId: 'user-1',
          entityType: 'task',
          action: 'created',
          newValue: 'Build login page',
          message: 'Dara created task Build login page',
        }),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith('activity.created', {
      projectId: 'proj-1',
      actorId: 'user-1',
      activity: expect.objectContaining({
        _id: 'act-1',
        type: 'task.created',
        actor: { _id: 'user-1', name: 'Dara', email: 'dara@example.com' },
        message: 'Dara created task Build login page',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    });
  });

  it('resolves the subject from the task title when only a task id is known', async () => {
    await worker.handle({
      id: 'act-2',
      projectId: 'proj-1',
      actorId: 'user-1',
      entityType: 'comment',
      entityId: 'c-1',
      action: 'created',
      subjectTaskId: 'task-1',
    });

    expect(prisma.task.findUnique).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      select: { title: true },
    });
    expect(prisma.activity.create.mock.calls[0][0].data.message).toBe(
      'Dara commented on Build login page',
    );
  });

  it('skips a redelivered job that was already persisted', async () => {
    prisma.activity.create.mockRejectedValueOnce(prismaError('P2002'));
    await expect(worker.handle(minimalJob)).resolves.toBeUndefined();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('drops a job whose project no longer exists', async () => {
    prisma.activity.create.mockRejectedValueOnce(prismaError('P2003'));
    await expect(worker.handle(minimalJob)).resolves.toBeUndefined();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('rethrows transient errors so the bus retries', async () => {
    prisma.activity.create.mockRejectedValueOnce(new Error('connection reset'));
    await expect(worker.handle(minimalJob)).rejects.toThrow('connection reset');
  });
});
