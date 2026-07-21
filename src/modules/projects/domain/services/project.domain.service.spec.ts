// src/modules/projects/domain/services/project.domain.service.spec.ts
import { ProjectDomainService } from './project.domain.service';

describe('ProjectDomainService', () => {
  const svc = new ProjectDomainService();

  describe('canAssignRole', () => {
    it('lets an owner grant admin', () => {
      expect(svc.canAssignRole('owner', 'member', 'admin')).toBe(true);
    });

    it('forbids an admin from granting admin', () => {
      expect(svc.canAssignRole('admin', 'member', 'admin')).toBe(false);
    });

    it('forbids an admin from changing another admin', () => {
      expect(svc.canAssignRole('admin', 'admin', 'member')).toBe(false);
    });

    it('lets an admin move a member to viewer and back', () => {
      expect(svc.canAssignRole('admin', 'member', 'viewer')).toBe(true);
      expect(svc.canAssignRole('admin', 'viewer', 'member')).toBe(true);
    });

    it('forbids a plain member from managing roles', () => {
      expect(svc.canAssignRole('member', 'viewer', 'member')).toBe(false);
    });
  });

  describe('wouldLeaveNoOwner', () => {
    it('is true for the sole owner', () => {
      expect(svc.wouldLeaveNoOwner('owner', 1)).toBe(true);
    });
    it('is false when another owner exists', () => {
      expect(svc.wouldLeaveNoOwner('owner', 2)).toBe(false);
    });
    it('is false for a non-owner', () => {
      expect(svc.wouldLeaveNoOwner('admin', 1)).toBe(false);
    });
  });

  describe('canRemoveMember', () => {
    it('lets anyone remove themselves', () => {
      expect(svc.canRemoveMember('u1', 'member', 'u1', 'member')).toBe(true);
    });
    it('lets an admin remove a member', () => {
      expect(svc.canRemoveMember('a', 'admin', 'b', 'member')).toBe(true);
    });
    it('forbids an admin from removing another admin', () => {
      expect(svc.canRemoveMember('a', 'admin', 'b', 'admin')).toBe(false);
    });
    it('lets an owner remove an admin', () => {
      expect(svc.canRemoveMember('o', 'owner', 'b', 'admin')).toBe(true);
    });
    it('forbids a member from removing others', () => {
      expect(svc.canRemoveMember('a', 'member', 'b', 'viewer')).toBe(false);
    });
  });
});
