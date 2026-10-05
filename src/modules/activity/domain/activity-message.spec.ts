// src/modules/activity/domain/activity-message.spec.ts

import { activityType, buildActivityMessage } from './activity-message';

describe('activity-message', () => {
  const base = { actorName: 'Dara' };

  it('derives the contract activity type', () => {
    expect(activityType('task', 'created')).toBe('task.created');
    expect(activityType('comment', 'deleted')).toBe('comment.deleted');
  });

  it.each([
    [
      { entityType: 'task', action: 'created', subject: 'Build login page' },
      'Dara created task Build login page',
    ],
    [
      { entityType: 'task', action: 'updated', subject: 'API' },
      'Dara updated task API',
    ],
    [{ entityType: 'task', action: 'deleted' }, 'Dara deleted task a task'],
    [
      {
        entityType: 'task',
        action: 'moved',
        subject: 'API',
        oldValue: 'todo',
        newValue: 'in_progress',
      },
      'Dara moved task API from todo to in progress',
    ],
    [
      { entityType: 'comment', action: 'created', subject: 'API' },
      'Dara commented on API',
    ],
    [{ entityType: 'comment', action: 'created' }, 'Dara added a comment'],
    [
      { entityType: 'comment', action: 'deleted', subject: 'API' },
      'Dara deleted a comment on API',
    ],
    [
      { entityType: 'document', action: 'updated', subject: 'Spec' },
      'Dara updated document Spec',
    ],
    [
      { entityType: 'board', action: 'created', subject: 'Sprint 1' },
      'Dara created board Sprint 1',
    ],
  ])('builds %j', (input, expected) => {
    expect(buildActivityMessage({ ...base, ...input })).toBe(expected);
  });
});
