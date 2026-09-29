// src/modules/documents/infrastructure/persistence/document.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { isValidUuid } from '../../../../common/utils/uuid.util';
import { DocumentEntity } from '../../domain/entities/document.entity';
import {
  IDocumentRepository,
  DocumentView,
} from '../../domain/repositories/document.repository.interface';

@Injectable()
export class DocumentRepository implements IDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<DocumentEntity | null> {
    if (!isValidUuid(id)) return null;
    const row = await this.prisma.document.findUnique({
      where: { id },
    });
    if (!row) return null;
    return DocumentEntity.fromPersistence({
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      content: row.content,
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findViewById(id: string): Promise<DocumentView | null> {
    if (!isValidUuid(id)) return null;
    const row = await this.prisma.document.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      content: row.content,
      createdById: row.createdById,
      creatorName: row.creator?.name ?? null,
      creatorEmail: row.creator?.email ?? null,
      creatorAvatarUrl: row.creator?.avatarUrl ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listByProjectId(projectId: string): Promise<DocumentView[]> {
    if (!isValidUuid(projectId)) return [];
    const rows = await this.prisma.document.findMany({
      where: { projectId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      content: row.content,
      createdById: row.createdById,
      creatorName: row.creator?.name ?? null,
      creatorEmail: row.creator?.email ?? null,
      creatorAvatarUrl: row.creator?.avatarUrl ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async create(doc: DocumentEntity): Promise<void> {
    await this.prisma.document.create({
      data: {
        id: doc.id,
        projectId: doc.projectId,
        title: doc.title,
        content: doc.content,
        createdById: doc.createdById,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    });
  }

  async update(doc: DocumentEntity): Promise<void> {
    await this.prisma.document.update({
      where: { id: doc.id },
      data: {
        title: doc.title,
        content: doc.content,
        updatedAt: doc.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    if (!isValidUuid(id)) return;
    await this.prisma.document.delete({
      where: { id },
    });
  }
}
