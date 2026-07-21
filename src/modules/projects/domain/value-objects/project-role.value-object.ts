// src/modules/projects/domain/value-objects/project-role.value-object.ts
//
// Project membership roles and the pure permission rules attached to them.
// Ranked so "at least admin" style checks are a single comparison. All authorization
// predicates the handlers need live here so the rules stay in one testable place.

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export const PROJECT_ROLES: readonly ProjectRole[] = [
  'owner',
  'admin',
  'member',
  'viewer',
];

const RANK: Record<ProjectRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
  viewer: 0,
};

export const ProjectRoles = {
  isValid(role: string): role is ProjectRole {
    return (PROJECT_ROLES as readonly string[]).includes(role);
  },

  rank(role: ProjectRole): number {
    return RANK[role];
  },

  /** True when `role` is `min` or higher in the hierarchy. */
  atLeast(role: ProjectRole, min: ProjectRole): boolean {
    return RANK[role] >= RANK[min];
  },

  /** Owner/admin may invite, remove, and re-role members. */
  canManageMembers(role: ProjectRole): boolean {
    return this.atLeast(role, 'admin');
  },

  /** Owner/admin may edit project metadata. */
  canEditProject(role: ProjectRole): boolean {
    return this.atLeast(role, 'admin');
  },

  /** Only the owner may delete the project. */
  canDeleteProject(role: ProjectRole): boolean {
    return role === 'owner';
  },

  /** Members and above may create/modify content (tasks, comments); viewers are read-only. */
  canWriteContent(role: ProjectRole): boolean {
    return this.atLeast(role, 'member');
  },
} as const;
