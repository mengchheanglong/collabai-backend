// src/modules/projects/application/commands/accept-invitation.handler.spec.ts

import { AcceptInvitationHandler } from './accept-invitation.handler';
import { AcceptInvitationCommand } from './accept-invitation.command';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('AcceptInvitationHandler', () => {
  let handler: AcceptInvitationHandler;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findInvitationByToken: jest.fn(),
      findMembership: jest.fn(),
      addMember: jest.fn(),
      deleteInvitation: jest.fn(),
      findViewById: jest.fn(),
    };
    handler = new AcceptInvitationHandler(mockRepo);
  });

  it('throws NotFoundException if invitation does not exist', async () => {
    mockRepo.findInvitationByToken.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new AcceptInvitationCommand('user-1', 'invalid-token', 'guest@example.com')),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException if invitation has expired', async () => {
    mockRepo.findInvitationByToken.mockResolvedValueOnce({
      id: 'inv-1',
      token: 'expired-token',
      expiresAt: new Date(Date.now() - 10000),
    });

    await expect(
      handler.execute(new AcceptInvitationCommand('user-1', 'expired-token', 'guest@example.com')),
    ).rejects.toThrow(BadRequestException);
    expect(mockRepo.deleteInvitation).toHaveBeenCalledWith('inv-1');
  });

  it('adds member and removes invitation when valid', async () => {
    mockRepo.findInvitationByToken.mockResolvedValueOnce({
      id: 'inv-1',
      token: 'valid-token',
      projectId: 'proj-1',
      email: 'guest@example.com',
      role: 'member',
      invitedBy: 'inviter-1',
      expiresAt: new Date(Date.now() + 100000),
    });
    mockRepo.findMembership.mockResolvedValueOnce(null);
    mockRepo.findViewById.mockResolvedValueOnce({ id: 'proj-1', name: 'Project 1' });

    const res = await handler.execute(
      new AcceptInvitationCommand('user-1', 'valid-token', 'Guest@Example.com '),
    );

    expect(mockRepo.addMember).toHaveBeenCalled();
    expect(mockRepo.deleteInvitation).toHaveBeenCalledWith('inv-1');
    expect(res.message).toBe('Successfully joined the project');
  });

  it('rejects a user whose email does not match the invitation', async () => {
    mockRepo.findInvitationByToken.mockResolvedValueOnce({
      id: 'inv-1',
      token: 'valid-token',
      projectId: 'proj-1',
      email: 'guest@example.com',
      role: 'admin',
      invitedBy: 'inviter-1',
      expiresAt: new Date(Date.now() + 100000),
    });

    await expect(
      handler.execute(
        new AcceptInvitationCommand('user-2', 'valid-token', 'someone@else.com'),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(mockRepo.addMember).not.toHaveBeenCalled();
    expect(mockRepo.deleteInvitation).not.toHaveBeenCalled();
  });
});
