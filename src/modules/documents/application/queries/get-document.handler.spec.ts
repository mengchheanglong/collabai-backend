import { GetDocumentHandler } from './get-document.handler';
import { GetDocumentQuery } from './get-document.query';
import { IDocumentRepository } from '../../domain/repositories/document.repository.interface';
import { IProjectRepository } from '../../../projects/domain/repositories/project.repository.interface';
import { DocumentForbiddenError, DocumentNotFoundError } from '../errors/document.errors';

describe('GetDocumentHandler', () => {
  let handler: GetDocumentHandler;
  let repo: jest.Mocked<IDocumentRepository>;
  let projectRepo: jest.Mocked<IProjectRepository>;

  const mockView = {
    id: 'doc-1',
    projectId: 'proj-1',
    title: 'Test Doc',
    content: 'Content',
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repo = {
      findViewById: jest.fn().mockResolvedValue(mockView),
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

    handler = new GetDocumentHandler(repo, projectRepo);
  });

  it('throws DocumentNotFoundError when document does not exist', async () => {
    repo.findViewById.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new GetDocumentQuery('user-1', 'doc-missing')),
    ).rejects.toThrow(DocumentNotFoundError);
  });

  it('throws DocumentForbiddenError when user is not a member', async () => {
    projectRepo.findMembership.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new GetDocumentQuery('user-outsider', 'doc-1')),
    ).rejects.toThrow(DocumentForbiddenError);
  });

  it('returns document with canEdit: true for member role', async () => {
    const result = await handler.execute(new GetDocumentQuery('user-1', 'doc-1'));

    expect(result.id).toBe('doc-1');
    expect(result.canEdit).toBe(true);
  });

  it('returns document with canEdit: false for viewer role', async () => {
    projectRepo.findMembership.mockResolvedValueOnce({
      id: 'm-1',
      projectId: 'proj-1',
      userId: 'user-viewer',
      role: 'viewer',
      isActive: true,
    } as any);

    const result = await handler.execute(new GetDocumentQuery('user-viewer', 'doc-1'));

    expect(result.id).toBe('doc-1');
    expect(result.canEdit).toBe(false);
  });
});
