// src/modules/projects/application/dtos/project-response.dto.ts
//
// Response shapes + mappers from repository read models (ProjectView) to API output.
// Kept as plain mappers (not class-transformer) to match the auth module's explicit style.

import {
  ProjectMemberView,
  ProjectView,
} from '../../domain/repositories/project.repository.interface';
import { ProjectRole } from '../../domain/value-objects/project-role.value-object';

export interface ProjectMemberResponse {
  userId: string;
  role: ProjectRole;
  name: string;
  email: string;
  avatarUrl: string | null;
  joinedAt: string | null;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  ownerId: string;
  isArchived: boolean;
  members: ProjectMemberResponse[];
  createdAt: string;
  updatedAt: string;
}

export function toMemberResponse(m: ProjectMemberView): ProjectMemberResponse {
  return {
    userId: m.userId,
    role: m.role,
    name: m.name,
    email: m.email,
    avatarUrl: m.avatarUrl,
    joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
  };
}

export function toProjectResponse(p: ProjectView): ProjectResponse {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    color: p.color,
    icon: p.icon,
    ownerId: p.ownerId,
    isArchived: p.isArchived,
    members: p.members.map(toMemberResponse),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
