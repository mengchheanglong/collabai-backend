// src/modules/activity/infrastructure/event-handlers/activity-events.listener.spec.ts

import { ActivityEventsListener } from './activity-events.listener';
import { TaskCreatedEvent } from '../../../tasks/domain/events/task-created.event';
import { TaskMovedEvent } from '../../../tasks/domain/events/task-moved.event';
import { CommentAddedEvent } from '../../../comments/domain/events/comment-added.event';

describe('ActivityEventsListener', () => {
  let bus: { publish: jest.Mock };
  let listener: ActivityEventsListener;

  beforeEach(() => {
    bus = { publish: jest.fn().mockResolvedValue(undefined) };
    listener = new ActivityEventsListener(bus);
  });

  it('queues task.created with the task title', async () => {
    await listener.onTaskCreated(
      new TaskCreatedEvent('task-1', 'proj-1', 'user-1', 'Build login page'),
    );
    expect(bus.publish).toHaveBeenCalledWith('activity.task.created', {
      id: expect.any(String),
      projectId: 'proj-1',
      actorId: 'user-1',
      entityType: 'task',
      entityId: 'task-1',
      action: 'created',
      subject: 'Build login page',
    });
  });

  it('queues task.moved with the status change', async () => {
    await listener.onTaskMoved(
      new TaskMovedEvent(
        'task-1',
        'proj-1',
        'user-1',
        'todo' as any,
        'done' as any,
        0,
      ),
    );
    expect(bus.publish).toHaveBeenCalledWith(
      'activity.task.moved',
      expect.objectContaining({
        oldValue: 'todo',
        newValue: 'done',
        subjectTaskId: 'task-1',
      }),
    );
  });

  it('maps comment.added to comment.created', async () => {
    await listener.onCommentAdded(
      new CommentAddedEvent('c-1', 'task-1', 'proj-1', 'user-2'),
    );
    expect(bus.publish).toHaveBeenCalledWith(
      'activity.comment.created',
      expect.objectContaining({
        actorId: 'user-2',
        entityId: 'c-1',
        subjectTaskId: 'task-1',
      }),
    );
  });

  it('keeps the title of deleted tasks and documents', async () => {
    await listener.onTaskDeleted({
      projectId: 'p',
      actorId: 'u',
      taskId: 't',
      title: 'Old task',
    });
    await listener.onDocumentDeleted({
      projectId: 'p',
      actorId: 'u',
      documentId: 'd',
      title: 'Spec',
    });
    expect(bus.publish).toHaveBeenCalledWith(
      'activity.task.deleted',
      expect.objectContaining({ subject: 'Old task' }),
    );
    expect(bus.publish).toHaveBeenCalledWith(
      'activity.document.deleted',
      expect.objectContaining({ entityType: 'document', subject: 'Spec' }),
    );
  });

  it('never throws back into the emitting request', async () => {
    bus.publish.mockRejectedValueOnce(new Error('boom'));
    await expect(
      listener.onTaskUpdated({
        projectId: 'p',
        actorId: 'u',
        taskId: 't',
        task: { title: 'X' },
      }),
    ).resolves.toBeUndefined();
  });
});
