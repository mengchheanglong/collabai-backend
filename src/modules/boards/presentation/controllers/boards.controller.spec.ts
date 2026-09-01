import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { BoardsController } from './boards.controller';
import { GetBoardsQuery } from '../../application/queries/get-boards.query';
import { GetBoardQuery } from '../../application/queries/get-board.query';
import { CreateBoardCommand } from '../../application/commands/create-board.command';
import { UpdateBoardCommand } from '../../application/commands/update-board.command';
import { DeleteBoardCommand } from '../../application/commands/delete-board.command';
import { BoardView, BoardWithTasksView } from '../../domain/repositories/board.repository.interface';

describe('BoardsController', () => {
  let controller: BoardsController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  const mockBoardView: BoardView = {
    id: '11111111-1111-4111-a111-111111111111',
    projectId: '22222222-2222-4222-a222-222222222222',
    name: 'Sprint 1',
    description: 'Sprint 1 board',
    columns: [
      { key: 'todo', title: 'To Do', position: 0 },
      { key: 'in_progress', title: 'In Progress', position: 1 },
      { key: 'done', title: 'Done', position: 2 },
    ],
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-01T11:00:00.000Z'),
  };

  beforeEach(() => {
    commandBus = { execute: jest.fn() } as any;
    queryBus = { execute: jest.fn() } as any;
    controller = new BoardsController(commandBus, queryBus);
  });

  describe('listBoards', () => {
    it('executes GetBoardsQuery and returns mapped boards', async () => {
      queryBus.execute.mockResolvedValueOnce([mockBoardView]);

      const res = await controller.listBoards('user-1', mockBoardView.projectId);
      expect(queryBus.execute).toHaveBeenCalledWith(expect.any(GetBoardsQuery));
      expect(res).toHaveLength(1);
    });
  });

  describe('createBoard', () => {
    it('executes CreateBoardCommand and returns created board', async () => {
      commandBus.execute.mockResolvedValueOnce(mockBoardView);

      const res = await controller.createBoard('user-1', mockBoardView.projectId, {
        name: 'Sprint 1',
        description: 'Sprint 1 board',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(CreateBoardCommand));
      expect(res.board.id).toBe(mockBoardView.id);
    });
  });

  describe('getBoard', () => {
    it('executes GetBoardQuery with includeTasks=false', async () => {
      queryBus.execute.mockResolvedValueOnce(mockBoardView);

      const res = await controller.getBoard('user-1', mockBoardView.id, 'false');
      expect(queryBus.execute).toHaveBeenCalledWith(new GetBoardQuery('user-1', mockBoardView.id, false));
      expect(res.board.id).toBe(mockBoardView.id);
      expect((res as any).tasks).toBeUndefined();
    });

    it('executes GetBoardQuery with includeTasks=true and maps task details', async () => {
      const mockWithTasks: BoardWithTasksView = {
        ...mockBoardView,
        tasks: [
          {
            id: 'task-1',
            projectId: mockBoardView.projectId,
            boardId: mockBoardView.id,
            title: 'Task 1',
            description: 'Desc',
            status: 'todo',
            priority: 'medium',
            position: 1000,
            assigneeId: null,
            createdById: 'user-1',
            dueDate: new Date('2026-09-05T12:00:00.000Z'),
            completedAt: null,
            labels: ['tag1'],
            subtasks: [{ id: 'sub-1', title: 'Sub 1', done: false }],
            commentCount: 0,
            createdAt: new Date('2026-09-01T10:00:00.000Z'),
            updatedAt: new Date('2026-09-01T11:00:00.000Z'),
          },
        ],
      };

      queryBus.execute.mockResolvedValueOnce(mockWithTasks);

      const res = await controller.getBoard('user-1', mockBoardView.id, 'true');
      expect(queryBus.execute).toHaveBeenCalledWith(new GetBoardQuery('user-1', mockBoardView.id, true));
      expect(res.board).toBeDefined();
      expect(res.tasks).toHaveLength(1);
      expect(res.tasks[0]._id).toBe('task-1');
    });
  });

  describe('updateBoard', () => {
    it('executes UpdateBoardCommand and returns updated board', async () => {
      commandBus.execute.mockResolvedValueOnce(mockBoardView);

      const res = await controller.updateBoard('user-1', mockBoardView.id, {
        name: 'Sprint 1 Updated',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(UpdateBoardCommand));
      expect(res.board).toBeDefined();
    });
  });

  describe('deleteBoard', () => {
    it('executes DeleteBoardCommand and returns success message', async () => {
      commandBus.execute.mockResolvedValueOnce(undefined);

      const res = await controller.deleteBoard('user-1', mockBoardView.id);
      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(DeleteBoardCommand));
      expect(res.success).toBe(true);
    });
  });
});
