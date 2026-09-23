import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  ListDocumentsDto,
} from './docs.dto';

@Injectable()
export class DocsService {
  constructor(private readonly db: PrismaService) {}

  async access(projectId: string, userId: string, write = false) {
    const member = await this.db.projectMember.findFirst({
      where: {
        projectId,
        userId,
        isActive: true,
        project: { deletedAt: null },
      },
    });
    if (!member) throw new NotFoundException('Project not found');
    const canEdit = ['owner', 'admin', 'member'].includes(member.role);
    if (write && !canEdit)
      throw new ForbiddenException('This project is read-only');
    return canEdit;
  }

  async get(id: string, userId: string, write = false) {
    const document = await this.db.document.findFirst({
      where: { id, deletedAt: null },
    });
    if (!document) throw new NotFoundException('Document not found');
    const canEdit = await this.access(document.projectId, userId, write);
    return { document, canEdit };
  }

  async list(projectId: string, userId: string, query: ListDocumentsDto) {
    await this.access(projectId, userId);
    const where = {
      projectId,
      deletedAt: null,
      ...(query.q
        ? { title: { contains: query.q, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.document.findMany({
        where,
        select: {
          id: true,
          projectId: true,
          createdById: true,
          title: true,
          version: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.document.count({ where }),
    ]);
    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async create(projectId: string, userId: string, input: CreateDocumentDto) {
    await this.access(projectId, userId, true);
    return {
      document: await this.db.document.create({
        data: {
          projectId,
          createdById: userId,
          title: input.title,
          content: input.content ?? '',
        },
      }),
    };
  }

  async update(id: string, userId: string, input: UpdateDocumentDto) {
    await this.get(id, userId, true);
    return this.db.$transaction(async (tx) => {
      const result = await tx.document.updateMany({
        where: { id, deletedAt: null, version: input.version },
        data: {
          title: input.title,
          content: input.content,
          version: { increment: 1 },
        },
      });
      if (!result.count)
        throw new ConflictException(
          'Document changed. Copy your draft, then reload the latest version.',
        );
      return {
        document: await tx.document.findUniqueOrThrow({ where: { id } }),
      };
    });
  }

  async remove(id: string, userId: string) {
    await this.get(id, userId, true);
    await this.db.document.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return null;
  }
}
