// src/modules/projects/infrastructure/event-handlers/invitation-events.listener.spec.ts

import { InvitationEventsListener } from './invitation-events.listener';
import { EmailVerifiedEvent } from '../../../auth/domain/events/email-verified.event';

describe('InvitationEventsListener', () => {
  let repo: Record<string, jest.Mock>;
  let events: { emit: jest.Mock };
  let listener: InvitationEventsListener;

  const invitation = (overrides: Record<string, unknown> = {}) => ({
    id: 'inv-1',
    projectId: 'proj-1',
    email: 'guest@example.com',
    role: 'member',
    token: 't',
    invitedBy: 'owner-1',
    expiresAt: new Date(Date.now() + 86_400_000),
    ...overrides,
  });

  beforeEach(() => {
    repo = {
      listInvitationsByEmail: jest.fn().mockResolvedValue([]),
      findMembership: jest.fn().mockResolvedValue(null),
      addMember: jest.fn().mockResolvedValue(undefined),
      deleteInvitation: jest.fn().mockResolvedValue(undefined),
    };
    events = { emit: jest.fn() };
    listener = new InvitationEventsListener(repo as any, events as any);
  });

  const verify = () =>
    listener.onEmailVerified(
      new EmailVerifiedEvent('user-1', 'guest@example.com'),
    );

  it('turns each pending invitation into a membership with the invited role', async () => {
    repo.listInvitationsByEmail.mockResolvedValueOnce([
      invitation(),
      invitation({ id: 'inv-2', projectId: 'proj-2', role: 'viewer' }),
    ]);

    await verify();

    expect(repo.listInvitationsByEmail).toHaveBeenCalledWith('guest@example.com');
    expect(repo.addMember).toHaveBeenCalledTimes(2);
    expect(repo.addMember.mock.calls[0][0]).toMatchObject({
      projectId: 'proj-1',
      userId: 'user-1',
      role: 'member',
      invitedBy: 'owner-1',
    });
    expect(repo.addMember.mock.calls[1][0]).toMatchObject({
      projectId: 'proj-2',
      role: 'viewer',
    });
    expect(repo.deleteInvitation).toHaveBeenCalledWith('inv-1');
    expect(repo.deleteInvitation).toHaveBeenCalledWith('inv-2');
    expect(events.emit).toHaveBeenCalledWith('member.added', {
      projectId: 'proj-1',
      actorId: 'owner-1',
      userId: 'user-1',
      role: 'member',
    });
  });

  it('leaves expired invitations for the admin to resend', async () => {
    repo.listInvitationsByEmail.mockResolvedValueOnce([
      invitation({ expiresAt: new Date(Date.now() - 1000) }),
    ]);

    await verify();

    expect(repo.addMember).not.toHaveBeenCalled();
    expect(repo.deleteInvitation).not.toHaveBeenCalled();
  });

  it('just clears the invitation when the user is already a member', async () => {
    repo.listInvitationsByEmail.mockResolvedValueOnce([invitation()]);
    repo.findMembership.mockResolvedValueOnce({ role: 'member' });

    await verify();

    expect(repo.addMember).not.toHaveBeenCalled();
    expect(repo.deleteInvitation).toHaveBeenCalledWith('inv-1');
  });

  it('keeps going when one invitation fails', async () => {
    repo.listInvitationsByEmail.mockResolvedValueOnce([
      invitation(),
      invitation({ id: 'inv-2', projectId: 'proj-2' }),
    ]);
    repo.addMember.mockRejectedValueOnce(new Error('db down'));

    await expect(verify()).resolves.toBeUndefined();
    expect(repo.addMember).toHaveBeenCalledTimes(2);
    expect(repo.deleteInvitation).toHaveBeenCalledWith('inv-2');
    expect(repo.deleteInvitation).not.toHaveBeenCalledWith('inv-1');
  });
});
