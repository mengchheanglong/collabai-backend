// src/modules/activity/infrastructure/event-handlers/activity-events.listener.ts
//
// Turns task/comment/document domain events into `activity.*` jobs on the
// `collabai.activity` queue. ActivityLogWorker persists them and broadcasts
// `activity:created`. Publishing never throws back into the emitting request.

import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import {
  EVENT_BUS,
  type IEventBus,
} from '../../../../shared/event-bus/event-bus.interface';
import { TaskCreatedEvent } from '../../../tasks/domain/events/task-created.event';
import { TaskMovedEvent } from '../../../tasks/domain/events/task-moved.event';
import { CommentAddedEvent } from '../../../comments/domain/events/comment-added.event';
import { ActivityLogJob, activityType } from '../../domain/activity-message';

interface ActorEvent {
  projectId: string;
  actorId: string;
}

@Injectable()
export class ActivityEventsListener {
  private readonly logger = new Logger(ActivityEventsListener.name);

  constructor(@Inject(EVENT_BUS) private readonly bus: IEventBus) {}

  @OnEvent(TaskCreatedEvent.eventName)
  onTaskCreated(event: TaskCreatedEvent): Promise<void> {
    return this.log({
      projectId: event.projectId,
      actorId: event.actorId,
      entityType: 'task',
      entityId: event.taskId,
      action: 'created',
      subject: event.title,
    });
  }

  @OnEvent('task.updated')
  onTaskUpdated(
    event: ActorEvent & { taskId: string; task?: { title?: string } | null },
  ): Promise<void> {
    return this.log({
      projectId: event.projectId,
      actorId: event.actorId,
      entityType: 'task',
      entityId: event.taskId,
      action: 'updated',
      subject: event.task?.title,
      subjectTaskId: event.task?.title ? undefined : event.taskId,
    });
  }

  @OnEvent(TaskMovedEvent.eventName)
  onTaskMoved(event: TaskMovedEvent): Promise<void> {
    return this.log({
      projectId: event.projectId,
      actorId: event.actorId,
      entityType: 'task',
      entityId: event.taskId,
      action: 'moved',
      oldValue: event.fromStatus,
      newValue: event.toStatus,
      subjectTaskId: event.taskId,
    });
  }

  @OnEvent('task.deleted')
  onTaskDeleted(
    event: ActorEvent & { taskId: string; title?: string },
  ): Promise<void> {
    return this.log({
      projectId: event.projectId,
      actorId: event.actorId,
      entityType: 'task',
      entityId: event.taskId,
      action: 'deleted',
      subject: event.title,
    });
  }

  @OnEvent(CommentAddedEvent.eventName)
  onCommentAdded(event: CommentAddedEvent): Promise<void> {
    return this.log({
      projectId: event.projectId,
      actorId: event.authorId,
      entityType: 'comment',
      entityId: event.commentId,
      action: 'created',
      subjectTaskId: event.taskId,
    });
  }

  @OnEvent('comment.deleted')
  onCommentDeleted(
    event: ActorEvent & { commentId: string; taskId: string },
  ): Promise<void> {
    return this.log({
      projectId: event.projectId,
      actorId: event.actorId,
      entityType: 'comment',
      entityId: event.commentId,
      action: 'deleted',
      subjectTaskId: event.taskId,
    });
  }

  @OnEvent('document.created')
  onDocumentCreated(
    event: ActorEvent & { documentId: string; document?: { title?: string } },
  ): Promise<void> {
    return this.logDocument(event, 'created', event.document?.title);
  }

  @OnEvent('document.updated')
  onDocumentUpdated(
    event: ActorEvent & { documentId: string; document?: { title?: string } },
  ): Promise<void> {
    return this.logDocument(event, 'updated', event.document?.title);
  }

  @OnEvent('document.deleted')
  onDocumentDeleted(
    event: ActorEvent & { documentId: string; title?: string },
  ): Promise<void> {
    return this.logDocument(event, 'deleted', event.title);
  }

  private logDocument(
    event: ActorEvent & { documentId: string },
    action: string,
    title: string | undefined,
  ): Promise<void> {
    return this.log({
      projectId: event.projectId,
      actorId: event.actorId,
      entityType: 'document',
      entityId: event.documentId,
      action,
      subject: title,
    });
  }

  private async log(job: Omit<ActivityLogJob, 'id'>): Promise<void> {
    try {
      await this.bus.publish<ActivityLogJob>(
        `activity.${activityType(job.entityType, job.action)}`,
        { id: uuidv4(), ...job },
      );
    } catch (err) {
      this.logger.error(
        `Failed to queue ${activityType(job.entityType, job.action)} activity: ${(err as Error).message}`,
      );
    }
  }
}
