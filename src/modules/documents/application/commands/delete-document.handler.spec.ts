import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeleteDocumentHandler } from './delete-document.handler';
import { DeleteDocumentCommand } from './delete-document.command';
import { IDocumentRepository } from '../../domain/repositories/document.repository.interface';
import { IProjectRepository } from '../../../projects/domain/repositories/project.repository.interface';
import { DocumentForbiddenError, DocumentNotFoundError } from '../errors/document.errors';
import { DocumentEntity } from '../../domain/entities/document.entity';

describe('DeleteDocumentHandler', () => {
  let handler: DeleteDocumentHandler;
  let repo: jest.Mocked<IDocumentRepository>;
  let projectRepo: jest.Mocked<IProjectRepository>;
  let events: jest.Mocked<EventEmitter2>;

  beforeEach(() => {
    const mockEntity = DocumentEntity.fromPersistence({
      id: 'doc-1',
      projectId: 'proj-1',
      title: 'Doc to Delete',
      content: 'Content',
      createdById: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    repo = {
      findById: jest.fn().mockResolvedValue(mockEntity),
      delete: jest.fn().mockResolvedValue(undefined),
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

    handler = new DeleteDocumentHandler(repo, projectRepo, events);
  });

  it('throws DocumentNotFoundError when document does not exist', async () => {
    repo.findById.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new DeleteDocumentCommand('user-1', 'doc-missing')),
    ).rejects.toThrow(DocumentNotFoundError);

    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('throws DocumentForbiddenError when user is not a member', async () => {
    projectRepo.findMembership.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new DeleteDocumentCommand('user-outsider', 'doc-1')),
    ).rejects.toThrow(DocumentForbiddenError);

    expect(repo.delete).not.toHaveBeenCalled();
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
      handler.execute(new DeleteDocumentCommand('user-viewer', 'doc-1')),
    ).rejects.toThrow(DocumentForbiddenError);

    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('deletes document and emits document.deleted when user is member', async () => {
    await handler.execute(new DeleteDocumentCommand('user-1', 'doc-1'));

    expect(repo.delete).toHaveBeenCalledWith('doc-1');
    expect(events.emit).toHaveBeenCalledWith('document.deleted', {
      projectId: 'proj-1',
      documentId: 'doc-1',
      actorId: 'user-1',
    });
  });
});
