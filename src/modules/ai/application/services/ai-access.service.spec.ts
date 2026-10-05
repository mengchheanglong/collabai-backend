// src/modules/ai/application/services/ai-access.service.spec.ts
//
// Content-generating AI calls (generate-tasks, subtasks, description) use requireWriter;
// read-only AI (insights, search, chat, summaries) uses requireMember.

import { AiAccessService } from './ai-access.service';
import {
  InsufficientAiPermissionError,
  NotProjectMemberError,
} from '../errors/ai.errors';
import { GenerateTasksHandler } from '../commands/generate-tasks.handler';
import { GenerateTasksCommand } from '../commands/generate-tasks.command';

describe('AiAccessService', () => {
  let projects: { findMembership: jest.Mock };
  let access: AiAccessService;

  beforeEach(() => {
    projects = { findMembership: jest.fn() };
    access = new AiAccessService(projects as any);
  });

  it('lets a viewer use read-only AI', async () => {
    projects.findMembership.mockResolvedValueOnce({ role: 'viewer' });
    await expect(access.requireMember('p', 'u')).resolves.toBeUndefined();
  });

  it('blocks a viewer from content-generating AI', async () => {
    projects.findMembership.mockResolvedValueOnce({ role: 'viewer' });
    await expect(access.requireWriter('p', 'u')).rejects.toThrow(
      InsufficientAiPermissionError,
    );
  });

  it('rejects non-members', async () => {
    projects.findMembership.mockResolvedValue(null);
    await expect(access.requireMember('p', 'u')).rejects.toThrow(
      NotProjectMemberError,
    );
    await expect(access.requireWriter('p', 'u')).rejects.toThrow(
      NotProjectMemberError,
    );
  });

  it('GenerateTasksHandler refuses viewers before calling the AI provider', async () => {
    const ai = { generateTasks: jest.fn() };
    const prisma = { document: { findMany: jest.fn() } };
    const handler = new GenerateTasksHandler(ai as any, access, prisma as any);
    projects.findMembership.mockResolvedValueOnce({ role: 'viewer' });

    await expect(
      handler.execute(new GenerateTasksCommand('u', 'p', 'Plan the sprint', 3)),
    ).rejects.toThrow(InsufficientAiPermissionError);
    expect(ai.generateTasks).not.toHaveBeenCalled();
    expect(prisma.document.findMany).not.toHaveBeenCalled();
  });
});
