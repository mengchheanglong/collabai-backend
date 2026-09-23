import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../../shared/services/prisma.service';
import { DocsService } from './docs.service';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  ListDocumentsDto,
} from './docs.dto';

describe('Workspace document authorization and concurrency', () => {
  const document = {
    id: 'doc',
    projectId: 'project',
    title: 'Guide',
    content: '',
    version: 1,
  };
  let db: any;
  let service: DocsService;
  beforeEach(() => {
    db = {
      projectMember: {
        findFirst: jest.fn().mockResolvedValue({ role: 'member' }),
      },
      document: {
        findFirst: jest.fn().mockResolvedValue(document),
        create: jest.fn().mockResolvedValue(document),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ ...document, version: 2 }),
      },
      $transaction: jest.fn((fn) => fn(db)),
    };
    service = new DocsService(db as PrismaService);
  });
  it('scopes access to active membership and live projects', async () => {
    await service.get('doc', 'user');
    expect(db.projectMember.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: 'project',
        userId: 'user',
        isActive: true,
        project: { deletedAt: null },
      },
    });
  });
  it('rejects nonmembers on reads and all writes', async () => {
    db.projectMember.findFirst.mockResolvedValue(null);
    for (const run of [
      () => service.get('doc', 'outsider'),
      () => service.list('project', 'outsider', new ListDocumentsDto()),
      () => service.create('project', 'outsider', { title: 'Guide' }),
      () => service.update('doc', 'outsider', { version: 1 }),
      () => service.remove('doc', 'outsider'),
    ])
      await expect(run()).rejects.toThrow(NotFoundException);
    expect(db.document.create).not.toHaveBeenCalled();
    expect(db.document.updateMany).not.toHaveBeenCalled();
  });
  it('allows viewer reads but rejects create/update/delete', async () => {
    db.projectMember.findFirst.mockResolvedValue({ role: 'viewer' });
    expect((await service.get('doc', 'viewer')).canEdit).toBe(false);
    for (const run of [
      () => service.create('project', 'viewer', { title: 'Guide' }),
      () => service.update('doc', 'viewer', { version: 1 }),
      () => service.remove('doc', 'viewer'),
    ])
      await expect(run()).rejects.toThrow(ForbiddenException);
  });
  it('returns 404 for missing or deleted documents', async () => {
    db.document.findFirst.mockResolvedValue(null);
    await expect(service.get('doc', 'user')).rejects.toThrow(NotFoundException);
    expect(db.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc', deletedAt: null },
    });
  });
  it('atomically rejects stale updates', async () => {
    db.document.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update('doc', 'user', { title: 'Draft', version: 1 }),
    ).rejects.toThrow(ConflictException);
    expect(db.document.findUniqueOrThrow).not.toHaveBeenCalled();
  });
  it('increments version and persists empty Markdown', async () => {
    await service.update('doc', 'user', { content: '', version: 1 });
    expect(db.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'doc', deletedAt: null, version: 1 },
      data: { title: undefined, content: '', version: { increment: 1 } },
    });
  });
  it('soft deletes after authorization', async () => {
    expect(await service.remove('doc', 'user')).toBeNull();
    expect(db.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'doc', deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe('Document request validation', () => {
  it('rejects blank titles, null content, large content and missing versions', async () => {
    for (const body of [
      { title: '  ' },
      { title: 'Guide', content: null },
      { title: 'Guide', content: 'x'.repeat(100001) },
    ])
      expect(
        (await validate(plainToInstance(CreateDocumentDto, body))).length,
      ).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(UpdateDocumentDto, { title: 'Guide' })))
        .length,
    ).toBeGreaterThan(0);
  });
  it('trims titles and bounds pagination', async () => {
    const body = plainToInstance(CreateDocumentDto, {
      title: ' Guide ',
      content: '',
    });
    expect(body.title).toBe('Guide');
    expect(await validate(body)).toHaveLength(0);
    expect(
      (await validate(plainToInstance(ListDocumentsDto, { limit: '101' })))
        .length,
    ).toBeGreaterThan(0);
  });
});
