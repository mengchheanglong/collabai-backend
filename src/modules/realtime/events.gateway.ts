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

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
@Injectable()
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

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
    this.logger.debug(`Socket client disconnected: ${client.id}`);
  }

  @SubscribeMessage('project:join')
  async handleProjectJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    const userId = client.data.user?.id;
    if (!userId || !data?.projectId) {
      return { success: false, error: 'Unauthorized or missing projectId' };
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
    return { success: true, projectId: data.projectId };
  }

  @SubscribeMessage('project:leave')
  handleProjectLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    if (data?.projectId) {
      client.leave(`project:${data.projectId}`);
      return { success: true, projectId: data.projectId };
    }
    return { success: false };
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; taskId: string },
  ) {
    if (data?.projectId) {
      client.to(`project:${data.projectId}`).emit('typing:started', {
        projectId: data.projectId,
        taskId: data.taskId,
        userId: client.data.user?.id,
        userName: client.data.user?.name,
      });
    }
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; taskId: string },
  ) {
    if (data?.projectId) {
      client.to(`project:${data.projectId}`).emit('typing:stopped', {
        projectId: data.projectId,
        taskId: data.taskId,
        userId: client.data.user?.id,
      });
    }
  }

  // --- Domain Event Listeners -> Socket Broadcasts ---

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
      data: { task },
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

    this.server.to(`project:${event.projectId}`).emit('task:moved', {
      projectId: event.projectId,
      actorId: event.actorId,
      data: {
        taskId: event.taskId,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        position: event.position,
        task,
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
      data: { task: event.task },
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
}
