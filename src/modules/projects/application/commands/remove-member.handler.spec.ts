// src/modules/projects/application/commands/remove-member.handler.spec.ts

import { RemoveMemberHandler } from './remove-member.handler';
import { RemoveMemberCommand } from './remove-member.command';
import { ProjectDomainService } from '../../domain/services/project.domain.service';
import { LastOwnerError } from '../errors/project.errors';

describe('RemoveMemberHandler', () => {
  let repo: Record<string, jest.Mock>;
  let handler: RemoveMemberHandler;

  const roles: Record<string, string> = {
    owner: 'owner',
    admin: 'admin',
    admin2: 'admin',
    member: 'member',
    member2: 'member',
  };

  beforeEach(() => {
    repo = {
      findMembership: jest.fn((_projectId: string, userId: string) =>
        Promise.resolve(roles[userId] ? { userId, role: roles[userId] } : null),
      ),
      countOwners: jest.fn().mockResolvedValue(1),
      removeMember: jest.fn().mockResolvedValue(undefined),
      findViewById: jest.fn().mockResolvedValue({ id: 'proj-1' }),
    };
    handler = new RemoveMemberHandler(repo as any, new ProjectDomainService());
  });

  const remove = (actor: string, target: string) =>
    handler.execute(new RemoveMemberCommand(actor, 'proj-1', target));

  it('tells members they cannot remove others', async () => {
    await expect(remove('member', 'member2')).rejects.toThrow(
      'Only project owners and admins can remove members.',
    );
    expect(repo.removeMember).not.toHaveBeenCalled();
  });

  it('tells an admin that only the owner can remove an admin', async () => {
    await expect(remove('admin', 'admin2')).rejects.toThrow(
      'Only the project owner can remove an owner or admin.',
    );
  });

  it('lets an admin remove a member', async () => {
    await remove('admin', 'member');
    expect(repo.removeMember).toHaveBeenCalledWith('proj-1', 'member');
  });

  it('explains why the last owner cannot leave', async () => {
    await expect(remove('owner', 'owner')).rejects.toThrow(
      "You're the last owner. Make someone else an owner before leaving the project.",
    );
    await expect(remove('owner', 'owner')).rejects.toThrow(LastOwnerError);
  });
});
