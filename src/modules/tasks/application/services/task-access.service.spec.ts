// src/modules/tasks/application/services/task-access.service.spec.ts

import { TaskAccessService } from './task-access.service';
import {
  TaskAssignForbiddenError,
  TaskWriteForbiddenError,
} from '../errors/task.errors';

describe('TaskAccessService.requireWriter', () => {
  it('tells a viewer they have view-only access', async () => {
    const projects = { findMembership: jest.fn().mockResolvedValue({ role: 'viewer' }) };
    const access = new TaskAccessService(projects as any);

    const attempt = access.requireWriter('proj-1', 'viewer-1');
    await expect(attempt).rejects.toThrow(TaskWriteForbiddenError);
    await expect(access.requireWriter('proj-1', 'viewer-1')).rejects.toThrow(
      'You have view-only access to this project. Ask an owner or admin for Member access to make changes.',
    );
  });

  it('lets members change tasks', async () => {
    const projects = { findMembership: jest.fn().mockResolvedValue({ role: 'member' }) };
    const access = new TaskAccessService(projects as any);
    await expect(access.requireWriter('proj-1', 'member-1')).resolves.toBeUndefined();
  });
});

describe('TaskAccessService.requireCanAssign', () => {
  const as = (role: string) =>
    new TaskAccessService({
      findMembership: jest.fn().mockResolvedValue({ role }),
    } as any);

  it('lets owners and admins assign anyone', async () => {
    await expect(as('admin').requireCanAssign('p', 'a1', 'u1', 'u2')).resolves.toBeUndefined();
    await expect(as('owner').requireCanAssign('p', 'o1', null, 'u2')).resolves.toBeUndefined();
  });

  it('lets a member take an unassigned task or remove themselves', async () => {
    await expect(as('member').requireCanAssign('p', 'm1', null, 'm1')).resolves.toBeUndefined();
    await expect(as('member').requireCanAssign('p', 'm1', 'm1', null)).resolves.toBeUndefined();
  });

  it('stops a member giving a task to someone else', async () => {
    await expect(as('member').requireCanAssign('p', 'm1', 'm1', 'u2')).rejects.toThrow(
      'Only project owners and admins can assign tasks to other people.',
    );
    await expect(as('member').requireCanAssign('p', 'm1', null, 'u2')).rejects.toThrow(
      TaskAssignForbiddenError,
    );
    await expect(as('member').requireCanAssign('p', 'm1', 'u2', null)).rejects.toThrow(
      TaskAssignForbiddenError,
    );
  });

  it('never lets a viewer change the assignee', async () => {
    await expect(as('viewer').requireCanAssign('p', 'v1', null, 'v1')).rejects.toThrow(
      TaskAssignForbiddenError,
    );
  });
});
