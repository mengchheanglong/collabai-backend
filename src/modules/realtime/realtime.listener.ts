import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventsGateway, LiveEvent } from './events.gateway';
import { WorkspaceChangedEvent } from '../../shared/events/workspace-changed.event';
import { PrismaService } from '../../shared/services/prisma.service';
import { TASK_REPOSITORY, type ITaskRepository } from '../tasks/domain/repositories/task.repository.interface';
import { COMMENT_REPOSITORY, type ICommentRepository } from '../comments/domain/repositories/comment.repository.interface';
import { TaskCreatedEvent } from '../tasks/domain/events/task-created.event';
import { TaskMovedEvent } from '../tasks/domain/events/task-moved.event';
import { CommentAddedEvent } from '../comments/domain/events/comment-added.event';
import { toTaskResponse } from '../tasks/application/dtos/task-response.dto';
import { toCommentResponse } from '../comments/application/dtos/comment-response.dto';
@Injectable()
export class RealtimeListener {
 private readonly logger = new Logger(RealtimeListener.name);
 private readonly queues = new Map<string, Promise<void>>();
 constructor(private readonly gateway: EventsGateway, private readonly db: PrismaService,
  @Inject(TASK_REPOSITORY) private readonly tasks: ITaskRepository,
  @Inject(COMMENT_REPOSITORY) private readonly comments: ICommentRepository) {}
 private enqueue(projectId: string, work: () => Promise<void>) {
  const next = (this.queues.get(projectId) ?? Promise.resolve()).then(work).catch(error => this.logger.warn(`Realtime delivery failed: ${String(error)}`));
  this.queues.set(projectId, next);
  void next.finally(() => { if (this.queues.get(projectId) === next) this.queues.delete(projectId); });
  return next;
 }
 @OnEvent(TaskCreatedEvent.eventName)
 created(event: TaskCreatedEvent) { return this.task('task:created', event); }
 @OnEvent(TaskMovedEvent.eventName)
 moved(event: TaskMovedEvent) { return this.task('task:moved', event); }
 private task(name: string, event: TaskCreatedEvent | TaskMovedEvent) {
  return this.enqueue(event.projectId, async () => {
   const task = await this.tasks.findViewById(event.taskId); if (!task) return;
   await this.deliver(new WorkspaceChangedEvent(name, event.projectId, event.actorId, { ...event, task: toTaskResponse(task) }));
  });
 }
 @OnEvent(CommentAddedEvent.eventName)
 added(event: CommentAddedEvent) {
  return this.enqueue(event.projectId, async () => {
   const comment = await this.comments.findViewById(event.commentId); if (!comment) return;
   await this.deliver(new WorkspaceChangedEvent('comment:created', event.projectId, event.authorId, { taskId: event.taskId, comment: toCommentResponse(comment) }));
  });
 }
 @OnEvent(WorkspaceChangedEvent.eventName)
 changed(event: WorkspaceChangedEvent) { return this.enqueue(event.projectId || event.userId || '', () => this.deliver(event)); }
 private async deliver(change: WorkspaceChangedEvent) {
  const event: LiveEvent = { projectId: change.projectId, actorId: change.actorId, data: change.data, createdAt: new Date().toISOString() };
  if (change.name === 'notification:created') { if (change.userId) await this.gateway.publishToUser(change.userId, change.name, event); return; }
  if (change.name === 'member:removed') {
   const userId = String(change.data.userId); this.gateway.evict(change.projectId, userId);
   await this.gateway.publishToUser(userId, change.name, event);
  }
  await this.gateway.publish(change.name, event);
  if (change.name === 'member:added') await this.gateway.publishToUser(String(change.data.userId), change.name, event);
  if (change.name.startsWith('comment:')) {
   const task = await this.tasks.findViewById(String(change.data.taskId));
   if (task) await this.gateway.publish('task:updated', { ...event, data: { task: toTaskResponse(task) } });
  }
  if (change.name === 'project:deleted') return;
  if (change.data.auditRecorded === true) return;
  // Audit persistence is best-effort and cannot turn a committed REST mutation into a failure.
  try {
   const [entityType, action] = change.name.split(':');
   const entity = change.data[entityType] as { _id?: string; id?: string } | undefined;
   const entityId = entity?._id ?? entity?.id ?? change.data[`${entityType}Id`] ?? (entityType === 'member' ? change.data.userId : change.projectId);
   const activity = await this.db.activity.create({ data: { projectId: change.projectId, userId: change.actorId, entityType, entityId: String(entityId), action }, include: { user: { select: { id: true, name: true, email: true } } } });
   await this.gateway.publish('activity:created', { ...event, data: { activity: { _id: activity.id, projectId: activity.projectId, actorId: activity.userId, actor: { _id: activity.user.id, name: activity.user.name, email: activity.user.email }, type: `${entityType}.${action}`, entityType, entityId, message: `${activity.user.name} ${action} a ${entityType}`, createdAt: activity.createdAt.toISOString() } } });
  } catch (error) { this.logger.warn(`Activity delivery failed: ${String(error)}`); }
 }
}
