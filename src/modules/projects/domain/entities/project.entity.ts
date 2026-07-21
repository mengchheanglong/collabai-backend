// src/modules/projects/domain/entities/project.entity.ts
//
// Project aggregate root. Owns metadata state transitions (rename, re-describe, recolor,
// archive/soft-delete). Membership lives in its own ProjectMemberEntity/table; this entity
// only holds the owning user (`ownerId`) and descriptive fields. Maps 1:1 to the Prisma
// `Project` model.

export interface ProjectProps {
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
}

export interface CreateProjectProps {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
}

export class ProjectEntity {
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

  private constructor(props: ProjectProps) {
    this.id = props.id;
    this.ownerId = props.ownerId;
    this.name = props.name;
    this.description = props.description;
    this.icon = props.icon;
    this.color = props.color;
    this.isArchived = props.isArchived;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: CreateProjectProps): ProjectEntity {
    const now = new Date();
    return new ProjectEntity({
      id: props.id,
      ownerId: props.ownerId,
      name: props.name.trim(),
      description: props.description?.trim() ?? null,
      icon: props.icon ?? null,
      color: props.color ?? null,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static fromPersistence(props: ProjectProps): ProjectEntity {
    return new ProjectEntity(props);
  }

  /** Apply a partial metadata update. Only provided fields change. */
  applyUpdate(patch: {
    name?: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
  }): void {
    if (patch.name !== undefined) this.name = patch.name.trim();
    if (patch.description !== undefined)
      this.description = patch.description?.trim() ?? null;
    if (patch.icon !== undefined) this.icon = patch.icon ?? null;
    if (patch.color !== undefined) this.color = patch.color ?? null;
    this.touch();
  }

  archive(): void {
    this.isArchived = true;
    this.touch();
  }

  private touch(): void {
    this.updatedAt = new Date();
  }
}
