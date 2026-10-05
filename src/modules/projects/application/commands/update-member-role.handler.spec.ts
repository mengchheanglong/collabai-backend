// src/modules/projects/application/commands/update-member-role.handler.spec.ts

import { UpdateMemberRoleHandler } from './update-member-role.handler';
import { UpdateMemberRoleCommand } from './update-member-role.command';
import { ProjectDomainService } from '../../domain/services/project.domain.service';
import {
  InsufficientProjectPermissionError,
  LastOwnerError,
} from '../errors/project.errors';

describe('UpdateMemberRoleHandler', () => {
  let repo: Record<string, jest.Mock>;
  let handler: UpdateMemberRoleHandler;

  const roles: Record<string, string> = {
    owner: 'owner',
    admin: 'admin',
    member: 'member',
    viewer: 'viewer',
    owner2: 'owner',
  };

  beforeEach(() => {
    repo = {
      findMembership: jest.fn((_projectId: string, userId: string) =>
        Promise.resolve(roles[userId] ? { userId, role: roles[userId] } : null),
      ),
      countOwners: jest.fn().mockResolvedValue(1),
      updateMemberRole: jest.fn().mockResolvedValue(undefined),
      findViewById: jest.fn().mockResolvedValue({ id: 'proj-1' }),
    };
    handler = new UpdateMemberRoleHandler(repo as any, new ProjectDomainService());
  });

  const change = (actor: string, target: string, role: any) =>
    handler.execute(new UpdateMemberRoleCommand(actor, 'proj-1', target, role));

  it("refuses to let anyone change their own role", async () => {
    await expect(change('admin', 'admin', 'owner')).rejects.toThrow(
      "You can't change your own role. Ask a project owner to do it.",
    );
    await expect(change('member', 'member', 'admin')).rejects.toThrow(
      "You can't change your own role",
    );
    expect(repo.updateMemberRole).not.toHaveBeenCalled();
  });

  it('refuses members and viewers with a clear reason', async () => {
    await expect(change('member', 'viewer', 'member')).rejects.toThrow(
      'Only project owners and admins can change member roles.',
    );
    await expect(change('viewer', 'member', 'viewer')).rejects.toThrow(
      InsufficientProjectPermissionError,
    );
  });

  it('tells an admin that only the owner can grant admin', async () => {
    await expect(change('admin', 'member', 'admin')).rejects.toThrow(
      'Only the project owner can grant, change or remove the owner and admin roles.',
    );
  });

  it('lets an admin switch a member to viewer', async () => {
    await change('admin', 'member', 'viewer');
    expect(repo.updateMemberRole).toHaveBeenCalledWith(
      'proj-1',
      'member',
      'viewer',
    );
  });

  it('lets the owner promote a member to admin', async () => {
    await change('owner', 'member', 'admin');
    expect(repo.updateMemberRole).toHaveBeenCalledWith('proj-1', 'member', 'admin');
  });

  it('keeps at least one owner', async () => {
    roles.owner2 = 'owner';
    await expect(change('owner2', 'owner', 'member')).rejects.toThrow(
      LastOwnerError,
    );
  });
});
