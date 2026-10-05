// src/modules/comments/application/services/comment-access.service.spec.ts

import { CommentAccessService } from './comment-access.service';
import {
  CommentModerationForbiddenError,
  NotProjectMemberError,
} from '../errors/comment.errors';

describe('CommentAccessService.requireAuthorOrModerator', () => {
  let projects: { findMembership: jest.Mock };
  let access: CommentAccessService;

  const as = (role: string | null) =>
    projects.findMembership.mockResolvedValueOnce(role ? { role } : null);

  beforeEach(() => {
    projects = { findMembership: jest.fn() };
    access = new CommentAccessService(projects as any);
  });

  it('lets a member edit their own comment', async () => {
    as('member');
    await expect(
      access.requireAuthorOrModerator('proj-1', 'user-1', 'user-1'),
    ).resolves.toBeUndefined();
  });

  it("blocks a member from editing someone else's comment", async () => {
    as('member');
    await expect(
      access.requireAuthorOrModerator('proj-1', 'user-1', 'user-2'),
    ).rejects.toThrow(CommentModerationForbiddenError);
  });

  it('lets owners and admins moderate any comment', async () => {
    as('admin');
    await expect(
      access.requireAuthorOrModerator('proj-1', 'admin-1', 'user-2'),
    ).resolves.toBeUndefined();
    as('owner');
    await expect(
      access.requireAuthorOrModerator('proj-1', 'owner-1', 'user-2'),
    ).resolves.toBeUndefined();
  });

  it('tells a viewer they are view-only, even for their own earlier comment', async () => {
    as('viewer');
    await expect(
      access.requireAuthorOrModerator('proj-1', 'user-1', 'user-1'),
    ).rejects.toThrow(
      'You have view-only access to this project. Ask an owner or admin for Member access to make changes.',
    );
  });

  it('rejects non-members', async () => {
    as(null);
    await expect(
      access.requireAuthorOrModerator('proj-1', 'user-9', 'user-9'),
    ).rejects.toThrow(NotProjectMemberError);
  });
});
