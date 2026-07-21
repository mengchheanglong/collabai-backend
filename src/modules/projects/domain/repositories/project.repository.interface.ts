// src/modules/projects/domain/repositories/project.repository.interface.ts
//
// Port for project persistence. The application layer depends only on this interface;
// the Prisma implementation is bound to PROJECT_REPOSITORY in projects.module.ts.
//
// Read models (`ProjectView`, `ProjectMemberView`) are denormalized shapes joined with
// the User table so queries can return members with their name/email in one round-trip,
// without the application layer touching Prisma.

import { ProjectEntity } from '../entities/project.entity';
import { ProjectMemberEntity } from '../entities/project-member.entity';
import { ProjectRole } from '../value-objects/project-role.value-object';

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface ProjectMemberView {
  userId: string;
  role: ProjectRole;
  name: string;
  email: string;
  avatarUrl: string | null;
  joinedAt: Date | null;
}

export interface ProjectView {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  members: ProjectMemberView[];
}

export interface ListProjectsOptions {
  q?: string;
  page: number;
  limit: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IProjectRepository {
  /** Insert the project and its owner membership atomically. */
  createWithOwner(
    project: ProjectEntity,
    ownerMember: ProjectMemberEntity,
  ): Promise<void>;

  findById(id: string): Promise<ProjectEntity | null>;

  /** Project with its members joined to user data; null if missing. */
  findViewById(id: string): Promise<ProjectView | null>;

  existsByOwnerAndName(ownerId: string, name: string): Promise<boolean>;

  update(project: ProjectEntity): Promise<void>;

  /** Hard delete; Prisma cascade removes members/tasks/comments/activities. */
  delete(id: string): Promise<void>;

  /** Projects the user is a member of, paginated, optional name search. */
  listForUser(
    userId: string,
    options: ListProjectsOptions,
  ): Promise<Paginated<ProjectView>>;

  // ----- membership -----

  findMembership(
    projectId: string,
    userId: string,
  ): Promise<ProjectMemberEntity | null>;

  listMembers(projectId: string): Promise<ProjectMemberView[]>;

  addMember(member: ProjectMemberEntity): Promise<void>;

  updateMemberRole(
    projectId: string,
    userId: string,
    role: ProjectRole,
  ): Promise<void>;

  removeMember(projectId: string, userId: string): Promise<void>;

  countOwners(projectId: string): Promise<number>;

  // ----- cross-aggregate lookup for invitations -----

  /** Minimal user lookup by email (to resolve an invitee). */
  findUserByEmail(email: string): Promise<{ id: string } | null>;
}
