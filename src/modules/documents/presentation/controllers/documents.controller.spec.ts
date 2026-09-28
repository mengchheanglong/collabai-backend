import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { DocumentsController } from './documents.controller';
import { CreateDocumentCommand } from '../../application/commands/create-document.command';
import { GetDocumentsQuery } from '../../application/queries/get-documents.query';
import { GetDocumentQuery } from '../../application/queries/get-document.query';
import { UpdateDocumentCommand } from '../../application/commands/update-document.command';
import { DeleteDocumentCommand } from '../../application/commands/delete-document.command';
import { DocumentView } from '../../domain/repositories/document.repository.interface';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  const mockDocView: DocumentView = {
    id: '11111111-1111-4111-a111-111111111111',
    projectId: '22222222-2222-4222-a222-222222222222',
    title: 'Architecture Overview',
    content: '# Architecture\nDetailed overview',
    createdById: '33333333-3333-4333-a333-333333333333',
    creatorName: 'Alice',
    creatorEmail: 'alice@example.com',
    creatorAvatarUrl: null,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-01T10:00:00.000Z'),
  };

  beforeEach(() => {
    commandBus = { execute: jest.fn() } as any;
    queryBus = { execute: jest.fn() } as any;
    controller = new DocumentsController(commandBus, queryBus);
  });

  describe('listDocuments', () => {
    it('executes GetDocumentsQuery and returns array of documents', async () => {
      queryBus.execute.mockResolvedValueOnce([mockDocView]);

      const res = await controller.listDocuments('user-1', mockDocView.projectId);

      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetDocumentsQuery('user-1', mockDocView.projectId),
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(mockDocView.id);
      expect(res[0].title).toBe('Architecture Overview');
    });
  });

  describe('createDocument', () => {
    it('executes CreateDocumentCommand and returns created document', async () => {
      commandBus.execute.mockResolvedValueOnce(mockDocView);

      const res = await controller.createDocument('user-1', mockDocView.projectId, {
        title: 'Architecture Overview',
        content: '# Architecture\nDetailed overview',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new CreateDocumentCommand(
          'user-1',
          mockDocView.projectId,
          'Architecture Overview',
          '# Architecture\nDetailed overview',
        ),
      );
      expect(res.document.id).toBe(mockDocView.id);
    });
  });

  describe('getDocument', () => {
    it('executes GetDocumentQuery and returns document', async () => {
      queryBus.execute.mockResolvedValueOnce(mockDocView);

      const res = await controller.getDocument('user-1', mockDocView.id);

      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetDocumentQuery('user-1', mockDocView.id),
      );
      expect(res.document.id).toBe(mockDocView.id);
    });
  });

  describe('updateDocument', () => {
    it('executes UpdateDocumentCommand and returns updated document', async () => {
      const updatedView = { ...mockDocView, title: 'Updated Title' };
      commandBus.execute.mockResolvedValueOnce(updatedView);

      const res = await controller.updateDocument('user-1', mockDocView.id, {
        title: 'Updated Title',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        new UpdateDocumentCommand('user-1', mockDocView.id, {
          title: 'Updated Title',
          content: undefined,
        }),
      );
      expect(res.document.title).toBe('Updated Title');
    });
  });

  describe('deleteDocument', () => {
    it('executes DeleteDocumentCommand', async () => {
      commandBus.execute.mockResolvedValueOnce(undefined);

      const res = await controller.deleteDocument('user-1', mockDocView.id);

      expect(commandBus.execute).toHaveBeenCalledWith(
        new DeleteDocumentCommand('user-1', mockDocView.id),
      );
      expect(res.success).toBe(true);
    });
  });
});
