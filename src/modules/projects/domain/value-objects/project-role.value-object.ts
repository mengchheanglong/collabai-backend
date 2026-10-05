// src/modules/projects/domain/value-objects/project-role.value-object.ts
//
// Project membership roles and the pure permission rules attached to them.
// Ranked so "at least admin" style checks are a single comparison. All authorization
// predicates the handlers need live here so the rules stay in one testable place.

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

/** Shown when a member tries to give a task to someone else. */
export const ASSIGN_FORBIDDEN_MESSAGE =
  'Only project owners and admins can assign tasks to other people. You can take an unassigned task yourself or remove yourself from a task.';

/** Shown when a member tries to change a task assigned to someone else. */
export const NOT_YOUR_TASK_MESSAGE =
  "Only the task's assignee or a project owner/admin can change this task.";

/** Shown whenever a viewer tries to change project content (same wording as the frontend). */
export const VIEW_ONLY_MESSAGE =
  'You have view-only access to this project. Ask an owner or admin for Member access to make changes.';

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

  /**
   * Who may set a task's assignee from `current` to `next` (null = unassigned):
   * owners/admins — anyone; members — only take an unassigned task themselves or
   * remove themselves; viewers — never. No change is always allowed.
   */
  canChangeAssignee(
    role: ProjectRole,
    actorId: string,
    current: string | null,
    next: string | null,
  ): boolean {
    if (current === next) return true;
    if (this.canManageMembers(role)) return true;
    if (!this.canWriteContent(role)) return false;
    return (current === null && next === actorId) || (current === actorId && next === null);
  },

  /**
   * Who may change a task (edit, move, delete, subtasks): owners/admins always; members
   * when the task is theirs or unassigned; viewers never. Comments stay open to members.
   */
  canWorkOnTask(role: ProjectRole, actorId: string, assigneeId: string | null): boolean {
    if (this.canManageMembers(role)) return true;
    if (!this.canWriteContent(role)) return false;
    return assigneeId === null || assigneeId === actorId;
  },

  /** Members and above may create/modify content (tasks, comments); viewers are read-only. */
  canWriteContent(role: ProjectRole): boolean {
    return this.atLeast(role, 'member');
  },
} as const;
