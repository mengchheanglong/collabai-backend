// src/modules/realtime/events.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '../../shared/services/jwt.service';
import { PrismaService } from '../../shared/services/prisma.service';
import { TaskCreatedEvent } from '../tasks/domain/events/task-created.event';
import { TaskMovedEvent } from '../tasks/domain/events/task-moved.event';
import { CommentAddedEvent } from '../comments/domain/events/comment-added.event';
import { isValidUuid } from '../../common/utils/uuid.util';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
@Injectable()
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly projectPresence = new Map<
    string,
    Map<string, { userId: string; name: string; email: string; socketId: string }>
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private broadcastPresence(projectId: string) {
    if (!this.server) return;
    const presence = this.projectPresence.get(projectId);
    const uniqueUsers = presence
      ? Array.from(
          Array.from(presence.values()).reduce((acc, u) => {
            if (!acc.has(u.userId)) {
              acc.set(u.userId, { userId: u.userId, name: u.name, email: u.email });
            }
            return acc;
          }, new Map<string, { userId: string; name: string; email: string }>()).values(),
        )
      : [];

    this.server.to(`project:${projectId}`).emit('presence:update', {
      projectId,
      actorId: 'system',
      data: {
        users: uniqueUsers,
        count: uniqueUsers.length,
      },
      createdAt: new Date().toISOString(),
    });
  }

  async handleConnection(client: Socket) {
    try {
      const rawToken =
        client.handshake.auth?.token ||
        (client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, ''));

      if (!rawToken) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verifyToken(rawToken);
      if (!payload || !payload.sub) {
        client.disconnect();
        return;
      }

      client.data.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
      };

      client.join(`user:${payload.sub}`);
      this.logger.debug(`Socket client connected: ${client.id} (user: ${payload.sub})`);
    } catch (err: any) {
      this.logger.debug(`Socket auth failed: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data?.typingProjectId && client.data?.typingTaskId && client.data?.user) {
      client.to(`project:${client.data.typingProjectId}`).emit('typing:stopped', {
        projectId: client.data.typingProjectId,
        actorId: client.data.user.id,
        data: {
          taskId: client.data.typingTaskId,
          userId: client.data.user.id,
        },
        createdAt: new Date().toISOString(),
      });
    }
    if (client.data?.editingProjectId && client.data?.editingDocId && client.data?.user) {
      client.to(`project:${client.data.editingProjectId}`).emit('doc:editing:stopped', {
        projectId: client.data.editingProjectId,
        actorId: client.data.user.id,
        data: {
          documentId: client.data.editingDocId,
          userId: client.data.user.id,
        },
        createdAt: new Date().toISOString(),
      });
    }
    if (client.data?.viewingProjectId && client.data?.viewingTaskId && client.data?.user) {
      client.to(`project:${client.data.viewingProjectId}`).emit('task:viewing:stopped', {
        projectId: client.data.viewingProjectId,
        actorId: client.data.user.id,
        data: {
          taskId: client.data.viewingTaskId,
          userId: client.data.user.id,
        },
        createdAt: new Date().toISOString(),
      });
    }

    const joinedProjects = client.data?.joinedProjects as Set<string> | undefined;
    if (joinedProjects) {
      for (const pid of joinedProjects) {
        const pres = this.projectPresence.get(pid);
        if (pres) {
          pres.delete(client.id);
          if (pres.size === 0) this.projectPresence.delete(pid);
          this.broadcastPresence(pid);
        }
      }
    }
    this.logger.debug(`Socket client disconnected: ${client.id}`);
  }

  @SubscribeMessage('project:join')
  async handleProjectJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    const userId = client.data.user?.id;
    if (!userId || !data?.projectId || !isValidUuid(data.projectId)) {
      return { success: false, error: 'Unauthorized or invalid projectId' };
    }

    const member = await this.prisma.projectMember.findFirst({
      where: { projectId: data.projectId, userId, isActive: true },
    });
    const project = await this.prisma.project.findFirst({
      where: { id: data.projectId, ownerId: userId },
    });

    if (!member && !project) {
      return { success: false, error: 'Forbidden' };
    }

    client.join(`project:${data.projectId}`);
    if (!client.data.joinedProjects) {
      client.data.joinedProjects = new Set<string>();
    }
    client.data.joinedProjects.add(data.projectId);

    let presence = this.projectPresence.get(data.projectId);
    if (!presence) {
      presence = new Map();
      this.projectPresence.set(data.projectId, presence);
    }
    presence.set(client.id, {
      userId: client.data.user.id,
      name: client.data.user.name,
      email: client.data.user.email,
      socketId: client.id,
    });
    this.broadcastPresence(data.projectId);

    return { success: true, projectId: data.projectId };
  }

  @SubscribeMessage('project:leave')
  handleProjectLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    if (data?.projectId) {
      client.leave(`project:${data.projectId}`);
      client.data?.joinedProjects?.delete(data.projectId);
      const presence = this.projectPresence.get(data.projectId);
      if (presence) {
        presence.delete(client.id);
        if (presence.size === 0) this.projectPresence.delete(data.projectId);
        this.broadcastPresence(data.projectId);
      }
      return { success: true, projectId: data.projectId };
    }
    return { success: false };
  }

  /**
   * Presence/typing/editing signals are only accepted for projects this socket joined via
   * `project:join` (which verifies membership) — a non-member must not be able to inject
   * fake indicators into another project's room.
   */
  private inProject(client: Socket, projectId: string | undefined): boolean {
    const joined = client.data.joinedProjects as Set<string> | undefined;
    return !!projectId && !!client.data.user && joined?.has(projectId) === true;
  }

  @SubscribeMessage('task:viewing:start')
  handleTaskViewingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; taskId: string },
  ) {
    if (data?.taskId && this.inProject(client, data?.projectId)) {
      client.data.viewingProjectId = data.projectId;
      client.data.viewingTaskId = data.taskId;
      client.to(`project:${data.projectId}`).emit('task:viewing:started', {
        projectId: data.projectId,
        actorId: client.data.user.id,
        data: {
          taskId: data.taskId,
          userId: client.data.user.id,
          userName: client.data.user.name,
          name: client.data.user.name,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('task:viewing:stop')
  handleTaskViewingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; taskId: string },
  ) {
    if (this.inProject(client, data?.projectId)) {
      delete client.data.viewingProjectId;
      delete client.data.viewingTaskId;
      client.to(`project:${data.projectId}`).emit('task:viewing:stopped', {
        projectId: data.projectId,
        actorId: client.data.user.id,
        data: {
          taskId: data.taskId,
          userId: client.data.user.id,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; taskId: string },
  ) {
    if (this.inProject(client, data?.projectId)) {
      client.data.typingProjectId = data.projectId;
      client.data.typingTaskId = data.taskId;
      client.to(`project:${data.projectId}`).emit('typing:started', {
        projectId: data.projectId,
        actorId: client.data.user.id,
        data: {
          taskId: data.taskId,
          userId: client.data.user.id,
          name: client.data.user.name,
          userName: client.data.user.name,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; taskId: string },
  ) {
    if (this.inProject(client, data?.projectId)) {
      delete client.data.typingProjectId;
      delete client.data.typingTaskId;
      client.to(`project:${data.projectId}`).emit('typing:stopped', {
        projectId: data.projectId,
        actorId: client.data.user.id,
        data: {
          taskId: data.taskId,
          userId: client.data.user.id,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('doc:editing:start')
  handleDocEditingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; documentId: string },
  ) {
    if (data?.documentId && this.inProject(client, data?.projectId)) {
      client.data.editingProjectId = data.projectId;
      client.data.editingDocId = data.documentId;
      client.to(`project:${data.projectId}`).emit('doc:editing:started', {
        projectId: data.projectId,
        actorId: client.data.user.id,
        data: {
          documentId: data.documentId,
          userId: client.data.user.id,
          name: client.data.user.name,
          userName: client.data.user.name,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('doc:editing:stop')
  handleDocEditingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; documentId: string },
  ) {
    if (this.inProject(client, data?.projectId)) {
      delete client.data.editingProjectId;
      delete client.data.editingDocId;
      client.to(`project:${data.projectId}`).emit('doc:editing:stopped', {
        projectId: data.projectId,
        actorId: client.data.user.id,
        data: {
          documentId: data.documentId,
          userId: client.data.user.id,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  // --- Domain Event Listeners -> Socket Broadcasts ---

  private formatTaskPayload(task: any) {
    if (!task) return null;
    return {
      ...task,
      id: task.id,
      _id: task.id,
      assigneeId: task.assignedTo ?? task.assigneeId ?? null,
      createdById: task.createdBy ?? task.createdById,
      labels: (task.labels || []).map((l: any) =>
        typeof l === 'string' ? l : (l?.label?.name ?? l?.name ?? l)
      ),
      subtasks: (task.subtasks || []).map((s: any) => ({
        id: s.id,
        _id: s.id,
        title: s.title,
        done: s.done ?? s.completed ?? false,
      })),
      createdAt:
        task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
      updatedAt:
        task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
    };
  }

  @OnEvent(TaskCreatedEvent.eventName)
  async handleTaskCreated(event: TaskCreatedEvent) {
    if (!this.server) return;
    const task = await this.prisma.task.findUnique({
      where: { id: event.taskId },
      include: {
        labels: { include: { label: true } },
        subtasks: true,
      },
    });

    this.server.to(`project:${event.projectId}`).emit('task:created', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: { task: this.formatTaskPayload(task) },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent(TaskMovedEvent.eventName)
  async handleTaskMoved(event: TaskMovedEvent) {
    if (!this.server) return;
    const task = await this.prisma.task.findUnique({
      where: { id: event.taskId },
      include: {
        labels: { include: { label: true } },
        subtasks: true,
      },
    });

    const mappedTask = this.formatTaskPayload(task);

    this.server.to(`project:${event.projectId}`).emit('task:moved', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: {
        taskId: event.taskId,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        position: event.position,
        task: mappedTask,
      },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent('task.updated')
  handleTaskUpdated(event: {
    taskId: string;
    projectId: string;
    actorId: string;
    task: any;
  }) {
    if (!this.server) return;
    this.server.to(`project:${event.projectId}`).emit('task:updated', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: { task: this.formatTaskPayload(event.task) },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent('task.deleted')
  handleTaskDeleted(event: {
    taskId: string;
    projectId: string;
    boardId?: string | null;
    actorId: string;
  }) {
    if (!this.server) return;
    this.server.to(`project:${event.projectId}`).emit('task:deleted', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: { taskId: event.taskId, boardId: event.boardId },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent(CommentAddedEvent.eventName)
  async handleCommentAdded(event: CommentAddedEvent) {
    if (!this.server) return;
    const comment = await this.prisma.comment.findUnique({
      where: { id: event.commentId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    this.server.to(`project:${event.projectId}`).emit('comment:created', {
      projectId: event.projectId,
      actorId: event.authorId,
      data: { taskId: event.taskId, comment },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent('comment.deleted')
  handleCommentDeleted(event: {
    commentId: string;
    taskId: string;
    projectId: string;
    actorId: string;
  }) {
    if (!this.server) return;
    this.server.to(`project:${event.projectId}`).emit('comment:deleted', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: { taskId: event.taskId, commentId: event.commentId },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent('document.created')
  handleDocumentCreated(event: {
    projectId: string;
    documentId: string;
    actorId: string;
    document: any;
  }) {
    if (!this.server) return;
    this.server.to(`project:${event.projectId}`).emit('document:created', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: { document: event.document },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent('document.updated')
  handleDocumentUpdated(event: {
    projectId: string;
    documentId: string;
    actorId: string;
    document: any;
  }) {
    if (!this.server) return;
    this.server.to(`project:${event.projectId}`).emit('document:updated', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: { document: event.document },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent('document.deleted')
  handleDocumentDeleted(event: {
    projectId: string;
    documentId: string;
    actorId: string;
  }) {
    if (!this.server) return;
    this.server.to(`project:${event.projectId}`).emit('document:deleted', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: { documentId: event.documentId },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent('member.added')
  handleMemberAdded(event: {
    projectId: string;
    actorId: string;
    userId: string;
    role: string;
  }) {
    if (!this.server) return;
    this.server.to(`project:${event.projectId}`).emit('member:added', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: { userId: event.userId, role: event.role },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent('member.removed')
  handleMemberRemoved(event: {
    projectId: string;
    actorId: string;
    userId: string;
  }) {
    if (!this.server) return;
    this.server.to(`project:${event.projectId}`).emit('member:removed', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: { userId: event.userId },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent('project.updated')
  handleProjectUpdated(event: {
    projectId: string;
    actorId: string;
    project: any;
  }) {
    if (!this.server) return;
    this.server.to(`project:${event.projectId}`).emit('project:updated', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: { project: event.project },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent('project.deleted')
  handleProjectDeleted(event: {
    projectId: string;
    actorId: string;
  }) {
    if (!this.server) return;
    this.server.to(`project:${event.projectId}`).emit('project:deleted', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: { projectId: event.projectId },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent('ai.job.completed')
  handleAiJobCompleted(event: {
    jobId: string;
    type: string;
    userId: string;
    projectId: string;
    result: unknown;
  }) {
    if (!this.server) return;
    this.server.to(`user:${event.userId}`).emit('ai:job:completed', {
      projectId: event.projectId,
      actorId: event.userId,
      data: { jobId: event.jobId, type: event.type, result: event.result },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent('ai.job.failed')
  handleAiJobFailed(event: {
    jobId: string;
    type: string;
    userId: string;
    projectId: string;
    error: string;
  }) {
    if (!this.server) return;
    this.server.to(`user:${event.userId}`).emit('ai:job:failed', {
      projectId: event.projectId,
      actorId: event.userId,
      data: { jobId: event.jobId, type: event.type, error: event.error },
      createdAt: new Date().toISOString(),
    });
  }

  @OnEvent('activity.created')
  handleActivityCreated(event: {
    projectId: string;
    actorId: string;
    activity: any;
  }) {
    if (!this.server) return;
    this.server.to(`project:${event.projectId}`).emit('activity:created', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: { activity: event.activity },
      createdAt: new Date().toISOString(),
    });
  }
}
