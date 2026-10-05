// src/modules/activity/application/queries/list-project-activity.handler.spec.ts

import { ForbiddenException } from '@nestjs/common';
import { ListProjectActivityHandler } from './list-project-activity.handler';
import { ListProjectActivityQuery } from './list-project-activity.query';

describe('ListProjectActivityHandler', () => {
  let projects: { findMembership: jest.Mock };
  let prisma: any;
  let handler: ListProjectActivityHandler;

  beforeEach(() => {
    projects = { findMembership: jest.fn() };
    prisma = {
      activity: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'act-1',
            projectId: 'proj-1',
            userId: 'user-1',
            entityType: 'task',
            entityId: 'task-1',
            action: 'moved',
            oldValue: 'todo',
            newValue: 'done',
            message: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            user: { id: 'user-1', name: 'Dara', email: 'dara@example.com' },
          },
        ]),
        count: jest.fn().mockResolvedValue(41),
      },
    };
    handler = new ListProjectActivityHandler(projects as any, prisma);
  });

  it('rejects non-members', async () => {
    projects.findMembership.mockResolvedValueOnce(null);
    await expect(
      handler.execute(new ListProjectActivityQuery('user-9', 'proj-1', 1, 30)),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
  });

  it('rejects deactivated members', async () => {
    projects.findMembership.mockResolvedValueOnce({ isActive: false });
    await expect(
      handler.execute(new ListProjectActivityQuery('user-9', 'proj-1', 1, 30)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns a newest-first page of contract-shaped activities', async () => {
    projects.findMembership.mockResolvedValueOnce({ isActive: true });

    const result = await handler.execute(
      new ListProjectActivityQuery('user-1', 'proj-1', 2, 30),
    );

    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
        skip: 30,
        take: 30,
      }),
    );
    expect(result.total).toBe(41);
    expect(result.items[0]).toEqual({
      _id: 'act-1',
      id: 'act-1',
      projectId: 'proj-1',
      actorId: 'user-1',
      actor: { _id: 'user-1', name: 'Dara', email: 'dara@example.com' },
      type: 'task.moved',
      entityType: 'task',
      entityId: 'task-1',
      oldValue: 'todo',
      newValue: 'done',
      // rows without a stored message get one built on read
      message: 'Dara moved task a task from todo to done',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
