import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateDocumentHandler } from './create-document.handler';
import { CreateDocumentCommand } from './create-document.command';
import { IDocumentRepository } from '../../domain/repositories/document.repository.interface';
import { IProjectRepository } from '../../../projects/domain/repositories/project.repository.interface';
import { DocumentForbiddenError } from '../errors/document.errors';

describe('CreateDocumentHandler', () => {
  let handler: CreateDocumentHandler;
  let repo: jest.Mocked<IDocumentRepository>;
  let projectRepo: jest.Mocked<IProjectRepository>;
  let events: jest.Mocked<EventEmitter2>;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue(undefined),
      findViewById: jest.fn().mockResolvedValue({
        id: 'doc-1',
        projectId: 'proj-1',
        title: 'PRD',
        content: 'Content',
        createdById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as any;
    projectRepo = {
      findMembership: jest.fn(),
    } as any;
    events = {
      emit: jest.fn(),
    } as any;

    handler = new CreateDocumentHandler(repo, projectRepo, events);
  });

  it('throws DocumentForbiddenError when user is not an active member', async () => {
    projectRepo.findMembership.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new CreateDocumentCommand('user-1', 'proj-1', 'PRD', 'Content')),
    ).rejects.toThrow(DocumentForbiddenError);

    expect(repo.create).not.toHaveBeenCalled();
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
      handler.execute(new CreateDocumentCommand('user-viewer', 'proj-1', 'PRD', 'Content')),
    ).rejects.toThrow(DocumentForbiddenError);

    expect(repo.create).not.toHaveBeenCalled();
  });

  it('creates document and emits document.created when user is a member', async () => {
    projectRepo.findMembership.mockResolvedValueOnce({
      id: 'm-1',
      projectId: 'proj-1',
      userId: 'user-1',
      role: 'member',
      isActive: true,
    } as any);

    const result = await handler.execute(
      new CreateDocumentCommand('user-1', 'proj-1', 'PRD', 'Content'),
    );

    expect(repo.create).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      'document.created',
      expect.objectContaining({
        projectId: 'proj-1',
        actorId: 'user-1',
      }),
    );
    expect(result.id).toBe('doc-1');
  });

  it('creates document with auto-derived title and empty content when title and text are omitted', async () => {
    projectRepo.findMembership.mockResolvedValueOnce({
      id: 'm-1',
      projectId: 'proj-1',
      userId: 'user-1',
      role: 'member',
      isActive: true,
    } as any);

    const result = await handler.execute(
      new CreateDocumentCommand(
        'user-1',
        'proj-1',
        undefined,
        undefined,
        [{ id: 'att-1', name: 'Specification.pdf', url: 'data:...', size: 1024 }],
        'pdf',
      ),
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Specification.pdf',
        content: '',
        fileType: 'pdf',
      }),
    );
    expect(result.id).toBe('doc-1');
  });
});
