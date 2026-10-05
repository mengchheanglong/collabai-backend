import { EventsGateway } from './events.gateway';
import { JwtService } from '../../shared/services/jwt.service';
import { PrismaService } from '../../shared/services/prisma.service';

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let jwtService: jest.Mocked<JwtService>;
  let prisma: jest.Mocked<PrismaService>;
  let mockServer: any;

  beforeEach(() => {
    jwtService = {
      verifyToken: jest.fn(),
    } as any;

    prisma = {
      projectMember: {
        findFirst: jest.fn(),
      },
      project: {
        findFirst: jest.fn(),
      },
      task: {
        findUnique: jest.fn(),
      },
      comment: {
        findUnique: jest.fn(),
      },
      board: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    } as any;

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    gateway = new EventsGateway(jwtService, prisma);
    gateway.server = mockServer;
  });

  describe('handleConnection', () => {
    it('disconnects if no auth token is provided', async () => {
      const client: any = {
        handshake: { auth: {}, headers: {} },
        disconnect: jest.fn(),
        data: {},
      };

      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects if token verification fails', async () => {
      const client: any = {
        handshake: { auth: { token: 'invalid-token' }, headers: {} },
        disconnect: jest.fn(),
        data: {},
      };
      jwtService.verifyToken.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('attaches user data and joins personal room on valid token', async () => {
      const client: any = {
        id: 'client-1',
        handshake: { auth: { token: 'valid-token' }, headers: {} },
        disconnect: jest.fn(),
        join: jest.fn(),
        data: {},
      };
      jwtService.verifyToken.mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Tester',
      } as any);

      await gateway.handleConnection(client);
      expect(client.data.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Tester',
      });
      expect(client.join).toHaveBeenCalledWith('user:user-123');
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect & typing cleanup', () => {
    it('emits typing:stopped if disconnecting while typing', () => {
      const emitMock = jest.fn();
      const client: any = {
        id: 'client-1',
        data: {
          typingProjectId: '00000000-0000-0000-0000-000000000001',
          typingTaskId: '00000000-0000-0000-0000-000000000002',
          user: { id: 'user-123' },
        },
        to: jest.fn().mockReturnValue({ emit: emitMock }),
      };

      gateway.handleDisconnect(client);

      expect(client.to).toHaveBeenCalledWith('project:00000000-0000-0000-0000-000000000001');
      expect(emitMock).toHaveBeenCalledWith(
        'typing:stopped',
        expect.objectContaining({
          projectId: '00000000-0000-0000-0000-000000000001',
          actorId: 'user-123',
          data: {
            taskId: '00000000-0000-0000-0000-000000000002',
            userId: 'user-123',
          },
        }),
      );
    });
  });

  describe('handleProjectJoin', () => {
    it('rejects invalid UUID projectId', async () => {
      const client: any = { data: { user: { id: 'user-123' } } };
      const res = await gateway.handleProjectJoin(client, { projectId: 'not-a-uuid' });

      expect(res.success).toBe(false);
      expect(res.error).toContain('invalid projectId');
    });

    it('rejects when user is not member or owner of the project', async () => {
      const validUuid = '11111111-1111-4111-a111-111111111111';
      const client: any = { data: { user: { id: 'user-123' } } };

      (prisma.projectMember.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await gateway.handleProjectJoin(client, { projectId: validUuid });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Forbidden');
    });

    it('joins project room when user is active member', async () => {
      const validUuid = '11111111-1111-4111-a111-111111111111';
      const client: any = {
        data: { user: { id: 'user-123' } },
        join: jest.fn(),
      };

      (prisma.projectMember.findFirst as jest.Mock).mockResolvedValue({ id: 'mem-1' });

      const res = await gateway.handleProjectJoin(client, { projectId: validUuid });
      expect(res.success).toBe(true);
      expect(client.join).toHaveBeenCalledWith(`project:${validUuid}`);
    });
  });

  describe('typing events', () => {
    it('broadcasts typing:started to project room and stores state', () => {
      const emitMock = jest.fn();
      const client: any = {
        data: { user: { id: 'user-123', name: 'Tester' } },
        to: jest.fn().mockReturnValue({ emit: emitMock }),
      };

      gateway.handleTypingStart(client, {
        projectId: 'proj-1',
        taskId: 'task-1',
      });

      expect(client.data.typingProjectId).toBe('proj-1');
      expect(client.data.typingTaskId).toBe('task-1');
      expect(client.to).toHaveBeenCalledWith('project:proj-1');
      expect(emitMock).toHaveBeenCalledWith('typing:started', {
        projectId: 'proj-1',
        actorId: 'user-123',
        data: {
          taskId: 'task-1',
          userId: 'user-123',
          name: 'Tester',
          userName: 'Tester',
        },
        createdAt: expect.any(String),
      });
    });

    it('broadcasts typing:stopped and removes typing state', () => {
      const emitMock = jest.fn();
      const client: any = {
        data: {
          user: { id: 'user-123' },
          typingProjectId: 'proj-1',
          typingTaskId: 'task-1',
        },
        to: jest.fn().mockReturnValue({ emit: emitMock }),
      };

      gateway.handleTypingStop(client, {
        projectId: 'proj-1',
        taskId: 'task-1',
      });

      expect(client.data.typingProjectId).toBeUndefined();
      expect(client.data.typingTaskId).toBeUndefined();
      expect(client.to).toHaveBeenCalledWith('project:proj-1');
      expect(emitMock).toHaveBeenCalledWith('typing:stopped', {
        projectId: 'proj-1',
        actorId: 'user-123',
        data: {
          taskId: 'task-1',
          userId: 'user-123',
        },
        createdAt: expect.any(String),
      });
    });
  });

  describe('doc editing events', () => {
    it('broadcasts doc:editing:started to project room and stores state', () => {
      const emitMock = jest.fn();
      const client: any = {
        data: { user: { id: 'user-123', name: 'Alice' } },
        to: jest.fn().mockReturnValue({ emit: emitMock }),
      };

      gateway.handleDocEditingStart(client, {
        projectId: 'proj-1',
        documentId: 'doc-1',
      });

      expect(client.data.editingProjectId).toBe('proj-1');
      expect(client.data.editingDocId).toBe('doc-1');
      expect(client.to).toHaveBeenCalledWith('project:proj-1');
      expect(emitMock).toHaveBeenCalledWith('doc:editing:started', {
        projectId: 'proj-1',
        actorId: 'user-123',
        data: {
          documentId: 'doc-1',
          userId: 'user-123',
          name: 'Alice',
          userName: 'Alice',
        },
        createdAt: expect.any(String),
      });
    });

    it('broadcasts doc:editing:stopped and removes doc editing state', () => {
      const emitMock = jest.fn();
      const client: any = {
        data: {
          user: { id: 'user-123' },
          editingProjectId: 'proj-1',
          editingDocId: 'doc-1',
        },
        to: jest.fn().mockReturnValue({ emit: emitMock }),
      };

      gateway.handleDocEditingStop(client, {
        projectId: 'proj-1',
        documentId: 'doc-1',
      });

      expect(client.data.editingProjectId).toBeUndefined();
      expect(client.data.editingDocId).toBeUndefined();
      expect(client.to).toHaveBeenCalledWith('project:proj-1');
      expect(emitMock).toHaveBeenCalledWith('doc:editing:stopped', {
        projectId: 'proj-1',
        actorId: 'user-123',
        data: {
          documentId: 'doc-1',
          userId: 'user-123',
        },
        createdAt: expect.any(String),
      });
    });

    it('emits doc:editing:stopped on disconnect if user was editing a doc', () => {
      const emitMock = jest.fn();
      const client: any = {
        id: 'client-1',
        data: {
          user: { id: 'user-123' },
          editingProjectId: 'proj-1',
          editingDocId: 'doc-1',
        },
        to: jest.fn().mockReturnValue({ emit: emitMock }),
      };

      gateway.handleDisconnect(client);

      expect(client.to).toHaveBeenCalledWith('project:proj-1');
      expect(emitMock).toHaveBeenCalledWith('doc:editing:stopped', {
        projectId: 'proj-1',
        actorId: 'user-123',
        data: {
          documentId: 'doc-1',
          userId: 'user-123',
        },
        createdAt: expect.any(String),
      });
    });
  });

  describe('presence tracking & task viewing', () => {
    it('broadcasts presence:update on project:join and project:leave', async () => {
      const validUuid = '11111111-1111-4111-a111-111111111111';
      const client: any = {
        id: 'client-pres-1',
        data: { user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' } },
        join: jest.fn(),
        leave: jest.fn(),
      };

      (prisma.projectMember.findFirst as jest.Mock).mockResolvedValue({ id: 'mem-1' });

      await gateway.handleProjectJoin(client, { projectId: validUuid });

      expect(mockServer.to).toHaveBeenCalledWith(`project:${validUuid}`);
      expect(mockServer.emit).toHaveBeenCalledWith('presence:update', {
        projectId: validUuid,
        actorId: 'system',
        data: {
          users: [{ userId: 'user-1', name: 'Alice', email: 'alice@example.com' }],
          count: 1,
        },
        createdAt: expect.any(String),
      });

      gateway.handleProjectLeave(client, { projectId: validUuid });

      expect(client.leave).toHaveBeenCalledWith(`project:${validUuid}`);
      expect(mockServer.emit).toHaveBeenCalledWith('presence:update', {
        projectId: validUuid,
        actorId: 'system',
        data: {
          users: [],
          count: 0,
        },
        createdAt: expect.any(String),
      });
    });

    it('broadcasts task:viewing:started and task:viewing:stopped', () => {
      const emitMock = jest.fn();
      const client: any = {
        data: { user: { id: 'user-1', name: 'Alice' } },
        to: jest.fn().mockReturnValue({ emit: emitMock }),
      };

      gateway.handleTaskViewingStart(client, {
        projectId: 'proj-1',
        taskId: 'task-100',
      });

      expect(client.data.viewingProjectId).toBe('proj-1');
      expect(client.data.viewingTaskId).toBe('task-100');
      expect(client.to).toHaveBeenCalledWith('project:proj-1');
      expect(emitMock).toHaveBeenCalledWith('task:viewing:started', {
        projectId: 'proj-1',
        actorId: 'user-1',
        data: {
          taskId: 'task-100',
          userId: 'user-1',
          name: 'Alice',
          userName: 'Alice',
        },
        createdAt: expect.any(String),
      });

      gateway.handleTaskViewingStop(client, {
        projectId: 'proj-1',
        taskId: 'task-100',
      });

      expect(client.data.viewingProjectId).toBeUndefined();
      expect(client.data.viewingTaskId).toBeUndefined();
      expect(emitMock).toHaveBeenCalledWith('task:viewing:stopped', {
        projectId: 'proj-1',
        actorId: 'user-1',
        data: {
          taskId: 'task-100',
          userId: 'user-1',
        },
        createdAt: expect.any(String),
      });
    });

    it('cleans up task viewing and presence on handleDisconnect', async () => {
      const emitMock = jest.fn();
      const validUuid = '11111111-1111-4111-a111-111111111111';
      const client: any = {
        id: 'client-1',
        data: {
          user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
          viewingProjectId: validUuid,
          viewingTaskId: 'task-100',
        },
        join: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: emitMock }),
      };

      (prisma.projectMember.findFirst as jest.Mock).mockResolvedValue({ id: 'mem-1' });
      await gateway.handleProjectJoin(client, { projectId: validUuid });

      mockServer.to.mockClear();
      mockServer.emit.mockClear();

      gateway.handleDisconnect(client);

      expect(client.to).toHaveBeenCalledWith(`project:${validUuid}`);
      expect(emitMock).toHaveBeenCalledWith('task:viewing:stopped', {
        projectId: validUuid,
        actorId: 'user-1',
        data: {
          taskId: 'task-100',
          userId: 'user-1',
        },
        createdAt: expect.any(String),
      });
      expect(mockServer.to).toHaveBeenCalledWith(`project:${validUuid}`);
      expect(mockServer.emit).toHaveBeenCalledWith('presence:update', {
        projectId: validUuid,
        actorId: 'system',
        data: {
          users: [],
          count: 0,
        },
        createdAt: expect.any(String),
      });
    });
  });
});

