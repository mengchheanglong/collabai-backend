// src/modules/projects/infrastructure/persistence/project.repository.ts
//
// Prisma implementation of IProjectRepository. Maps the Prisma `Project`/`ProjectMember`
// rows to domain entities and to the denormalized read models (joined with `User`).

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { ProjectEntity } from '../../domain/entities/project.entity';
import { ProjectMemberEntity } from '../../domain/entities/project-member.entity';
import {
  IProjectRepository,
  ListProjectsOptions,
  Paginated,
  ProjectMemberView,
  ProjectView,
} from '../../domain/repositories/project.repository.interface';
import {
  ProjectRole,
  ProjectRoles,
} from '../../domain/value-objects/project-role.value-object';

// Prisma row types for the joined reads.
type MemberRow = Prisma.ProjectMemberGetPayload<{ include: { user: true } }>;
type ProjectRow = Prisma.ProjectGetPayload<{
  include: { members: { include: { user: true } } };
}>;

const projectInclude = {
  members: { include: { user: true }, orderBy: { joinedAt: 'asc' as const } },
} satisfies Prisma.ProjectInclude;

@Injectable()
export class ProjectRepository implements IProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithOwner(
    project: ProjectEntity,
    ownerMember: ProjectMemberEntity,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.project.create({
        data: {
          id: project.id,
          ownerId: project.ownerId,
          name: project.name,
          description: project.description,
          icon: project.icon,
          color: project.color,
          isArchived: project.isArchived,
        },
      }),
      this.prisma.projectMember.create({
        data: {
          id: ownerMember.id,
          projectId: ownerMember.projectId,
          userId: ownerMember.userId,
          role: ownerMember.role,
          invitedBy: ownerMember.invitedBy,
          joinedAt: ownerMember.joinedAt,
          isActive: ownerMember.isActive,
        },
      }),
    ]);
  }

  async findById(id: string): Promise<ProjectEntity | null> {
    const row = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async findViewById(id: string): Promise<ProjectView | null> {
    const row = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: projectInclude,
    });
    return row ? this.toView(row) : null;
  }

  async existsByOwnerAndName(ownerId: string, name: string): Promise<boolean> {
    const count = await this.prisma.project.count({
      where: { ownerId, name: name.trim(), deletedAt: null },
    });
    return count > 0;
  }

  async update(project: ProjectEntity): Promise<void> {
    await this.prisma.project.update({
      where: { id: project.id },
      data: {
        name: project.name,
        description: project.description,
        icon: project.icon,
        color: project.color,
        isArchived: project.isArchived,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }

  async listForUser(
    userId: string,
    options: ListProjectsOptions,
  ): Promise<Paginated<ProjectView>> {
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      members: { some: { userId, isActive: true } },
      ...(options.q
        ? { name: { contains: options.q, mode: 'insensitive' } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: projectInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toView(r)),
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  // ----- membership -----

  async findMembership(
    projectId: string,
    userId: string,
  ): Promise<ProjectMemberEntity | null> {
    const row = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    return row ? this.toMemberDomain(row) : null;
  }

  async listMembers(projectId: string): Promise<ProjectMemberView[]> {
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((r) => this.toMemberView(r));
  }

  async addMember(member: ProjectMemberEntity): Promise<void> {
    await this.prisma.projectMember.create({
      data: {
        id: member.id,
        projectId: member.projectId,
        userId: member.userId,
        role: member.role,
        invitedBy: member.invitedBy,
        joinedAt: member.joinedAt,
        isActive: member.isActive,
      },
    });
  }

  async updateMemberRole(
    projectId: string,
    userId: string,
    role: ProjectRole,
  ): Promise<void> {
    await this.prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role },
    });
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  async countOwners(projectId: string): Promise<number> {
    return this.prisma.projectMember.count({
      where: { projectId, role: 'owner' },
    });
  }

  async findUserByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true },
    });
  }

  // ----- mappers -----

  private toDomain(row: {
    id: string;
    ownerId: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): ProjectEntity {
    return ProjectEntity.fromPersistence({
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      description: row.description,
      icon: row.icon,
      color: row.color,
      isArchived: row.isArchived,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  private toMemberDomain(row: {
    id: string;
    projectId: string;
    userId: string;
    role: string;
    invitedBy: string | null;
    joinedAt: Date | null;
    isActive: boolean;
  }): ProjectMemberEntity {
    return ProjectMemberEntity.fromPersistence({
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      role: this.asRole(row.role),
      invitedBy: row.invitedBy,
      joinedAt: row.joinedAt,
      isActive: row.isActive,
    });
  }

  private toMemberView(row: MemberRow): ProjectMemberView {
    return {
      userId: row.userId,
      role: this.asRole(row.role),
      name: row.user.name,
      email: row.user.email,
      avatarUrl: row.user.avatarUrl ?? null,
      joinedAt: row.joinedAt,
    };
  }

  private toView(row: ProjectRow): ProjectView {
    return {
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      description: row.description,
      icon: row.icon,
      color: row.color,
      isArchived: row.isArchived,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      members: row.members.map((m) => this.toMemberView(m)),
    };
  }

  /** Coerce a DB role string to a ProjectRole, defaulting unknown values to 'member'. */
  private asRole(role: string): ProjectRole {
    return ProjectRoles.isValid(role) ? role : 'member';
  }
}
