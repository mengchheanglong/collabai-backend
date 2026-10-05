// src/modules/projects/application/commands/resend-invitation.handler.spec.ts

import { ResendInvitationHandler } from './resend-invitation.handler';
import { ResendInvitationCommand } from './resend-invitation.command';
import {
  InsufficientProjectPermissionError,
  NotProjectMemberError,
  ProjectNotFoundError,
} from '../errors/project.errors';

describe('ResendInvitationHandler', () => {
  let handler: ResendInvitationHandler;
  let mockRepo: any;
  let mockBus: any;

  beforeEach(() => {
    mockRepo = {
      findMembership: jest.fn(),
      findInvitationById: jest.fn(),
      findViewById: jest.fn(),
      createInvitation: jest.fn(),
    };
    mockBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    handler = new ResendInvitationHandler(mockRepo, mockBus);
  });

  it('throws NotProjectMemberError if actor is not in project', async () => {
    mockRepo.findMembership.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new ResendInvitationCommand('user-1', 'proj-1', 'inv-1')),
    ).rejects.toThrow(NotProjectMemberError);
  });

  it('throws InsufficientProjectPermissionError if actor cannot manage members', async () => {
    mockRepo.findMembership.mockResolvedValueOnce({
      projectId: 'proj-1',
      userId: 'user-1',
      role: 'viewer',
    });

    await expect(
      handler.execute(new ResendInvitationCommand('user-1', 'proj-1', 'inv-1')),
    ).rejects.toThrow(InsufficientProjectPermissionError);
  });

  it('does nothing if invitation is not found', async () => {
    mockRepo.findMembership.mockResolvedValueOnce({
      projectId: 'proj-1',
      userId: 'user-1',
      role: 'admin',
    });
    mockRepo.findInvitationById.mockResolvedValueOnce(null);

    await handler.execute(
      new ResendInvitationCommand('user-1', 'proj-1', 'inv-1'),
    );
    expect(mockRepo.createInvitation).not.toHaveBeenCalled();
    expect(mockBus.publish).not.toHaveBeenCalled();
  });

  it('does nothing if invitation belongs to a different project', async () => {
    mockRepo.findMembership.mockResolvedValueOnce({
      projectId: 'proj-1',
      userId: 'user-1',
      role: 'admin',
    });
    mockRepo.findInvitationById.mockResolvedValueOnce({
      id: 'inv-1',
      projectId: 'proj-other',
      email: 'guest@example.com',
    });

    await handler.execute(
      new ResendInvitationCommand('user-1', 'proj-1', 'inv-1'),
    );
    expect(mockRepo.createInvitation).not.toHaveBeenCalled();
    expect(mockBus.publish).not.toHaveBeenCalled();
  });

  it('throws ProjectNotFoundError if project view cannot be loaded', async () => {
    mockRepo.findMembership.mockResolvedValueOnce({
      projectId: 'proj-1',
      userId: 'user-1',
      role: 'admin',
    });
    mockRepo.findInvitationById.mockResolvedValueOnce({
      id: 'inv-1',
      projectId: 'proj-1',
      email: 'guest@example.com',
      role: 'member',
      token: 'old-token',
    });
    mockRepo.findViewById.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new ResendInvitationCommand('user-1', 'proj-1', 'inv-1')),
    ).rejects.toThrow(ProjectNotFoundError);
  });

  it('regenerates fresh token, extends expiration by 7 days, and queues the invitation email', async () => {
    mockRepo.findMembership.mockResolvedValueOnce({
      projectId: 'proj-1',
      userId: 'admin-1',
      role: 'admin',
    });
    mockRepo.findInvitationById.mockResolvedValueOnce({
      id: 'inv-1',
      projectId: 'proj-1',
      email: 'guest@example.com',
      role: 'member',
      token: 'old-expired-token',
      inviterName: 'Admin Alice',
    });
    mockRepo.findViewById.mockResolvedValueOnce({
      id: 'proj-1',
      name: 'Alpha Project',
    });
    mockRepo.createInvitation.mockResolvedValueOnce({ id: 'inv-1' });

    await handler.execute(
      new ResendInvitationCommand('admin-1', 'proj-1', 'inv-1'),
    );

    expect(mockRepo.createInvitation).toHaveBeenCalledTimes(1);
    const createCall = mockRepo.createInvitation.mock.calls[0][0];
    expect(createCall.id).toBe('inv-1');
    expect(createCall.projectId).toBe('proj-1');
    expect(createCall.email).toBe('guest@example.com');
    expect(createCall.role).toBe('member');
    expect(createCall.invitedBy).toBe('admin-1');
    expect(createCall.token).not.toBe('old-expired-token');
    expect(typeof createCall.token).toBe('string');
    // Verify expiresAt is ~7 days in future
    const now = Date.now();
    const diffDays =
      (createCall.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);

    expect(mockBus.publish).toHaveBeenCalledWith('email.project-invitation', {
      to: 'guest@example.com',
      projectName: 'Alpha Project',
      inviterName: 'Admin Alice',
      inviteUrl: expect.stringContaining(
        `/accept-invite?token=${createCall.token}`,
      ),
    });
  });
});
