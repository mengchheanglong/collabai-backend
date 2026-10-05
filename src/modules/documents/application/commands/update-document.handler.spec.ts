import { EventEmitter2 } from '@nestjs/event-emitter';
import { UpdateDocumentHandler } from './update-document.handler';
import { UpdateDocumentCommand } from './update-document.command';
import { IDocumentRepository } from '../../domain/repositories/document.repository.interface';
import { IProjectRepository } from '../../../projects/domain/repositories/project.repository.interface';
import {
  DocumentConflictError,
  DocumentForbiddenError,
  DocumentNotFoundError,
} from '../errors/document.errors';
import { DocumentEntity } from '../../domain/entities/document.entity';

describe('UpdateDocumentHandler', () => {
  let handler: UpdateDocumentHandler;
  let repo: jest.Mocked<IDocumentRepository>;
  let projectRepo: jest.Mocked<IProjectRepository>;
  let events: jest.Mocked<EventEmitter2>;

  const initialDate = new Date('2026-09-28T12:00:00.000Z');
  const initialVersion = Math.floor(initialDate.getTime() / 1000);

  beforeEach(() => {
    const mockEntity = DocumentEntity.fromPersistence({
      id: 'doc-1',
      projectId: 'proj-1',
      title: 'Old Title',
      content: 'Old Content',
      createdById: 'user-1',
      createdAt: initialDate,
      updatedAt: initialDate,
    });

    repo = {
      findById: jest.fn().mockResolvedValue(mockEntity),
      update: jest.fn().mockResolvedValue(undefined),
      findViewById: jest.fn().mockResolvedValue({
        id: 'doc-1',
        projectId: 'proj-1',
        title: 'New Title',
        content: 'New Content',
        createdById: 'user-1',
        createdAt: initialDate,
        updatedAt: new Date('2026-09-28T12:05:00.000Z'),
      }),
    } as any;

    projectRepo = {
      findMembership: jest.fn().mockResolvedValue({
        id: 'm-1',
        projectId: 'proj-1',
        userId: 'user-1',
        role: 'member',
        isActive: true,
      } as any),
    } as any;

    events = {
      emit: jest.fn(),
    } as any;

    handler = new UpdateDocumentHandler(repo, projectRepo, events);
  });

  it('throws DocumentNotFoundError when document does not exist', async () => {
    repo.findById.mockResolvedValueOnce(null);

    await expect(
      handler.execute(
        new UpdateDocumentCommand('user-1', 'doc-999', { title: 'New' }),
      ),
    ).rejects.toThrow(DocumentNotFoundError);
  });

  it('throws DocumentForbiddenError when user is not a project member', async () => {
    projectRepo.findMembership.mockResolvedValueOnce(null);

    await expect(
      handler.execute(
        new UpdateDocumentCommand('user-outsider', 'doc-1', { title: 'New' }),
      ),
    ).rejects.toThrow(DocumentForbiddenError);
  });

  it('throws DocumentForbiddenError when user role is viewer', async () => {
    projectRepo.findMembership.mockResolvedValueOnce({
      id: 'm-1',
      projectId: 'proj-1',
      userId: 'user-viewer',
      role: 'viewer',
      isActive: true,
    } as any);

    await expect(
      handler.execute(
        new UpdateDocumentCommand('user-viewer', 'doc-1', { title: 'New' }),
      ),
    ).rejects.toThrow(DocumentForbiddenError);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws DocumentConflictError when expectedVersion does not match current version', async () => {
    await expect(
      handler.execute(
        new UpdateDocumentCommand(
          'user-1',
          'doc-1',
          { title: 'New' },
          initialVersion - 100, // Stale version
        ),
      ),
    ).rejects.toThrow(DocumentConflictError);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('updates document and emits event when expectedVersion matches', async () => {
    const result = await handler.execute(
      new UpdateDocumentCommand(
        'user-1',
        'doc-1',
        { title: 'New Title', content: 'New Content' },
        initialVersion,
      ),
    );

    expect(repo.update).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      'document.updated',
      expect.objectContaining({
        projectId: 'proj-1',
        documentId: 'doc-1',
        actorId: 'user-1',
      }),
    );
    expect(result.title).toBe('New Title');
  });

  it('updates document without version check when expectedVersion is omitted', async () => {
    const result = await handler.execute(
      new UpdateDocumentCommand('user-1', 'doc-1', { title: 'New Title' }),
    );

    expect(repo.update).toHaveBeenCalled();
    expect(result.title).toBe('New Title');
  });
});
