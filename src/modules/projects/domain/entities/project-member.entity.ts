// src/modules/projects/domain/entities/project-member.entity.ts
//
// A user's membership in a project, carrying their role. Maps to the Prisma
// `ProjectMember` model (unique per [projectId, userId]). For MVP a member is added
// directly (no pending-invitation token flow), so `joinedAt` is set on creation.

import { ProjectRole } from '../value-objects/project-role.value-object';

export interface ProjectMemberProps {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  invitedBy: string | null;
  joinedAt: Date | null;
  isActive: boolean;
}

export interface CreateProjectMemberProps {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  invitedBy?: string | null;
}

export class ProjectMemberEntity {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  invitedBy: string | null;
  joinedAt: Date | null;
  isActive: boolean;

  private constructor(props: ProjectMemberProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.userId = props.userId;
    this.role = props.role;
    this.invitedBy = props.invitedBy;
    this.joinedAt = props.joinedAt;
    this.isActive = props.isActive;
  }

  static create(props: CreateProjectMemberProps): ProjectMemberEntity {
    return new ProjectMemberEntity({
      id: props.id,
      projectId: props.projectId,
      userId: props.userId,
      role: props.role,
      invitedBy: props.invitedBy ?? null,
      joinedAt: new Date(),
      isActive: true,
    });
  }

  static fromPersistence(props: ProjectMemberProps): ProjectMemberEntity {
    return new ProjectMemberEntity(props);
  }

  changeRole(role: ProjectRole): void {
    this.role = role;
  }
}
