// src/modules/projects/domain/services/project.domain.service.ts
//
// Pure project business rules that are more than a single role comparison. No I/O, no
// throwing — returns predicates/validation results the handlers act on (mirrors the
// auth module's pure AuthDomainService). Simple "can this role do X" checks live on the
// ProjectRoles value object; the multi-party rules live here.

import { Injectable } from '@nestjs/common';
import {
  ProjectRole,
  ProjectRoles,
} from '../value-objects/project-role.value-object';

@Injectable()
export class ProjectDomainService {
  /**
   * Whether `actorRole` may change a member's role from `targetCurrentRole` to `newRole`.
   *
   * Rules:
   *  - actor must be able to manage members at all (admin or owner);
   *  - touching an owner/admin (either the current or the target role is owner/admin)
   *    requires the actor to be an owner — admins may only manage member/viewer.
   */
  canAssignRole(
    actorRole: ProjectRole,
    targetCurrentRole: ProjectRole,
    newRole: ProjectRole,
  ): boolean {
    if (!ProjectRoles.canManageMembers(actorRole)) return false;

    const touchesPrivileged =
      ProjectRoles.atLeast(targetCurrentRole, 'admin') ||
      ProjectRoles.atLeast(newRole, 'admin');

    if (touchesPrivileged && actorRole !== 'owner') return false;
    return true;
  }

  /**
   * Whether removing/demoting a member with `currentRole` would strip the project of its
   * last owner. `ownerCount` is the current number of owners.
   */
  wouldLeaveNoOwner(currentRole: ProjectRole, ownerCount: number): boolean {
    return currentRole === 'owner' && ownerCount <= 1;
  }

  /**
   * Whether `actorRole` (acting on `actorUserId`) may remove the membership of
   * `targetUserId` with `targetRole`. Managers can remove others; anyone may remove
   * themselves (leave the project).
   */
  canRemoveMember(
    actorUserId: string,
    actorRole: ProjectRole,
    targetUserId: string,
    targetRole: ProjectRole,
  ): boolean {
    if (actorUserId === targetUserId) return true; // leave
    if (!ProjectRoles.canManageMembers(actorRole)) return false;
    // Only an owner may remove another owner/admin.
    if (ProjectRoles.atLeast(targetRole, 'admin') && actorRole !== 'owner') {
      return false;
    }
    return true;
  }
}
