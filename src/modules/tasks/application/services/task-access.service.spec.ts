// src/modules/tasks/application/services/task-access.service.spec.ts

import { TaskAccessService } from './task-access.service';
import { TaskWriteForbiddenError } from '../errors/task.errors';

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
